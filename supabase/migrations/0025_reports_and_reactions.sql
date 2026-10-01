-- ─────────────────────────────────────────── 신고와 반응
--
-- 게시글 신고(post_reports)를 댓글 신고와 같은 모양으로 두고, 들어오면 운영자에게 메일로 민다.
-- 신고함은 뷰(report_inbox)를 버리고 관리자 전용 함수로 바꾼다 — 뷰는 security_invoker 라 관리자도
-- 글 읽기 정책에 걸려, 나만 보기로 바뀐 글의 댓글·글 신고가 목록에서 사라졌다(1단계 검토 I4).
-- 댓글 좋아요 수는 뷰가 센다(좋아요 표와 정책은 0023).
--
-- 다시 돌려도 깨지지 않게 쓴다.

create table if not exists public.post_reports (
  post_id     uuid not null references public.posts on delete cascade,
  reporter    uuid not null references auth.users on delete cascade,
  reason      text not null default '',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users on delete set null,
  primary key (post_id, reporter)
);

alter table public.post_reports enable row level security;

-- 내 이름으로, 내가 볼 수 있는 글만. 안 보이는 글을 id 로 찔러 신고할 수 없게
drop policy if exists "own insert" on public.post_reports;
create policy "own insert" on public.post_reports
  for insert to authenticated
  with check (reporter = auth.uid() and public.can_read_post(post_id));

drop policy if exists "own or admin select" on public.post_reports;
create policy "own or admin select" on public.post_reports
  for select to authenticated using (reporter = auth.uid() or public.is_admin());

/* 게시글 신고 알림. 0014 의 notify_report 와 같다 — 알림은 곁가지고 기록이 본체다 */
create or replace function public.notify_post_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base   text;
  secret text;
begin
  select decrypted_secret into base   from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  begin
    perform net.http_post(
      url     := coalesce(base, 'http://host.docker.internal:54321/functions/v1') || '/notify-report',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', coalesce(secret, '')),
      body    := jsonb_build_object('post_id', new.post_id, 'reporter', new.reporter, 'reason', new.reason),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning '신고 알림을 보내지 못했습니다: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists post_reports_notify on public.post_reports;
create trigger post_reports_notify
  after insert on public.post_reports
  for each row execute function public.notify_post_report();

-- ── 댓글 좋아요 수. 부르는 사람 권한으로 센다 — 볼 수 없는 댓글의 수는 새지 않는다
drop view if exists public.comment_like_stats;
create view public.comment_like_stats
with (security_invoker = true) as
select comment_id, count(*)::int as like_count
from public.comment_likes
group by comment_id;

grant select on public.comment_like_stats to anon, authenticated;

-- ── 신고함
/*
  관리자 전용. 댓글 신고와 게시글 신고를 한 목록으로, 마지막 신고가 최신인 순으로.
  줄 단위는 신고 건이 아니라 **신고당한 대상**이다(0017 과 같다 — 열 명이 신고해도 판단은 하나).
  security definer 로 돈다. 관리자도 나만 보기 글은 읽기 정책에 걸리므로, 뷰로는 그런 신고가
  사라졌다. 여기서 is_admin() 을 먼저 본다.
*/
create or replace function public.report_inbox_page(p_only_open boolean, p_offset int, p_limit int)
returns table (
  kind text,
  target_id uuid,
  report_count int,
  last_reported_at timestamptz,
  resolved boolean,
  reasons text[],
  subject_type text,
  subject_id text,
  body text,
  author uuid,
  deleted boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다';
  end if;

  return query
  select * from (
    select
      'comment'::text,
      r.comment_id,
      count(*)::int,
      max(r.created_at),
      bool_and(r.resolved_at is not null),
      array_remove(array_agg(distinct nullif(btrim(r.reason), '')), null),
      c.subject_type,
      c.subject_id,
      c.body,
      c.author,
      c.deleted_at is not null
    from public.comment_reports r
    join public.comments c on c.id = r.comment_id
    group by r.comment_id, c.subject_type, c.subject_id, c.body, c.author, c.deleted_at
    union all
    select
      'post'::text,
      r.post_id,
      count(*)::int,
      max(r.created_at),
      bool_and(r.resolved_at is not null),
      array_remove(array_agg(distinct nullif(btrim(r.reason), '')), null),
      'post'::text,
      r.post_id::text,
      p.body,
      p.author,
      p.deleted_at is not null
    from public.post_reports r
    join public.posts p on p.id = r.post_id
    group by r.post_id, p.body, p.author, p.deleted_at
  ) inbox (kind, target_id, report_count, last_reported_at, resolved, reasons, subject_type, subject_id, body, author, deleted)
  where not p_only_open or not inbox.resolved
  order by inbox.last_reported_at desc
  offset p_offset
  limit p_limit;
end;
$$;

revoke all on function public.report_inbox_page(boolean, int, int) from public, anon;
grant execute on function public.report_inbox_page(boolean, int, int) to authenticated;

/* 게시글 신고 처리 표시. 0017 의 resolve_report 와 같다 — 표에 update 를 열지 않는다 */
create or replace function public.resolve_post_report(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다';
  end if;
  update public.post_reports
     set resolved_at = now(), resolved_by = auth.uid()
   where post_id = p_post_id and resolved_at is null;
end;
$$;

revoke all on function public.resolve_post_report(uuid) from public, anon;
grant execute on function public.resolve_post_report(uuid) to authenticated;

/*
  관리자가 댓글을 내린다. 게시글의 admin_delete_post(0023)와 같은 이유로 서버 함수다 — 관리자도 남의
  나만 보기 글에 달린 댓글은 읽기 정책에 걸려, 그냥 update 로 지우면 0 행이 되고 오류도 없다. 신고함은
  그 댓글의 신고를 이제 보여 주므로(위 report_inbox_page), 지우기가 조용히 헛돌면 "처리됨" 만 남는다.
  deleted_by_admin 은 0013 의 트리거가 정하지만(지운 사람이 글쓴이가 아니면 관리자) 여기서도 적어 둔다.
*/
create or replace function public.admin_delete_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 댓글을 내릴 수 있습니다';
  end if;
  update public.comments
     set deleted_at = now(), deleted_by_admin = true
   where id = p_id and deleted_at is null;
end;
$$;

revoke all on function public.admin_delete_comment(uuid) from public, anon;
grant execute on function public.admin_delete_comment(uuid) to authenticated;

-- 옛 신고함 뷰. 앱은 이제 report_inbox_page() 를 부른다
drop view if exists public.report_inbox;

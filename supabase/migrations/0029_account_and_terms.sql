-- ─────────────────────────────────────────── 계정 삭제와 약관 동의
--
-- 앱스토어 심사 준비 (2026-09-30).
--
-- 1. 계정 삭제(지침 5.1.1(v)). 서버 함수 delete-account 가 사진 파일을 치우고 withdraw_comments() 를 부른 뒤
--    계정을 지운다. 글·좋아요·팬카드·직관 기록·차단은 계정을 따라 지워진다(on delete cascade).
--    댓글은 자리를 남긴다(2026-09-30 결정) — 댓글째 지우면 거기 달린 남의 답글까지 사라진다. 내용은 지우고
--    "지워진 댓글" 로 두며, 글쓴이 칸은 계정이 지워질 때 비운다(on delete set null).
-- 2. 약관 동의(지침 1.2). 글·댓글을 올리는 앱은 불쾌한 콘텐츠와 악용을 받아 주지 않는다는 약관에 동의를
--    받아야 한다. 동의한 약관 판과 시각을 profiles 에 두고, 동의하지 않은 사람은 글·댓글을 쓰지 못한다.
--
-- 다시 돌려도 깨지지 않게 쓴다.

-- ── 1-1. 댓글 글쓴이는 계정이 지워지면 비운다
alter table public.comments alter column author drop not null;

do $$
declare
  fk text;
begin
  -- 옛 이름(match_comments_author_fkey)이 표 이름을 바꾼 뒤에도 남아 있다. 이름에 기대지 않고 칸으로 찾는다
  for fk in
    select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.comments'::regclass and c.contype = 'f' and a.attname = 'author'
  loop
    execute format('alter table public.comments drop constraint %I', fk);
  end loop;
end $$;

alter table public.comments
  add constraint comments_author_fkey foreign key (author) references auth.users on delete set null;

-- ── 1-2. 탈퇴로 지운 댓글은 "관리자가 지운 댓글" 이 아니다. 서버 함수가 지우면 auth.uid() 가 비어 트리거가
-- 관리자로 적었다 — 탈퇴 처리 중이라는 표시(app.withdrawing)를 보고 가른다
create or replace function public.mark_comment_deleter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    -- 지워지는 그 순간에만 정한다. 글쓴이 본인이 아니면 관리자다 (RLS 가 그 둘만 통과시킨다)
    new.deleted_by_admin := auth.uid() is distinct from new.author
      and coalesce(current_setting('app.withdrawing', true), '') <> 'on';
  else
    -- 그 밖의 수정에서는 앱이 무슨 값을 보내든 두지 않는다
    new.deleted_by_admin := old.deleted_by_admin;
  end if;
  return new;
end
$$;

drop trigger if exists match_comments_mark_deleter on public.comments;
create trigger match_comments_mark_deleter
  before update on public.comments
  for each row execute function public.mark_comment_deleter();

-- ── 1-3. 탈퇴할 사람의 댓글을 지운 자리로. 서버 함수(service_role)만 부른다
create or replace function public.withdraw_comments(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.admins where user_id = p_user) then
    raise exception '운영자 계정은 지울 수 없습니다';
  end if;
  perform set_config('app.withdrawing', 'on', true);
  update public.comments
     set deleted_at = coalesce(deleted_at, now()),
         body = '탈퇴한 사용자의 댓글입니다'
   where author = p_user;
  perform set_config('app.withdrawing', 'off', true);
end
$$;

revoke all on function public.withdraw_comments(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_comments(uuid) to service_role;

-- ── 2-1. 동의한 약관 판과 시각
alter table public.profiles add column if not exists terms_version int not null default 0;
alter table public.profiles add column if not exists terms_agreed_at timestamptz;

-- 동의는 이 함수로만 적는다 — 시각을 서버가 적어야 동의 기록이 된다
create or replace function public.agree_terms(p_version int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  update public.profiles
     set terms_version = greatest(terms_version, p_version),
         terms_agreed_at = now()
   where id = auth.uid();
  if not found then
    raise exception '프로필을 먼저 만들어 주세요';
  end if;
end
$$;

revoke all on function public.agree_terms(int) from public, anon;
grant execute on function public.agree_terms(int) to authenticated;

-- 지금 약관에 동의했는가. 약관을 고쳐 다시 받아야 하면 여기 판 번호와 앱의 TERMS_VERSION 을 같이 올린다
create or replace function public.agreed_terms()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and terms_version >= 1);
$$;

-- ── 2-2. 동의하지 않은 사람은 글·댓글을 쓰지 못한다
drop policy if exists "own insert" on public.posts;
create policy "own insert" on public.posts
  for insert to authenticated with check (author = auth.uid() and public.agreed_terms());

drop policy if exists "own insert" on public.comments;
create policy "own insert" on public.comments
  for insert to authenticated
  with check (
    auth.uid() = author
    and public.agreed_terms()
    and case when subject_type = 'post' then public.can_write_post(subject_id::uuid) else true end
  );

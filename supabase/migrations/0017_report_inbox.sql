-- ─────────────────────────────────────────── 신고함
--
-- 신고는 0011 에서 표에 쌓이고 0014 에서 메일로 나간다. 그런데 **본 뒤에 무엇을 했는지**
-- 를 적을 자리가 없었다. 메일함에서 읽고 대시보드를 열어 처리한 다음, 그 사실은 아무 데도
-- 안 남는다. 같은 신고를 두 사람이 두 번 보고, 처리한 것과 안 한 것이 섞인다.
--
-- 심사 지침 1.2 는 신고 수단만이 아니라 "제때 응답" 을 요구한다. 응답했다는 것을 셀 수
-- 없으면 제때 했는지도 말할 수 없다.
--
-- 다시 돌려도 깨지지 않게 쓴다 — 칸은 if not exists, 정책·함수·뷰는 먼저 지우고 다시.

alter table public.comment_reports
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users on delete set null;

/**
 * 신고함.
 *
 * 줄 단위를 **신고 건**이 아니라 **댓글**로 둔다. 한 댓글에 열 명이 신고하면 처리할
 * 일은 하나지 열이 아니다. 목록에 열 줄로 뜨면 같은 것을 열 번 판단하게 된다.
 *
 * security_invoker 라 comment_reports 의 정책이 그대로 걸린다. 0011 의 "own or admin
 * select" 때문에 관리자가 아니면 제 신고만 보이고, 그래서 이 뷰는 따로 막지 않아도 된다.
 * (뷰에 붙이는 권한이 아니라 밑에 깔린 표의 권한이 기준이 되게 하는 것이 핵심이다)
 */
drop view if exists public.report_inbox;
create view public.report_inbox
with (security_invoker = true) as
select
  r.comment_id,
  count(*)::int                                   as report_count,
  max(r.created_at)                               as last_reported_at,
  -- 한 건이라도 안 끝났으면 미처리다. 나중에 들어온 신고가 처리를 다시 열어 준다
  bool_and(r.resolved_at is not null)             as resolved,
  -- 빈 사유는 버린다. "사유 없음" 이 목록을 채우면 진짜 사유가 안 보인다
  array_remove(array_agg(distinct nullif(btrim(r.reason), '')), null) as reasons,
  c.subject_type,
  c.subject_id,
  c.body,
  c.author,
  c.deleted_at,
  c.created_at                                    as comment_created_at
from public.comment_reports r
join public.comments c on c.id = r.comment_id
group by r.comment_id, c.subject_type, c.subject_id, c.body, c.author, c.deleted_at, c.created_at;

/**
 * 처리 표시.
 *
 * 표에 update 권한을 열지 않고 함수로만 닫아 둔다. 열어 두면 신고한 사람이 제 신고를
 * 스스로 처리 완료로 바꿀 수 있다 — 정책은 "내 것" 까지 허용하기 때문이다.
 *
 * 아직 안 끝난 것만 건드린다. 이미 끝난 건의 시각과 처리자를 덮어쓰면 언제 처음
 * 처리했는지가 사라진다.
 */
create or replace function public.resolve_report(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다';
  end if;

  update public.comment_reports
     set resolved_at = now(),
         resolved_by = auth.uid()
   where comment_id = p_comment_id
     and resolved_at is null;
end;
$$;

revoke all on function public.resolve_report(uuid) from public, anon;
grant execute on function public.resolve_report(uuid) to authenticated;

-- ─────────────────────────────────────────── 누가 지웠는지
--
-- 지워진 댓글 자리에 "지워진 댓글입니다" 만 뜨면, 글쓴이가 스스로 내린 것인지 관리자가
-- 걷어낸 것인지 읽는 사람이 알 수 없다. 둘은 전혀 다른 일이다 — 뒤쪽은 규칙을 어겨
-- 치워진 것이므로 그렇게 보여야 다른 사람도 무엇이 걸리는지 안다.
--
-- 지운 **사람**을 남기지 않고 관리자였는지 아닌지만 남긴다. 누가 걷어냈는지가 글쓴이에게
-- 알려지면 그 사람에게 화살이 간다. 필요한 정보는 "관리자였다" 까지다.
--
-- 값은 트리거가 정한다. 앱이 보내는 값은 무시한다 — 지우는 길은 update(deleted_at) 하나라
-- 본인이 제 손으로 "관리자가 지웠다" 라고 적어 보낼 수도 있기 때문이다.

alter table public.match_comments
  add column if not exists deleted_by_admin boolean not null default false;

create or replace function public.mark_comment_deleter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    -- 지워지는 그 순간에만 정한다. 글쓴이 본인이 아니면 관리자다 (RLS 가 그 둘만 통과시킨다)
    new.deleted_by_admin := auth.uid() is distinct from new.author;
  else
    -- 그 밖의 수정에서는 앱이 무슨 값을 보내든 두지 않는다
    new.deleted_by_admin := old.deleted_by_admin;
  end if;
  return new;
end
$$;

drop trigger if exists match_comments_mark_deleter on public.match_comments;
create trigger match_comments_mark_deleter
  before update on public.match_comments
  for each row execute function public.mark_comment_deleter();

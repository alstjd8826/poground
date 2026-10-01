-- ─────────────────────────────────────────── 신고·좋아요 규칙 다듬기
--
-- 1. 자기 글은 신고하지 못한다. 앱은 내 글에 신고를 띄우지 않지만 직접 부르면 운영자 신고함과 메일이 찼다.
-- 2. 지운 댓글에는 좋아요를 누르지 못한다. 앱은 지운 댓글에 하트를 두지 않지만 직접 넣으면 수가 올랐다.
-- 3. 신고된 글은 나만 보기로 바뀌어도 운영자가 읽는다(2026-09-29 결정). 안 그러면 신고함에서 눌러도 "볼 수
--    없는 글" 이 떠 판단할 수 없었다. 신고가 없는 나만 보기 글은 운영자도 못 본다 — "나만 보기는 본인만" 을
--    신고된 글 말고는 넓히지 않는다. 글·댓글·사진 읽기가 모두 can_read_post 계열을 따르므로 거기서 한 번에 연다.
--    신고를 다 처리하면 다시 본인만 본다. 운영자 갈래는 읽기뿐이다 — 쓰기(댓글·좋아요·신고)는 can_write_post 로
--    따로 보아, 운영자가 남의 나만 보기 글에 흔적을 남기지 못한다.
-- 4. 댓글 신고는 볼 수 있는 남의 댓글만. 댓글 신고도 글을 운영자에게 여는 열쇠라, 나만 보기로 바뀐 글의 댓글
--    id 를 알던 사람이 신고해 그 글을 열 수 있었다.
--
-- 다시 돌려도 깨지지 않게 쓴다.

-- ── 처리 안 된 신고가 있는 글인가. 글 신고거나, 그 글에 달린 댓글의 신고거나
create or replace function public.post_is_reported(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.post_reports r where r.post_id = p_id and r.resolved_at is null)
      or exists (
        select 1 from public.comment_reports r
        join public.comments c on c.id = r.comment_id
        where c.subject_type = 'post' and c.subject_id = p_id::text and r.resolved_at is null
      );
$$;

create or replace function public.can_read_post(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_id
      and (
        (p.visibility = 'public' and p.deleted_at is null)
        or p.author = auth.uid()
        or (public.is_admin() and p.deleted_at is null and public.post_is_reported(p.id))
      )
  );
$$;

-- ── 글에 댓글·좋아요·신고를 남길 수 있는가. 읽기(can_read_post)에서 운영자 갈래를 뺀 것 — 0023 의 옛 읽기 규칙
create or replace function public.can_write_post(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_id
      and p.deleted_at is null
      and (p.visibility = 'public' or p.author = auth.uid())
  );
$$;

drop policy if exists "own like" on public.post_likes;
create policy "own like" on public.post_likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_write_post(post_id));

drop policy if exists "own insert" on public.comments;
create policy "own insert" on public.comments
  for insert to authenticated
  with check (
    auth.uid() = author
    and case when subject_type = 'post' then public.can_write_post(subject_id::uuid) else true end
  );

-- 글 읽기에도 운영자 갈래를 더한다. can_read_post() 를 부르지 않고 칸으로 적는다 — 그 함수는 글을 다시 찾아
-- 보는데, 새 글을 넣는 그 순간(save_post 의 insert … returning)에는 넣고 있는 글이 아직 안 보여 새 글 쓰기가
-- RLS 에 막혔다
drop policy if exists "public or own select" on public.posts;
create policy "public or own select" on public.posts
  for select to anon, authenticated
  using (
    (visibility = 'public' and deleted_at is null)
    or author = auth.uid()
    or (public.is_admin() and deleted_at is null and public.post_is_reported(id))
  );

create or replace function public.can_read_post_photo(p_owner text, p_post text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_post ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then exists (
      select 1 from public.posts p
      where p.id = p_post::uuid
        and p.author::text = p_owner
        and public.can_read_post(p.id)
    )
    else false
  end;
$$;

-- ── 자기 글 신고 막기
drop policy if exists "own insert" on public.post_reports;
create policy "own insert" on public.post_reports
  for insert to authenticated
  with check (
    reporter = auth.uid()
    and public.can_write_post(post_id)
    and not exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
  );

-- ── 지운 댓글 좋아요 막기
drop policy if exists "own like" on public.comment_likes;
create policy "own like" on public.comment_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.comments c where c.id = comment_id and c.deleted_at is null)
  );

-- ── 댓글 신고는 볼 수 있는 남의 댓글만. exists 가 부른 사람의 댓글 읽기 정책을 타므로 그대로 읽기 검사가 된다.
-- 운영자 갈래로 보이는 댓글은 글이 이미 신고된 것이라 새로 열리는 것이 없다
drop policy if exists "own insert" on public.comment_reports;
create policy "own insert" on public.comment_reports
  for insert to authenticated
  with check (
    auth.uid() = reporter
    and exists (select 1 from public.comments c where c.id = comment_id and c.author <> auth.uid())
  );

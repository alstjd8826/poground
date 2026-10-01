-- ─────────────────────────────────────────── 커뮤니티
--
-- 직관 글과 자유 글. 사진 4장까지, 글마다 전체 공개 / 나만 보기. 읽기는 누구나.
-- 공개 설정은 게시글의 칸 하나다. 사진은 비공개 버킷 하나에 두고, 읽기 정책이 그 사진이
-- 속한 글의 공개 여부를 본다 — 설정을 바꿔도 파일은 옮기지 않는다.
--
-- 지우기는 소프트 삭제다(deleted_at). 신고를 처리한 기록이 남아야 한다 — 댓글과 같다.
-- matches 와 외래키로 묶지 않는다(0022 와 같은 이유).
--
-- 다시 돌려도 깨지지 않게 쓴다.

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  author          uuid not null references auth.users on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 1000),
  visibility      text not null default 'public' check (visibility in ('public', 'private')),
  match_year      int,
  match_league_id int,
  match_game_id   int,
  deleted_at      timestamptz,
  deleted_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint posts_match_all_or_none check (
    (match_year is null and match_league_id is null and match_game_id is null)
    or (match_year is not null and match_league_id is not null and match_game_id is not null)
  )
);

-- 피드는 최신순으로 끊어 받는다. 같은 시각이 겹치면 id 로 가른다
create index if not exists posts_feed_idx on public.posts (created_at desc, id desc)
  where visibility = 'public' and deleted_at is null;
create index if not exists posts_author_idx on public.posts (author, created_at desc);

alter table public.posts enable row level security;

-- 이 글을 지금 사람이 읽을 수 있는가. 사진·댓글·좋아요 정책이 모두 이것을 부른다
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
      and ((p.visibility = 'public' and p.deleted_at is null) or p.author = auth.uid())
  );
$$;

drop policy if exists "public or own select" on public.posts;
create policy "public or own select" on public.posts
  for select to anon, authenticated
  using ((visibility = 'public' and deleted_at is null) or author = auth.uid());

drop policy if exists "own insert" on public.posts;
create policy "own insert" on public.posts
  for insert to authenticated with check (author = auth.uid());

-- 고치기는 본인만. 관리자의 지우기는 admin_delete_post() 로만 한다 — 지운 글은 읽기 정책을
-- 통과하지 못해 관리자가 update 로 지우면 RLS 오류가 난다. 읽기 정책에 관리자를 넣으면 관리자가
-- 나만 보기 글을 보게 되는데, 그건 "나만 보기면 본인만" 과 어긋난다
drop policy if exists "own or admin update" on public.posts;
drop policy if exists "own update" on public.posts;
create policy "own update" on public.posts
  for update to authenticated
  using (author = auth.uid())
  with check (author = auth.uid());

/*
  앱이 무엇을 보내든 서버가 지키는 것.
  · 작성 시각은 서버가 정한다. 안 그러면 created_at 을 앞날로 박아 피드 맨 위에 고정할 수 있다
  · 작성자는 바뀌지 않는다
  · 지운 사람(deleted_by)은 지우는 그 순간에만 적는다 — "관리자가 지웠다" 를 꾸미지 못하게
  · 한 번 지운 글은 되살리지 못한다. 관리자가 내린 글을 작성자가 다시 올리지 못하게
  · 관리자는 남의 글 내용을 고치지 못한다(지우기만)
*/
create or replace function public.posts_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.deleted_at := null;
    new.deleted_by := null;
    return new;
  end if;

  new.author := old.author;
  new.created_at := old.created_at;

  if auth.uid() is distinct from old.author and (
    new.body is distinct from old.body
    or new.visibility is distinct from old.visibility
    or new.match_year is distinct from old.match_year
    or new.match_league_id is distinct from old.match_league_id
    or new.match_game_id is distinct from old.match_game_id
  ) then
    raise exception '남의 글은 고칠 수 없습니다';
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_at := now();
    new.deleted_by := auth.uid();
  elsif old.deleted_at is not null and new.deleted_at is null then
    raise exception '지운 글은 되살릴 수 없습니다';
  else
    new.deleted_at := old.deleted_at;
    new.deleted_by := old.deleted_by;
  end if;
  return new;
end
$$;

drop trigger if exists posts_guard on public.posts;
create trigger posts_guard
  before insert or update on public.posts
  for each row execute function public.posts_guard();

/** 관리자가 글을 내린다. 읽기 정책을 거치지 않도록 security definer 로 돈다 */
create or replace function public.admin_delete_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 글을 내릴 수 있습니다';
  end if;
  update public.posts set deleted_at = now() where id = p_id and deleted_at is null;
end
$$;

revoke all on function public.admin_delete_post(uuid) from public, anon;
grant execute on function public.admin_delete_post(uuid) to authenticated;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- ── 사진 ─────────────────────────────────────

create table if not exists public.post_photos (
  post_id  uuid not null references public.posts on delete cascade,
  position int  not null check (position between 0 and 3),
  path     text not null,
  primary key (post_id, position)
);

alter table public.post_photos enable row level security;

drop policy if exists "readable post" on public.post_photos;
create policy "readable post" on public.post_photos
  for select to anon, authenticated using (public.can_read_post(post_id));

-- 사진 행은 자기 경로만 가리킨다. 안 그러면 남의 파일 경로를 내 글 사진으로 적을 수 있다
drop policy if exists "own post write" on public.post_photos;
create policy "own post write" on public.post_photos
  for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid()))
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
    and path = auth.uid()::text || '/' || post_id::text || '/' || position::text
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 5 * 1024 * 1024, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 경로 {uid}/{postId}/{position}. 파일이 **그 글쓴이의 폴더**에 있고 글을 읽을 수 있을 때만
-- 읽는다. 첫 칸을 안 보면 남의 공개 글 id 를 제 폴더에 붙여 올려 그 글 이름으로 파일을 걸 수 있다.
-- uuid 모양은 엄격하게 본다 — 느슨하면 대시 36개 같은 이름이 형 변환에서 오류를 내 목록 조회를 깬다
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
        and ((p.visibility = 'public' and p.deleted_at is null) or p.author = auth.uid())
    )
    else false
  end;
$$;

drop policy if exists "post-photos readable" on storage.objects;
create policy "post-photos readable" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'post-photos'
    and public.can_read_post_photo((storage.foldername(name))[1], (storage.foldername(name))[2])
  );

drop policy if exists "post-photos self insert" on storage.objects;
create policy "post-photos self insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post-photos self update" on storage.objects;
create policy "post-photos self update" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post-photos self delete" on storage.objects;
create policy "post-photos self delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 좋아요 ────────────────────────────────────
-- 누르기는 3단계에서 붙인다. 표와 정책은 여기서 둔다 — 통계 뷰가 개수를 센다

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;

-- 볼 수 있는 글의 좋아요만 읽는다. 안 그러면 나만 보기로 바뀐 글에 누가 눌렀는지가 보인다
drop policy if exists "read all" on public.post_likes;
drop policy if exists "readable post" on public.post_likes;
create policy "readable post" on public.post_likes
  for select to anon, authenticated using (public.can_read_post(post_id));
drop policy if exists "own like" on public.post_likes;
create policy "own like" on public.post_likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_read_post(post_id));
drop policy if exists "own unlike" on public.post_likes;
create policy "own unlike" on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- 댓글 좋아요는 그 댓글을 읽을 수 있을 때만. 아래 exists 는 부르는 사람의 권한으로 돌아
-- 댓글 읽기 정책을 그대로 탄다 — 나만 보기 글의 댓글이면 걸러진다
drop policy if exists "read all" on public.comment_likes;
drop policy if exists "readable comment" on public.comment_likes;
create policy "readable comment" on public.comment_likes
  for select to anon, authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));
drop policy if exists "own like" on public.comment_likes;
create policy "own like" on public.comment_likes
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.comments c where c.id = comment_id));
drop policy if exists "own unlike" on public.comment_likes;
create policy "own unlike" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

-- 피드가 글마다 좋아요·댓글 수를 한 번에 받는다. 지운 댓글은 세지 않는다.
-- security_invoker: 부르는 사람의 권한으로 돈다 — 볼 수 없는 글의 수는 새지 않는다
create or replace view public.post_stats with (security_invoker = true) as
select
  p.id as post_id,
  (select count(*) from public.post_likes l where l.post_id = p.id)::int as like_count,
  (select count(*) from public.comments c
    where c.subject_type = 'post' and c.subject_id = p.id::text and c.deleted_at is null)::int as comment_count
from public.posts p;

-- ── 댓글 대상 ──────────────────────────────────

-- 게시글 댓글의 대상은 uuid 여야 한다. 아래 정책이 uuid 로 바꾸므로, 모양이 틀린 한 줄이 들어가면
-- 댓글 조회가 사람을 가리지 않고 오류로 멈출 수 있다
alter table public.comments drop constraint if exists comments_post_subject_uuid;
alter table public.comments
  add constraint comments_post_subject_uuid check (subject_type <> 'post' or subject_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

alter table public.comments drop constraint if exists comments_subject_known;
alter table public.comments
  add constraint comments_subject_known check (subject_type in ('match', 'player', 'news', 'post'));

-- 기존 읽기 정책은 누구나(using true)였다. 게시글 댓글은 그 글을 읽을 수 있을 때만 읽는다 —
-- 안 그러면 나만 보기 글의 댓글이 남에게 새어 나간다.
-- case 를 쓰는 이유: or 는 계산 순서를 보장하지 않아, 경기 댓글의 id('180')를 uuid 로
-- 바꾸려다 오류가 날 수 있다. case 는 앞 조건이 맞을 때만 뒤를 계산한다
drop policy if exists "read all" on public.comments;
create policy "read all" on public.comments
  for select to anon, authenticated
  using (case when subject_type = 'post' then public.can_read_post(subject_id::uuid) else true end);

drop policy if exists "own insert" on public.comments;
create policy "own insert" on public.comments
  for insert to authenticated
  with check (
    auth.uid() = author
    and case when subject_type = 'post' then public.can_read_post(subject_id::uuid) else true end
  );

-- ─────────────────────────────────────────── 경기 댓글
--
-- 다시 돌려도 깨지지 않게 썼다. 표와 인덱스는 if not exists 로, 정책과 트리거는
-- 먼저 지우고 다시 만든다 — 둘 다 "있으면 넘어가기" 문법이 없다.
--
-- 경기 상세에서 서로 이야기하는 자리. 팬카드와 달리 **남이 쓴 것도 보여야** 하므로
-- 읽기를 통째로 연다 — 로그인하지 않아도 읽힌다. 쓰는 것만 로그인을 요구한다.
--
-- 앱스토어 심사 지침 1.2 는 사용자가 쓴 글을 싣는 앱에 신고 수단과 차단 수단을
-- 요구한다. 나중에 붙이면 리젝을 한 번 맞고 붙이게 되므로 여기서 같이 만든다.

-- ─────────────────────────────── 관리자 표시
--
-- 남의 글을 지울 수 있는 사람. 신고가 들어왔을 때 손쓸 길이 없으면 신고 기능이
-- 형식만 갖춘 것이 된다. 값은 대시보드에서 직접 켠다 — 앱에서 켜는 길은 두지 않는다.
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ─────────────────────────────── 댓글

create table if not exists public.match_comments (
  id         uuid primary key default gen_random_uuid(),
  match_id   integer not null,
  author     uuid not null references auth.users on delete cascade,
  /**
   * 대댓글이면 부모. 한 단만 받는다 — 답글의 답글까지 받으면 화면에서 들여쓰기가
   * 끝없이 깊어진다. 그건 앱이 막고, 여기서는 구조만 열어 둔다.
   */
  parent_id  uuid references public.match_comments on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  /**
   * 지운 시각. 행을 지우지 않고 표시만 남긴다.
   *
   * 답글이 달린 댓글을 통째로 지우면 남이 쓴 답글까지 사라진다. 그래서 자리는 남기고
   * "지워진 댓글" 로 보여 준다. 답글이 없는 댓글도 같은 방식으로 다뤄야 규칙이 하나다.
   */
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 한 경기의 댓글을 시간 순으로. 대댓글은 부모별로 모아 읽는다
create index if not exists match_comments_match_idx
  on public.match_comments (match_id, created_at);
create index if not exists match_comments_parent_idx
  on public.match_comments (parent_id, created_at);

alter table public.match_comments enable row level security;

-- 읽기는 누구나. 로그인하지 않은 사람도 경기 이야기를 볼 수 있어야 한다
drop policy if exists "read all" on public.match_comments;
create policy "read all" on public.match_comments
  for select to anon, authenticated using (true);

drop policy if exists "own insert" on public.match_comments;
create policy "own insert" on public.match_comments
  for insert to authenticated with check (auth.uid() = author);

-- 고치는 것은 본인만. 지우기도 update(deleted_at)로 하므로 관리자도 여기로 들어온다
drop policy if exists "own or admin update" on public.match_comments;
create policy "own or admin update" on public.match_comments
  for update to authenticated
  using (auth.uid() = author or public.is_admin())
  with check (auth.uid() = author or public.is_admin());

drop trigger if exists match_comments_touch_updated_at on public.match_comments;
create trigger match_comments_touch_updated_at
  before update on public.match_comments
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────── 신고
--
-- 같은 사람이 같은 글을 여러 번 신고해도 한 건으로 남는다. 신고한 사람은 제 신고만
-- 보고, 모아서 보는 것은 관리자 몫이다.

create table if not exists public.comment_reports (
  comment_id uuid not null references public.match_comments on delete cascade,
  reporter   uuid not null references auth.users on delete cascade,
  reason     text not null default '',
  created_at timestamptz not null default now(),
  primary key (comment_id, reporter)
);

alter table public.comment_reports enable row level security;

drop policy if exists "own insert" on public.comment_reports;
create policy "own insert" on public.comment_reports
  for insert to authenticated with check (auth.uid() = reporter);

drop policy if exists "own or admin select" on public.comment_reports;
create policy "own or admin select" on public.comment_reports
  for select to authenticated using (auth.uid() = reporter or public.is_admin());

-- ─────────────────────────────── 차단
--
-- 차단은 **내 쪽에서만** 안 보이게 하는 것이다. 차단당한 사람은 자기가 차단됐는지
-- 알 수 없어야 하므로, 이 표는 차단한 사람만 읽는다.

create table if not exists public.user_blocks (
  blocker    uuid not null references auth.users on delete cascade,
  blocked    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint user_blocks_not_self check (blocker <> blocked)
);

alter table public.user_blocks enable row level security;

drop policy if exists "own all" on public.user_blocks;
create policy "own all" on public.user_blocks
  for all to authenticated
  using (auth.uid() = blocker)
  with check (auth.uid() = blocker);

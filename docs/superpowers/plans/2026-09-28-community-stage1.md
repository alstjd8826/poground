# 커뮤니티 1단계(DB 와 읽기) — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 커뮤니티의 표·버킷·정책을 만들고, 소식 탭 자리를 커뮤니티 탭으로 바꿔(소식·영상은 홈에서 들어가는 목록으로) 공개 글 피드와 글 상세(사진 넘기기·댓글)를 읽을 수 있게 한다. 쓰기는 2단계다.

**Architecture:** `posts`·`post_photos` 와 비공개 버킷 `post-photos`. 버킷의 읽기 정책이 사진이 속한 글의 공개 여부를 본다. 앱은 공개 글을 20개씩 최신순으로 받고(작성 시각 커서), 글쓴이 프로필과 통계(좋아요·댓글 수)를 따로 받아 합친다 — 댓글 저장소와 같은 방식. 사진은 기존 `privateImage` 해석기로 받는다. 댓글은 `comments` 의 대상 종류에 `post` 를 더해 기존 목록을 그대로 쓴다.

**Tech Stack:** Expo 57, React Native, `@tanstack/react-query` 5(`useInfiniteQuery`), `@supabase/supabase-js` 2.116, `react-native-svg`, jest(jest-expo).

**Spec:** `docs/superpowers/specs/2026-09-28-community-design.md` (이 계획은 "나눠서 만들기" 의 1단계만)

## Global Constraints

- 본문 `char_length(btrim(body)) between 1 and 1000`
- `visibility` 는 `'public'` / `'private'`, 기본 `'public'`
- 직관 글의 경기 키 세 칸은 다 있거나 다 없다
- 사진은 글당 최대 4장(`position` 0~3), 경로 `{uid}/{postId}/{position}`, 버킷 `post-photos` 비공개·5MB·jpeg/png
- 읽기는 누구나(로그인 없이도), 쓰기·좋아요·댓글은 로그인
- 커뮤니티 피드에는 공개 글만. 나만 보기 글은 내가 열 때만 보이고 자물쇠(벡터 아이콘, 테마 색)가 붙는다
- 피드: 최신순, `[전체 · 직관 · 자유]`, 20개씩
- 커뮤니티 탭은 커뮤니티 피드만. 소식·영상은 탭에서 빼고 홈의 "더 보기" 로 들어가는 목록 화면(`NewsList`, `VideoList`). 탭바 이름 "커뮤니티"
- `posts` 는 `matches` 와 외래키로 묶지 않는다
- 코드 형식: prettier `printWidth 110`, `arrowParens avoid`, 앱 코드는 세미콜론 없음. 한국어 주석은 둘레 코드와 같은 밀도
- 커밋 메시지는 한국어 제목 + 이유를 적은 본문 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- migration 은 API 로 못 돌린다(403). SQL Editor 에 붙여 넣을 파일을 만든다

## Review Focus

- 나만 보기 글의 사진을 로그인 없이, 또는 다른 계정으로 열려 함 → 막혀야 한다 (Task 8 curl 실측: 공개 글 사진은 열리고 나만 보기는 막힘)
- 나만 보기 글에 남이 댓글을 달거나 댓글을 읽으려 함 → 막혀야 한다. 기존 댓글 읽기 정책은 `using (true)` 라 그대로 두면 새어 나간다 (Task 1 정책, Task 8 실측)
- 피드를 끝까지 내리다 같은 시각에 쓴 글이 쪽 경계에 걸림 → 빠지거나 두 번 보이면 안 된다 (Task 3: 커서가 `created_at` 과 `id` 를 함께 본다)
- 차단한 사람의 글 → 피드와 상세에서 가려져야 한다 (Task 4)
- 글쓴이가 프로필을 아직 안 만듦(닉네임 전) → 카드가 깨지지 않고 "알 수 없음" 으로 나와야 한다 (Task 5)

---

## 파일 구조

| 파일                                                    | 책임                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `supabase/migrations/0023_community.sql` (신규)         | 표, 정책, 버킷, 좋아요 표, 통계 뷰, 댓글 대상 확장                |
| `src/utils/relativeTime.ts` (신규)                      | "방금 / N분 전 / N시간 전 / N일 전 / M.D" (댓글 목록에서 떼어 냄) |
| `src/models/community.ts` (신규)                        | `Post`, `PostPhoto`, `FeedFilter`, 커서, 차단 거르기              |
| `src/repositories/community/remote.ts` (신규)           | 피드 한 쪽, 글 하나                                               |
| `src/hooks/community/useCommunity.ts` (신규)            | 피드 무한 질의, 글 질의, 사진 파일 해석, 차단 목록                |
| `src/components/community/LockIcon.tsx` (신규)          | 자물쇠 벡터 아이콘                                                |
| `src/components/community/PostCard.tsx` (신규)          | 피드 카드                                                         |
| `src/screens/CommunityScreen.tsx` (신규)                | 거르개와 피드                                                     |
| `src/screens/PostDetailScreen.tsx` (신규)               | 사진 넘기기, 본문, 댓글                                           |
| `src/repositories/comment/remote.ts`                    | `CommentSubject.type` 에 `'post'`                                 |
| `src/hooks/comment/useComments.ts`                      | 차단 목록 질의 열쇠 내보내기                                      |
| `src/navigation/*`, `src/screens/MediaScreen.tsx`(삭제) | 커뮤니티 탭, 소식·영상 목록 라우트, 탭바 이름, `Post` 라우트      |

---

### Task 1: migration 파일

**Files:**

- Create: `supabase/migrations/0023_community.sql`

- [ ] **Step 1: 파일을 쓴다**

```sql
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

-- 고치기는 본인. 관리자는 지우기(deleted_at) 때문에 들어온다 — 댓글과 같다
drop policy if exists "own or admin update" on public.posts;
create policy "own or admin update" on public.posts
  for update to authenticated
  using (author = auth.uid() or public.is_admin())
  with check (author = auth.uid() or public.is_admin());

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

drop policy if exists "own post write" on public.post_photos;
create policy "own post write" on public.post_photos
  for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 5 * 1024 * 1024, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 경로 {uid}/{postId}/{position}. 둘째 칸이 글이다. 글을 읽을 수 있으면 사진도 읽는다
drop policy if exists "post-photos readable" on storage.objects;
create policy "post-photos readable" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'post-photos'
    -- or/and 는 계산 순서를 보장하지 않는다. uuid 로 바꾸기 전에 모양을 보려면 case 를 쓴다
    and case
      when (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
        then public.can_read_post(((storage.foldername(name))[2])::uuid)
      else false
    end
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

drop policy if exists "read all" on public.post_likes;
create policy "read all" on public.post_likes for select to anon, authenticated using (true);
drop policy if exists "own like" on public.post_likes;
create policy "own like" on public.post_likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_read_post(post_id));
drop policy if exists "own unlike" on public.post_likes;
create policy "own unlike" on public.post_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "read all" on public.comment_likes;
create policy "read all" on public.comment_likes for select to anon, authenticated using (true);
drop policy if exists "own like" on public.comment_likes;
create policy "own like" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
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
```

- [ ] **Step 2: 확인한다**

Run: `cd steelers-app && grep -c "create policy" supabase/migrations/0023_community.sql && grep -n "match_comments" supabase/migrations/0023_community.sql`
Expected: `17`, 두 번째 grep 은 결과 없음 (옛 표 이름을 쓰지 않는다)

- [ ] **Step 3: 커밋 (브랜치 feat/community)**

```bash
git add supabase/migrations/0023_community.sql
git commit -m "커뮤니티 게시글 표와 사진 버킷을 둔다"
```

---

### Task 2: 상대 시간을 공용으로 뗀다

**Files:**

- Create: `src/utils/relativeTime.ts`
- Modify: `src/components/comment/CommentList.tsx` (311-323행 `when` 을 지우고 import)
- Test: `__tests__/relative-time.test.ts`

**Interfaces:**

- Produces: `relativeTime(iso: string, now?: number): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { relativeTime } from '@/utils/relativeTime'

const NOW = new Date('2026-09-28T12:00:00+09:00').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('상대 시간', () => {
  it.each([
    [30_000, '방금'],
    [5 * 60_000, '5분 전'],
    [3 * 3_600_000, '3시간 전'],
    [2 * 86_400_000, '2일 전'],
  ])('%p ms 전은 %s', (ms, text) => {
    expect(relativeTime(ago(ms), NOW)).toBe(text)
  })

  it('일주일이 넘으면 날짜로', () => {
    expect(relativeTime('2026-09-10T12:00:00+09:00', NOW)).toBe('9.10')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/relative-time.test.ts`
Expected: FAIL — `Cannot find module '@/utils/relativeTime'`

- [ ] **Step 3: 구현하고 댓글 목록이 쓰게 한다**

```ts
/**
 * "방금 / N분 전 / N시간 전 / N일 전", 일주일이 넘으면 "M.D".
 *
 * 댓글과 게시글은 방금 쓴 것이 대부분이라 날짜보다 이쪽이 읽힌다.
 */
export function relativeTime(iso: string, now = Date.now()): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}일 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()}`
}
```

`CommentList.tsx` 의 `/** 방금 쓴 것이 대부분이라 … */ function when(...) { … }` 를 통째로 지우고, `when(comment.createdAt)` 을 `relativeTime(comment.createdAt)` 로 바꾸고, `import { relativeTime } from '@/utils/relativeTime'` 를 더한다.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/relative-time.test.ts && npx jest && npx tsc --noEmit`
Expected: PASS, 전체 스위트 그대로

- [ ] **Step 5: 커밋**

```bash
git add src/utils/relativeTime.ts src/components/comment/CommentList.tsx __tests__/relative-time.test.ts
git commit -m "상대 시간 표시를 댓글과 게시글이 함께 쓰게 뗀다"
```

---

### Task 3: 모델과 저장소

**Files:**

- Create: `src/models/community.ts`
- Create: `src/repositories/community/remote.ts`
- Modify: `src/repositories/comment/remote.ts:29-32` (`CommentSubject.type` 에 `'post'`)
- Test: `__tests__/community-model.test.ts`

**Interfaces:**

- Produces (`models/community.ts`):
  - `type Visibility = 'public' | 'private'`
  - `type FeedFilter = 'all' | 'attendance' | 'free'`
  - `interface PostPhoto { position: number; path: string }`
  - `interface PostMatchKey { year: number; leagueId: number; gameId: number }`
  - `interface Post { id: string; authorId: string; handle: string | null; nickname: string | null; avatarUrl: string | null; body: string; visibility: Visibility; match: PostMatchKey | null; photos: PostPhoto[]; likeCount: number; commentCount: number; createdAt: string; updatedAt: string }`
  - `interface FeedCursor { createdAt: string; id: string }`
  - `FEED_PAGE = 20`
  - `nextCursor(page: Post[]): FeedCursor | null` — 한 쪽이 꽉 찼을 때만 마지막 글
  - `withoutBlocked(posts: Post[], blocked: string[]): Post[]`
  - `POST_PHOTO_BUCKET = 'post-photos'`
- Produces (`repositories/community/remote.ts`):
  - `interface PostRow`, `interface PostProfileRow`, `interface PostStatsRow`
  - `toPost(row: PostRow, profiles: Map<string, PostProfileRow>, stats: Map<string, PostStatsRow>): Post`
  - `listFeed(filter: FeedFilter, cursor: FeedCursor | null): Promise<Post[]>`
  - `getPost(id: string): Promise<Post | null>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { FEED_PAGE, nextCursor, type Post, withoutBlocked } from '@/models/community'
import { toPost } from '@/repositories/community/remote'

jest.mock('@/repositories/remote/supabase', () => ({ supabase: {} }))

const post = (id: string, createdAt: string, authorId = 'a'): Post => ({
  id,
  authorId,
  handle: null,
  nickname: null,
  avatarUrl: null,
  body: '글',
  visibility: 'public',
  match: null,
  photos: [],
  likeCount: 0,
  commentCount: 0,
  createdAt,
  updatedAt: createdAt,
})

describe('다음 쪽', () => {
  it('한 쪽이 꽉 차면 마지막 글이 커서가 된다', () => {
    const page = Array.from({ length: FEED_PAGE }, (_, i) =>
      post(`p${i}`, `2026-09-28T00:00:${String(59 - i).padStart(2, '0')}Z`),
    )
    expect(nextCursor(page)).toEqual({
      createdAt: page[FEED_PAGE - 1]!.createdAt,
      id: page[FEED_PAGE - 1]!.id,
    })
  })

  it('덜 차면 끝이다', () => {
    expect(nextCursor([post('p1', '2026-09-28T00:00:00Z')])).toBeNull()
  })
})

describe('차단', () => {
  it('차단한 사람의 글은 뺀다', () => {
    const posts = [post('1', 'x', 'kim'), post('2', 'x', 'lee')]
    expect(withoutBlocked(posts, ['lee']).map(p => p.id)).toEqual(['1'])
  })
})

describe('행 옮기기', () => {
  const row = {
    id: 'p1',
    author: 'u1',
    body: '직관 다녀왔어요',
    visibility: 'private' as const,
    match_year: 2026,
    match_league_id: 1,
    match_game_id: 180,
    created_at: '2026-09-28T00:00:00Z',
    updated_at: '2026-09-28T01:00:00Z',
    post_photos: [
      { position: 1, path: 'u1/p1/1' },
      { position: 0, path: 'u1/p1/0' },
    ],
  }

  it('사진은 순서대로, 경기는 키로, 통계와 프로필을 붙인다', () => {
    const post = toPost(
      row,
      new Map([['u1', { id: 'u1', handle: 'steel', nickname: '김포항', avatar_url: null }]]),
      new Map([['p1', { post_id: 'p1', like_count: 3, comment_count: 2 }]]),
    )
    expect(post.photos.map(p => p.position)).toEqual([0, 1])
    expect(post.match).toEqual({ year: 2026, leagueId: 1, gameId: 180 })
    expect(post).toMatchObject({
      handle: 'steel',
      nickname: '김포항',
      likeCount: 3,
      commentCount: 2,
      visibility: 'private',
    })
  })

  /** 닉네임을 아직 안 정한 사람의 글도 깨지지 않고 그려져야 한다 */
  it('프로필과 통계가 없어도 옮긴다', () => {
    const post = toPost(
      { ...row, match_year: null, match_league_id: null, match_game_id: null },
      new Map(),
      new Map(),
    )
    expect(post).toMatchObject({ handle: null, nickname: null, likeCount: 0, commentCount: 0, match: null })
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/community-model.test.ts`
Expected: FAIL — `Cannot find module '@/models/community'`

- [ ] **Step 3: `models/community.ts` 를 쓴다**

```ts
/**
 * 커뮤니티 게시글.
 *
 * 직관 글은 경기 키가 있고 자유 글은 없다. 공개 설정은 게시글의 칸 하나이고, 사진은
 * 그 설정을 따라간다 (0023).
 */

export type Visibility = 'public' | 'private'
export type FeedFilter = 'all' | 'attendance' | 'free'

export const POST_PHOTO_BUCKET = 'post-photos'

/** 한 번에 받는 글 수 */
export const FEED_PAGE = 20

export interface PostPhoto {
  position: number
  /** 버킷 안 경로 {uid}/{postId}/{position} */
  path: string
}

export interface PostMatchKey {
  year: number
  leagueId: number
  gameId: number
}

export interface Post {
  id: string
  authorId: string
  /** 프로필을 아직 안 만든 사람이면 null — 화면이 쓸 말을 정한다 */
  handle: string | null
  nickname: string | null
  avatarUrl: string | null
  body: string
  visibility: Visibility
  /** 직관 글이면 경기, 자유 글이면 null */
  match: PostMatchKey | null
  /** position 순서 */
  photos: PostPhoto[]
  likeCount: number
  commentCount: number
  createdAt: string
  /** 사진 캐시 버전으로 쓴다 */
  updatedAt: string
}

/** 다음 쪽을 받을 자리. 같은 시각에 쓴 글이 쪽 경계에 걸려도 빠지거나 겹치지 않게 id 도 본다 */
export interface FeedCursor {
  createdAt: string
  id: string
}

export function nextCursor(page: Post[]): FeedCursor | null {
  if (page.length < FEED_PAGE) return null
  const last = page[page.length - 1]!
  return { createdAt: last.createdAt, id: last.id }
}

/** 차단한 사람의 글을 뺀다. 서버는 남의 차단 목록을 모르므로 앱이 거른다 */
export function withoutBlocked(posts: Post[], blocked: string[]): Post[] {
  if (blocked.length === 0) return posts
  const set = new Set(blocked)
  return posts.filter(p => !set.has(p.authorId))
}
```

- [ ] **Step 4: `repositories/community/remote.ts` 를 쓴다**

```ts
import { supabase } from '@/repositories/remote/supabase'
import { FEED_PAGE, type FeedCursor, type FeedFilter, type Post, type Visibility } from '@/models/community'

/**
 * 게시글을 읽는 곳. 쓰기는 2단계.
 *
 * 글쓴이 프로필과 통계는 따로 받아 합친다 — 댓글 저장소와 같은 방식이다. 게시글은
 * auth.users 를 가리켜 profiles 와 바로 이을 외래키가 없다.
 */

export interface PostRow {
  id: string
  author: string
  body: string
  visibility: Visibility
  match_year: number | null
  match_league_id: number | null
  match_game_id: number | null
  created_at: string
  updated_at: string
  post_photos: { position: number; path: string }[] | null
}

export interface PostProfileRow {
  id: string
  handle: string | null
  nickname: string | null
  avatar_url: string | null
}

export interface PostStatsRow {
  post_id: string
  like_count: number
  comment_count: number
}

const COLUMNS =
  'id,author,body,visibility,match_year,match_league_id,match_game_id,created_at,updated_at,post_photos(position,path)'

export function toPost(
  row: PostRow,
  profiles: Map<string, PostProfileRow>,
  stats: Map<string, PostStatsRow>,
): Post {
  const profile = profiles.get(row.author)
  const stat = stats.get(row.id)
  const hasMatch = row.match_year !== null && row.match_league_id !== null && row.match_game_id !== null
  return {
    id: row.id,
    authorId: row.author,
    handle: profile?.handle ?? null,
    nickname: profile?.nickname ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    body: row.body,
    visibility: row.visibility,
    match: hasMatch
      ? { year: row.match_year!, leagueId: row.match_league_id!, gameId: row.match_game_id! }
      : null,
    photos: [...(row.post_photos ?? [])].sort((a, b) => a.position - b.position),
    likeCount: stat?.like_count ?? 0,
    commentCount: stat?.comment_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 글 목록에 프로필과 통계를 붙인다. 두 번 더 묻는다 — 글이 없으면 묻지 않는다 */
async function hydrate(rows: PostRow[]): Promise<Post[]> {
  if (rows.length === 0) return []
  const authors = [...new Set(rows.map(r => r.author))]
  const ids = rows.map(r => r.id)
  const [profiles, stats] = await Promise.all([
    supabase.from('profiles').select('id,handle,nickname,avatar_url').in('id', authors),
    supabase.from('post_stats').select('post_id,like_count,comment_count').in('post_id', ids),
  ])
  if (profiles.error) throw profiles.error
  if (stats.error) throw stats.error
  const who = new Map((profiles.data as PostProfileRow[]).map(p => [p.id, p]))
  const counts = new Map((stats.data as PostStatsRow[]).map(s => [s.post_id, s]))
  return rows.map(r => toPost(r, who, counts))
}

/**
 * 공개 글 한 쪽. 최신순.
 *
 * 커서는 마지막 글의 (작성 시각, id). 시각만 보면 같은 시각의 글이 쪽 경계에서 빠지거나
 * 두 번 온다. 나만 보기 글은 RLS 가 내 것도 돌려주므로 여기서 공개만 고른다.
 */
export async function listFeed(filter: FeedFilter, cursor: FeedCursor | null): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select(COLUMNS)
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FEED_PAGE)
  if (filter === 'attendance') query = query.not('match_game_id', 'is', null)
  if (filter === 'free') query = query.is('match_game_id', null)
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }
  const { data, error } = await query
  if (error) throw error
  return hydrate((data ?? []) as PostRow[])
}

/** 글 하나. 볼 수 없거나 지워졌으면 null (RLS 가 가린다) */
export async function getPost(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const [post] = await hydrate([data as PostRow])
  return post ?? null
}
```

`src/repositories/comment/remote.ts` 의 `CommentSubject` 를 바꾼다:

```ts
export interface CommentSubject {
  type: 'match' | 'player' | 'news' | 'post'
  id: string
}
```

`src/navigation/deepLink.ts` 가 `Record<CommentSubject['type'], string>` 을 쓰므로 여기서 함께 맞춘다. 신고 메일의 딥링크가 게시글 댓글에도 통하게 된다(`Post` 라우트는 Task 6 이 만든다 — `navigate` 는 이미 문자열로 부르므로 타입이 깨지지 않는다):

```ts
const TAB: Record<CommentSubject['type'], string> = {
  match: 'Competition',
  news: 'Media',
  player: 'Club',
  post: 'Media',
}

function screenFor(subject: CommentSubject) {
  if (subject.type === 'post') return { screen: 'Post', params: { postId: subject.id } }
  // … 기존 갈래 그대로
}

const isSubjectType = (v: unknown): v is CommentSubject['type'] =>
  v === 'match' || v === 'player' || v === 'news' || v === 'post'
```

`__tests__/deep-link.test.ts` 의 `cases` 에 `{ type: 'post', id: '6f1c2c1e-0000-4000-8000-000000000001' }` 를 더한다.

- [ ] **Step 5: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/community-model.test.ts __tests__/deep-link.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/models/community.ts src/repositories/community/remote.ts src/repositories/comment/remote.ts src/navigation/deepLink.ts __tests__/community-model.test.ts __tests__/deep-link.test.ts
git commit -m "공개 게시글을 최신순으로 끊어 읽는다"
```

---

### Task 4: 훅

**Files:**

- Create: `src/hooks/community/useCommunity.ts`
- Modify: `src/hooks/comment/useComments.ts:35-39` (`keys` 를 `export const commentKeys` 로 내보낸다)
- Test: `__tests__/community-hooks.test.tsx`

**Interfaces:**

- Consumes: Task 3 `listFeed`, `getPost`, `withoutBlocked`, `nextCursor`, `POST_PHOTO_BUCKET`; `listBlocked` (`@/repositories/comment/remote`); `resolvePrivateImage` (`@/repositories/remote/privateImage`); `useAuth`
- Produces:
  - `communityKeys = { feed: (filter) => ['community', 'feed', filter], post: (id) => ['community', 'post', id] }`
  - `useCommunityFeed(filter: FeedFilter)` → `{ posts: Post[]; query }` (차단 거른 뒤)
  - `usePost(id: string)` → `{ post: Post | null | undefined; blocked: boolean; query }`
  - `usePostPhoto(post: Post, position: number): string | null`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```tsx
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useCommunityFeed } from '@/hooks/community/useCommunity'
import type { Post } from '@/models/community'

let mockSession: { user: { id: string } } | null = { user: { id: 'me' } }
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: mockSession }) }))
jest.mock('@/repositories/community/remote', () => ({ listFeed: jest.fn(), getPost: jest.fn() }))
jest.mock('@/repositories/comment/remote', () => ({ listBlocked: jest.fn() }))
jest.mock('@/repositories/remote/privateImage', () => ({ resolvePrivateImage: jest.fn(async () => null) }))

const remote = jest.requireMock('@/repositories/community/remote') as { listFeed: jest.Mock }
const comments = jest.requireMock('@/repositories/comment/remote') as { listBlocked: jest.Mock }

const post = (id: string, authorId: string) => ({ id, authorId }) as Post

const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach(c => c.clear())
  clients.length = 0
})
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockSession = { user: { id: 'me' } }
  remote.listFeed.mockReset().mockResolvedValue([post('1', 'kim'), post('2', 'lee')])
  comments.listBlocked.mockReset().mockResolvedValue(['lee'])
})

describe('커뮤니티 피드', () => {
  it('차단한 사람의 글을 가린다', async () => {
    const { result } = renderHook(() => useCommunityFeed('all'), { wrapper })
    await waitFor(() => expect(result.current.posts.map(p => p.id)).toEqual(['1']))
  })

  /** 로그인 전에는 차단 목록이 없다. 그래도 피드는 읽혀야 한다 */
  it('로그인 전에도 읽고 차단 목록은 묻지 않는다', async () => {
    mockSession = null
    const { result } = renderHook(() => useCommunityFeed('all'), { wrapper })
    await waitFor(() => expect(result.current.posts).toHaveLength(2))
    expect(comments.listBlocked).not.toHaveBeenCalled()
  })

  it('거르개를 서버에 넘긴다', async () => {
    renderHook(() => useCommunityFeed('free'), { wrapper })
    await waitFor(() => expect(remote.listFeed).toHaveBeenCalledWith('free', null))
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/community-hooks.test.tsx`
Expected: FAIL — `Cannot find module '@/hooks/community/useCommunity'`

- [ ] **Step 3: `useComments.ts` 의 열쇠를 내보낸다**

`const keys = {` 를 `export const commentKeys = {` 로 바꾸고, 파일 안의 `keys.` 를 모두 `commentKeys.` 로 바꾼다. 차단 목록을 게시글과 댓글이 같은 캐시로 쓰게 하려는 것이다.

- [ ] **Step 4: `useCommunity.ts` 를 쓴다**

```ts
import { useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { useAuth } from '@/hooks/auth/useAuth'
import { commentKeys } from '@/hooks/comment/useComments'
import {
  type FeedCursor,
  type FeedFilter,
  nextCursor,
  type Post,
  POST_PHOTO_BUCKET,
  withoutBlocked,
} from '@/models/community'
import { listBlocked } from '@/repositories/comment/remote'
import { getPost, listFeed } from '@/repositories/community/remote'
import { resolvePrivateImage } from '@/repositories/remote/privateImage'

export const communityKeys = {
  feed: (filter: FeedFilter) => ['community', 'feed', filter] as const,
  post: (id: string) => ['community', 'post', id] as const,
}

const STALE = 30_000

/** 내 차단 목록. 댓글과 같은 캐시를 쓴다. 로그인 전에는 비어 있다 */
function useBlockedIds(): string[] {
  const { session } = useAuth()
  const me = session?.user.id ?? null
  const query = useQuery({
    queryKey: commentKeys.blocked(me),
    queryFn: listBlocked,
    enabled: me !== null,
    staleTime: STALE,
  })
  return (me !== null && query.data) || []
}

/** 공개 글 피드. 차단한 사람의 글은 앱이 거른다 */
export function useCommunityFeed(filter: FeedFilter) {
  const blocked = useBlockedIds()
  const query = useInfiniteQuery({
    queryKey: communityKeys.feed(filter),
    queryFn: ({ pageParam }) => listFeed(filter, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: last => nextCursor(last),
    staleTime: STALE,
  })
  const posts = useMemo(() => withoutBlocked(query.data?.pages.flat() ?? [], blocked), [query.data, blocked])
  return { posts, query }
}

/** 글 하나. 볼 수 없거나 지워졌으면 null. 차단한 사람의 글이면 blocked */
export function usePost(id: string) {
  const blocked = useBlockedIds()
  const query = useQuery({ queryKey: communityKeys.post(id), queryFn: () => getPost(id), staleTime: STALE })
  const post = query.data
  return { post, blocked: post ? blocked.includes(post.authorId) : false, query }
}

/** 글의 사진 한 장을 기기 캐시 파일로. 없거나 못 받았으면 null */
export function usePostPhoto(post: Post, position: number): string | null {
  const photo = post.photos.find(p => p.position === position)
  const path = photo?.path ?? null
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setUri(null)
      return
    }
    let alive = true
    void resolvePrivateImage({ bucket: POST_PHOTO_BUCKET, path, version: post.updatedAt }).then(next => {
      if (alive) setUri(next)
    })
    return () => {
      alive = false
    }
  }, [path, post.updatedAt])

  return uri
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/community-hooks.test.tsx && npx jest && npx tsc --noEmit && npm run lint`
Expected: PASS. react-query 알림이 한 박자 늦으므로(setTimeout 0) 화면 값 확인은 `waitFor` 로 한다 — 테스트가 이미 그렇게 쓰여 있다

- [ ] **Step 6: 커밋**

```bash
git add src/hooks/community/useCommunity.ts src/hooks/comment/useComments.ts __tests__/community-hooks.test.tsx
git commit -m "커뮤니티 피드와 글을 차단한 사람을 가려 읽는다"
```

---

### Task 5: 피드 카드

**Files:**

- Create: `src/components/community/LockIcon.tsx`
- Create: `src/components/community/PostCard.tsx`
- Test: `__tests__/post-card.test.tsx`

**Interfaces:**

- Consumes: Task 3 `Post`; Task 4 `usePostPhoto`; `relativeTime` (Task 2); `Match`, `outcomeOf`, `opponentOf`, `ourTeam` (`@/models/kleague`); `Avatar`
- Produces:
  - `LockIcon({ size?: number; color: string })`
  - `PostCard({ post: Post; match?: Match; onOpen?: (post: Post) => void; onOpenMatch?: (match: Match) => void })`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```tsx
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { PostCard } from '@/components/community/PostCard'
import type { Post } from '@/models/community'
import { mockMatchFinished } from '@/utils/fixtures'

jest.mock('@/hooks/community/useCommunity', () => ({ usePostPhoto: () => 'file:///p.jpg' }))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

const base: Post = {
  id: 'p1',
  authorId: 'u1',
  handle: 'steel',
  nickname: '김포항',
  avatarUrl: null,
  body: '오늘 직관 최고',
  visibility: 'public',
  match: null,
  photos: [],
  likeCount: 3,
  commentCount: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('피드 카드', () => {
  it('닉네임, 본문, 좋아요·댓글 수', () => {
    wrap(<PostCard post={base} />)
    expect(screen.getByText('김포항')).toBeTruthy()
    expect(screen.getByText('오늘 직관 최고')).toBeTruthy()
    expect(screen.getByLabelText('좋아요 3')).toBeTruthy()
    expect(screen.getByLabelText('댓글 2')).toBeTruthy()
  })

  it('나만 보기 글에는 자물쇠가 붙는다', () => {
    wrap(<PostCard post={{ ...base, visibility: 'private' }} />)
    expect(screen.getByLabelText('나만 보기')).toBeTruthy()
  })

  it('공개 글에는 자물쇠가 없다', () => {
    wrap(<PostCard post={base} />)
    expect(screen.queryByLabelText('나만 보기')).toBeNull()
  })

  it('사진이 여러 장이면 +N', () => {
    const photos = [0, 1, 2, 3].map(position => ({ position, path: `u1/p1/${position}` }))
    wrap(<PostCard post={{ ...base, photos }} />)
    expect(screen.getByText('+3')).toBeTruthy()
  })

  /** 사진 없는 직관 글은 스코어 카드로 채운다. 픽스처 경기는 대전 2:2 포항 */
  it('사진 없는 직관 글은 스코어 카드', () => {
    wrap(
      <PostCard
        post={{ ...base, match: { year: 2026, leagueId: 1, gameId: mockMatchFinished.id } }}
        match={mockMatchFinished}
      />,
    )
    expect(screen.getByLabelText('스코어 카드')).toBeTruthy()
    expect(screen.getByText('무')).toBeTruthy()
  })

  it('사진 없는 자유 글은 본문만', () => {
    wrap(<PostCard post={base} />)
    expect(screen.queryByLabelText('스코어 카드')).toBeNull()
  })

  /** 닉네임을 아직 안 정한 사람의 글 */
  it('프로필이 없으면 알 수 없음', () => {
    wrap(<PostCard post={{ ...base, handle: null, nickname: null }} />)
    expect(screen.getByText('알 수 없음')).toBeTruthy()
  })

  it('누르면 연다', () => {
    const onOpen = jest.fn()
    wrap(<PostCard post={base} onOpen={onOpen} />)
    fireEvent.press(screen.getByText('오늘 직관 최고'))
    expect(onOpen).toHaveBeenCalledWith(base)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/post-card.test.tsx`
Expected: FAIL — `Cannot find module '@/components/community/PostCard'`

- [ ] **Step 3: `LockIcon.tsx` 를 쓴다**

```tsx
import Svg, { Path, Rect } from 'react-native-svg'

/** 나만 보기 표시. 글자 기호 대신 벡터로 그려 테마 색을 따른다 */
export function LockIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="나만 보기" accessible>
      <Rect x={5} y={10} width={14} height={11} rx={2.5} fill={color} />
      <Path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  )
}
```

- [ ] **Step 4: `PostCard.tsx` 를 쓴다**

```tsx
import { memo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'

import { cornerRadius, fonts, palette, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Avatar } from '@/components/profile/Avatar'
import { LockIcon } from '@/components/community/LockIcon'
import { usePostPhoto } from '@/hooks/community/useCommunity'
import type { Post } from '@/models/community'
import { type Match, opponentOf, outcomeOf, ourTeam } from '@/models/kleague'
import { relativeTime } from '@/utils/relativeTime'

const OUTCOME = { win: '승', draw: '무', loss: '패' } as const

export interface PostCardProps {
  post: Post
  /** 직관 글이면 그 경기. 목록에서 찾아 넘긴다 */
  match?: Match
  onOpen?: (post: Post) => void
  onOpenMatch?: (match: Match) => void
}

/**
 * 게시글 카드. 커뮤니티 피드와 직관 기록이 같이 쓴다.
 *
 * 사진이 있으면 첫 장을 크게, 사진 없는 직관 글은 같은 자리를 스코어 카드로 채운다. 사진 없는
 * 자유 글은 빈 칸 없이 본문만 둔다. 나만 보기 글은 자물쇠만 붙이고 나머지는 똑같다.
 */
export const PostCard = memo(function PostCard({ post, match, onOpen, onOpenMatch }: PostCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const cover = usePostPhoto(post, post.photos[0]?.position ?? 0)
  const more = post.photos.length - 1
  const name = post.nickname ?? post.handle ?? '알 수 없음'

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.head}>
        <Avatar url={post.avatarUrl} size={32} />
        <View style={styles.who}>
          <Text style={[fonts.label, { color: theme.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[fonts.caption, { color: theme.textMuted }]}>{relativeTime(post.createdAt)}</Text>
        </View>
        {post.visibility === 'private' && <LockIcon color={theme.textMuted} />}
      </View>

      <PressableScale onPress={onOpen ? () => onOpen(post) : undefined} scaleTo={0.99}>
        {post.photos.length > 0 ? (
          <View style={[styles.media, { backgroundColor: theme.skeleton }]}>
            {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />}
            {more > 0 && (
              <View style={styles.more}>
                <Text style={[fonts.label, { color: palette.white }]}>{`+${more}`}</Text>
              </View>
            )}
          </View>
        ) : match ? (
          <ScoreCard match={match} />
        ) : null}

        <View style={styles.body}>
          {match && (
            <PressableScale onPress={onOpenMatch ? () => onOpenMatch(match) : undefined}>
              <Text style={[fonts.caption, { color: theme.accent }]}>{matchLine(match)}</Text>
            </PressableScale>
          )}
          <Text style={[fonts.body, { color: theme.textPrimary }]} numberOfLines={expanded ? undefined : 3}>
            {post.body}
          </Text>
          {!expanded && post.body.split('\n').length > 3 && (
            <PressableScale onPress={() => setExpanded(true)}>
              <Text style={[fonts.caption, { color: theme.textMuted }]}>더 보기</Text>
            </PressableScale>
          )}
        </View>
      </PressableScale>

      <View style={styles.foot}>
        <Text
          style={[fonts.caption, { color: theme.textMuted }]}
          accessibilityLabel={`좋아요 ${post.likeCount}`}
        >
          {`♡ ${post.likeCount}`}
        </Text>
        <Text
          style={[fonts.caption, { color: theme.textMuted }]}
          accessibilityLabel={`댓글 ${post.commentCount}`}
        >
          {`댓글 ${post.commentCount}`}
        </Text>
      </View>
    </View>
  )
})

function matchLine(match: Match): string {
  const d = new Date(match.kickoffAtMs)
  const theirs = opponentOf(match)
  const outcome = outcomeOf(match)
  const score = outcome ? ` ${ourTeam(match).goal}:${theirs.goal} ${OUTCOME[outcome]}` : ''
  return `${d.getMonth() + 1}/${d.getDate()} vs ${theirs.name}${score}`
}

/** 사진 없는 직관 글의 자리. 결과 색 바탕에 스코어와 승·무·패 */
function ScoreCard({ match }: { match: Match }) {
  const theme = useTheme()
  const outcome = outcomeOf(match)
  const tone = outcome === 'win' ? theme.accent : outcome === 'loss' ? theme.textPrimary : theme.textMuted
  const mine = ourTeam(match)
  const theirs = opponentOf(match)
  return (
    <View style={[styles.media, styles.score, { backgroundColor: tone }]} accessibilityLabel="스코어 카드">
      <Text style={[fonts.title1, { color: palette.white }]}>{outcome ? OUTCOME[outcome] : '예정'}</Text>
      <Text style={[fonts.body, { color: palette.white }]}>
        {outcome ? `${mine.name} ${mine.goal} : ${theirs.goal} ${theirs.name}` : `vs ${theirs.name}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: cornerRadius['200'], borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing['100'], padding: spacing['150'] },
  who: { flex: 1 },
  media: { width: '100%', aspectRatio: 4 / 3 },
  more: {
    position: 'absolute',
    right: spacing['100'],
    top: spacing['100'],
    paddingHorizontal: spacing['100'],
    paddingVertical: 2,
    borderRadius: cornerRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  score: { alignItems: 'center', justifyContent: 'center', gap: spacing['075'] },
  body: { gap: spacing['075'], padding: spacing['150'] },
  foot: {
    flexDirection: 'row',
    gap: spacing['200'],
    paddingHorizontal: spacing['150'],
    paddingBottom: spacing['150'],
  },
})
```

"더 보기" 는 줄바꿈으로 네 줄 이상인 글에만 띄운다. 긴 한 줄이 세 줄로 접히는 경우는 2단계에서 다룬다.

- [ ] **Step 5: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/post-card.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS. `fonts.title1`·`theme.skeleton` 은 이미 있는 토큰이다

- [ ] **Step 6: 커밋**

```bash
git add src/components/community __tests__/post-card.test.tsx
git commit -m "게시글 카드를 사진·스코어 카드·본문으로 그린다"
```

---

### Task 6: 피드 화면과 글 상세

**Files:**

- Create: `src/screens/CommunityScreen.tsx`
- Create: `src/screens/PostDetailScreen.tsx`
- Modify: `src/navigation/types.ts` (`Post: { postId: string }`), `src/navigation/detailScreens.tsx`, `src/navigation/routes/detail.tsx`
- Test: `__tests__/community-screens.test.tsx`

**Interfaces:**

- Consumes: Task 4 `useCommunityFeed`, `usePost`, `usePostPhoto`; Task 5 `PostCard`; `useMatches`; `CommentList`, `CommentComposer`; `CategoryTabs`, `QueryState`, `InlineState`
- Produces: `CommunityScreen({ onOpenPost?: (post: Post) => void; onOpenMatch?: (match: Match) => void })`, `PostDetailScreen({ postId: string; onRequireLogin?: () => void })`, 라우트 `Post`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```tsx
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { CommunityScreen } from '@/screens/CommunityScreen'
import { PostDetailScreen } from '@/screens/PostDetailScreen'
import type { Post } from '@/models/community'

const p = (id: string, body: string): Post => ({
  id,
  authorId: 'u',
  handle: 'h',
  nickname: '팬',
  avatarUrl: null,
  body,
  visibility: 'public',
  match: null,
  photos: [],
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const mockFeed = {
  posts: [p('1', '첫 글')],
  query: {
    isPending: false,
    isError: false,
    data: {},
    refetch: jest.fn(),
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    isFetchingNextPage: false,
    isRefetching: false,
  },
}
const mockFeedCalls: string[] = []
const mockPostState = {
  post: p('9', '상세 본문') as Post | null,
  blocked: false,
  query: { isPending: false, isError: false, data: {}, refetch: jest.fn() },
}
jest.mock('@/hooks/community/useCommunity', () => ({
  useCommunityFeed: (filter: string) => {
    mockFeedCalls.push(filter)
    return mockFeed
  },
  usePost: () => mockPostState,
  usePostPhoto: () => null,
}))
jest.mock('@/hooks/query/useKleague', () => ({ useMatches: () => ({ data: [] }) }))
jest.mock('@/components/comment/CommentList', () => ({ CommentList: () => null }))
jest.mock('@/components/comment/CommentComposer', () => ({ CommentComposer: () => null }))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

describe('커뮤니티 피드 화면', () => {
  it('공개 글을 보여 준다', () => {
    wrap(<CommunityScreen />)
    expect(screen.getByText('첫 글')).toBeTruthy()
  })

  it('거르개를 바꾸면 그 갈래를 받는다', () => {
    mockFeedCalls.length = 0
    wrap(<CommunityScreen />)
    fireEvent.press(screen.getByText('자유'))
    expect(mockFeedCalls).toContain('free')
  })

  it('글이 없으면 안내한다', () => {
    mockFeed.posts = []
    wrap(<CommunityScreen />)
    expect(screen.getByText(/첫 글을 남겨 보세요/)).toBeTruthy()
    mockFeed.posts = [p('1', '첫 글')]
  })
})

describe('글 상세', () => {
  it('본문을 보여 준다', () => {
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.getByText('상세 본문')).toBeTruthy()
  })

  /** 나만 보기로 바뀌었거나 지워진 글 */
  it('볼 수 없는 글이면 안내한다', () => {
    mockPostState.post = null
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.getByText('볼 수 없는 글입니다')).toBeTruthy()
    mockPostState.post = p('9', '상세 본문')
  })

  it('차단한 사람의 글이면 가린다', () => {
    mockPostState.blocked = true
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.queryByText('상세 본문')).toBeNull()
    expect(screen.getByText('차단한 사용자의 글입니다')).toBeTruthy()
    mockPostState.blocked = false
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/community-screens.test.tsx`
Expected: FAIL — `Cannot find module '@/screens/CommunityScreen'`

- [ ] **Step 3: `CommunityScreen.tsx` 를 쓴다**

```tsx
import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'

import { spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { InlineState } from '@/components/feedback/States'
import { PostCard } from '@/components/community/PostCard'
import { useCommunityFeed } from '@/hooks/community/useCommunity'
import { useMatches } from '@/hooks/query/useKleague'
import type { FeedFilter, Post } from '@/models/community'
import type { Match } from '@/models/kleague'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'attendance', label: '직관' },
  { key: 'free', label: '자유' },
]

export interface CommunityScreenProps {
  onOpenPost?: (post: Post) => void
  onOpenMatch?: (match: Match) => void
}

/**
 * 커뮤니티 피드. 공개 글만, 최신순, 20개씩 이어 받는다.
 *
 * 직관 글의 경기는 이미 받는 포항 경기 목록에서 찾는다 — 따로 묻지 않는다.
 */
export function CommunityScreen({ onOpenPost, onOpenMatch }: CommunityScreenProps) {
  const theme = useTheme()
  const [filter, setFilter] = useState<FeedFilter>('all')
  const { posts, query } = useCommunityFeed(filter)
  const { data: matches } = useMatches()
  const byGame = useMemo(() => new Map((matches ?? []).map(m => [m.id, m])), [matches])

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <CategoryTabs tabs={FILTERS} value={filter} onChange={key => setFilter(key as FeedFilter)} />
      {query.isError ? (
        <InlineState tone="error" message="불러오지 못했습니다" onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={post => post.id}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              match={item.match ? byGame.get(item.match.gameId) : undefined}
              onOpen={onOpenPost}
              onOpenMatch={onOpenMatch}
            />
          )}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
          }
          ListEmptyComponent={
            query.isPending ? null : <InlineState message="아직 글이 없습니다. 첫 글을 남겨 보세요" />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing['200'], gap: spacing['150'] },
})
```

`InlineState` 의 `tone` 에 `'error'` 가 없으면 `States.tsx` 가 쓰는 값으로 맞춘다(`npx tsc --noEmit` 이 알려 준다).

- [ ] **Step 4: `PostDetailScreen.tsx` 를 쓴다**

```tsx
import { useMemo, useState } from 'react'
import { FlatList, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { InlineState } from '@/components/feedback/States'
import { LockIcon } from '@/components/community/LockIcon'
import { CommentList } from '@/components/comment/CommentList'
import { CommentComposer } from '@/components/comment/CommentComposer'
import { usePost, usePostPhoto } from '@/hooks/community/useCommunity'
import type { Post } from '@/models/community'
import type { Comment, CommentSubject } from '@/repositories/comment/remote'
import { relativeTime } from '@/utils/relativeTime'

export interface PostDetailScreenProps {
  postId: string
  onRequireLogin?: () => void
}

/**
 * 글 상세. 사진을 옆으로 넘기고, 본문 전체와 댓글.
 *
 * 볼 수 없는 글(나만 보기로 바뀌었거나 지워짐)은 RLS 가 가려 null 로 온다.
 */
export function PostDetailScreen({ postId, onRequireLogin }: PostDetailScreenProps) {
  const theme = useTheme()
  const { post, blocked, query } = usePost(postId)
  const subject = useMemo<CommentSubject>(() => ({ type: 'post', id: postId }), [postId])
  const [replyTo, setReplyTo] = useState<Comment | null>(null)

  if (query.isPending) return <InlineState message="글을 불러오는 중입니다" />
  if (query.isError) return <InlineState message="불러오지 못했습니다" onRetry={() => void query.refetch()} />
  if (!post) return <InlineState message="볼 수 없는 글입니다" />
  if (blocked) return <InlineState message="차단한 사용자의 글입니다" />

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {post.photos.length > 0 && <PhotoPager post={post} />}
        <View style={styles.meta}>
          <Text style={[fonts.label, { color: theme.textPrimary }]}>
            {post.nickname ?? post.handle ?? '알 수 없음'}
          </Text>
          <Text style={[fonts.caption, { color: theme.textMuted }]}>{relativeTime(post.createdAt)}</Text>
          {post.visibility === 'private' && (
            <>
              <LockIcon color={theme.textMuted} />
              <Text style={[fonts.caption, { color: theme.textMuted }]}>나만 보기</Text>
            </>
          )}
        </View>
        <Text style={[fonts.body, styles.gutter, { color: theme.textPrimary }]}>{post.body}</Text>
        <View style={styles.gutter}>
          <CommentList subject={subject} onReply={setReplyTo} onRequireLogin={onRequireLogin} />
        </View>
      </ScrollView>
      {post.visibility === 'public' && (
        <CommentComposer
          subject={subject}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onRequireLogin={onRequireLogin}
        />
      )}
    </View>
  )
}

/** 사진 옆으로 넘기기. 점으로 몇 번째인지 알린다 */
function PhotoPager({ post }: { post: Post }) {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={post.photos}
        keyExtractor={p => String(p.position)}
        onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <PagerPhoto post={post} position={item.position} width={width} />}
      />
      {post.photos.length > 1 && (
        <View style={styles.dots}>
          {post.photos.map((p, i) => (
            <View
              key={p.position}
              style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.border }]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

function PagerPhoto({ post, position, width }: { post: Post; position: number; width: number }) {
  const theme = useTheme()
  const uri = usePostPhoto(post, position)
  return (
    <View style={{ width, aspectRatio: 4 / 3, backgroundColor: theme.skeleton }}>
      {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spacing['150'], paddingBottom: spacing['400'] },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['100'],
    paddingHorizontal: spacing['200'],
  },
  gutter: { paddingHorizontal: spacing['200'] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing['075'], marginTop: spacing['100'] },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
```

`CommentComposer` 의 실제 props 이름(`replyTo`, `onCancelReply` 등)과 다르면 `MatchDetailScreen.tsx` 가 넘기는 방식을 그대로 따른다. `spacing['400']` 이 없으면 가장 큰 기존 값을 쓴다.

- [ ] **Step 5: 라우트를 잇는다**

`types.ts` 의 `DetailParamList` 에:

```ts
/** 게시글. 객체 대신 id 로 넘기고 캐시에서 되찾는다 */
Post: {
  postId: string
}
```

`routes/detail.tsx` 에:

```tsx
export function PostRoute({ postId }: { postId: string }) {
  const navigation = useNavigation<DetailNavigation>()
  const requireLogin = useCallback(() => navigation.navigate('Login'), [navigation])
  return <PostDetailScreen postId={postId} onRequireLogin={requireLogin} />
}
```

`detailScreens.tsx` 에:

```tsx
<Stack.Screen
  name="Post"
  options={{ title: '글' }}
  children={({ route }: any) => (
    <ScreenBoundary>
      <PostRoute postId={route.params.postId} />
    </ScreenBoundary>
  )}
/>
```

- [ ] **Step 6: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/community-screens.test.tsx __tests__/deep-link.test.ts && npx jest && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/screens/CommunityScreen.tsx src/screens/PostDetailScreen.tsx src/navigation __tests__/community-screens.test.tsx
git commit -m "커뮤니티 피드와 글 상세를 읽는다"
```

---

### Task 7: 커뮤니티 탭은 커뮤니티만, 소식·영상은 홈에서 들어가는 목록으로

**결정 (2026-09-28)**: 커뮤니티 탭은 커뮤니티 피드만 둔다. 소식·영상은 탭에서 빼고 홈의 "더 보기" 로 들어가는 전체 목록 화면이 된다 — 가장 자주 쓰는 입구(홈 미리 보기)는 그대로 살고 탭은 한 가지 역할만 한다. 탭은 5개 그대로(홈 / 경기 / 커뮤니티 / 구단 / 마이).

**Files:**

- Modify: `src/navigation/openers.ts` (`SEE_ALL_TARGET` → `seeAllDestination`), `src/navigation/tabs.tsx` (`HomeMain`, `MediaMain`, 149행 제목), `src/navigation/TabBar.tsx:33`, `src/navigation/types.ts`, `src/navigation/detailScreens.tsx`, `src/navigation/routes/detail.tsx`, `src/navigation/deepLink.ts` (`news: 'Home'`)
- Delete: `src/screens/MediaScreen.tsx` (쓰는 곳이 없어진다)
- Test: `__tests__/see-all.test.ts` (신규), `__tests__/navigation.test.tsx` (탭 이름·"더 보기" 가 있으면 고친다)

**Interfaces:**

- Consumes: Task 6 `CommunityScreen`
- Produces: `seeAllDestination(key: 'matches' | 'standings' | 'news' | 'videos'): { kind: 'tab'; tab: string; screen: string; inner: string } | { kind: 'stack'; screen: 'NewsList' | 'VideoList' }`, 라우트 `NewsList`, `VideoList`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`__tests__/see-all.test.ts`:

```ts
import { seeAllDestination } from '@/navigation/openers'

/** 소식·영상은 탭에서 빠져 홈 위에 쌓이는 목록이 됐다. 일정·순위는 여전히 경기 탭으로 간다 */
describe('홈의 더 보기', () => {
  it('일정과 순위는 경기 탭으로', () => {
    expect(seeAllDestination('matches')).toEqual({
      kind: 'tab',
      tab: 'Competition',
      screen: 'CompetitionMain',
      inner: 'matches',
    })
    expect(seeAllDestination('standings')).toEqual({
      kind: 'tab',
      tab: 'Competition',
      screen: 'CompetitionMain',
      inner: 'standings',
    })
  })

  it('소식과 영상은 홈 위에 목록을 연다', () => {
    expect(seeAllDestination('news')).toEqual({ kind: 'stack', screen: 'NewsList' })
    expect(seeAllDestination('videos')).toEqual({ kind: 'stack', screen: 'VideoList' })
  })
})
```

`__tests__/deep-link.test.ts` 는 주소 모양만 보므로 그대로 둔다.

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/see-all.test.ts`
Expected: FAIL — `seeAllDestination is not a function`

- [ ] **Step 3: `openers.ts` 를 바꾼다**

`SEE_ALL_TARGET` 상수를 지우고 이것으로 바꾼다:

```ts
/**
 * 홈의 "더 보기" 가 가는 곳.
 *
 * 일정·순위는 경기 탭의 그 갈래로 옮긴다. 소식·영상은 탭이 없으므로 홈 스택 위에 전체
 * 목록을 밀어 연다 — 뒤로 가면 홈으로 돌아온다.
 */
export type SeeAllKey = 'matches' | 'standings' | 'news' | 'videos'

export type SeeAllDestination =
  | { kind: 'tab'; tab: string; screen: string; inner: string }
  | { kind: 'stack'; screen: 'NewsList' | 'VideoList' }

export function seeAllDestination(key: SeeAllKey): SeeAllDestination {
  if (key === 'news') return { kind: 'stack', screen: 'NewsList' }
  if (key === 'videos') return { kind: 'stack', screen: 'VideoList' }
  return { kind: 'tab', tab: 'Competition', screen: 'CompetitionMain', inner: key }
}
```

- [ ] **Step 4: 라우트와 탭을 바꾼다**

`types.ts` 의 `DetailParamList` 에:

```ts
/** 소식 전체. 탭이 아니라 홈의 "더 보기" 로 들어온다 */
NewsList: undefined
/** 영상 전체. 소식과 같다 */
VideoList: undefined
```

`routes/detail.tsx` 에:

```tsx
export function NewsListRoute() {
  return <NewsScreen onOpenArticle={useOpenArticle()} />
}

export function VideoListRoute() {
  return <VideosScreen onOpenVideo={useOpenVideo()} />
}
```

(`import { NewsScreen } from '@/screens/NewsScreen'`, `import { VideosScreen } from '@/screens/VideosScreen'`, `useOpenArticle` 을 `../openers` 에서 더한다.)

`detailScreens.tsx` 에:

```tsx
      <Stack.Screen
        name="NewsList"
        options={{ title: '소식' }}
        children={() => (
          <ScreenBoundary>
            <NewsListRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="VideoList"
        options={{ title: '영상' }}
        children={() => (
          <ScreenBoundary>
            <VideoListRoute />
          </ScreenBoundary>
        )}
      />
```

`tabs.tsx` 의 `HomeMain` 에서 `onSeeAll` 을 바꾼다:

```tsx
const onSeeAll = useCallback(
  (key: SeeAllKey) => {
    const to = seeAllDestination(key)
    if (to.kind === 'stack') {
      ;(navigation as unknown as { navigate: (name: string) => void }).navigate(to.screen)
      return
    }
    // 스택이 탭 안에 들어갔으므로 탭 전환은 부모 내비게이터가 맡는다.
    // 탭 -> 그 안의 스택 -> 스택의 첫 화면까지 한 번에 지목한다
    const parent = navigation.getParent() as { navigate: (name: string, params?: object) => void } | undefined
    parent?.navigate(to.tab, { screen: to.screen, params: { tab: to.inner } })
  },
  [navigation],
)
```

(import 를 `SEE_ALL_TARGET` 대신 `seeAllDestination, type SeeAllKey` 로 바꾼다.)

`MediaMain` 을 커뮤니티 피드만 그리게 바꾼다:

```tsx
function MediaMain() {
  const navigation = useNavigation<DetailNavigation>()
  const openPost = useCallback((post: Post) => navigation.navigate('Post', { postId: post.id }), [navigation])
  return <CommunityScreen onOpenPost={openPost} onOpenMatch={useOpenMatch()} />
}
```

(`import { CommunityScreen } from '@/screens/CommunityScreen'`, `import type { Post } from '@/models/community'`. `MediaScreen`·`MediaTabKey` import 는 지운다. `useOpenMatch()` 의 인자 모양이 `Match` 가 아니면 `HomeMain` 이 쓰는 방식을 따른다.) 149행 `tabStack('MediaMain', '소식', MediaMain)` 의 `'소식'` 을 `'커뮤니티'` 로, `TabBar.tsx` 의 `Media: '소식'` 을 `Media: '커뮤니티'` 로 바꾼다.

`deepLink.ts` 의 `TAB` 에서 `news: 'Media'` 를 `news: 'Home'` 로 바꾼다 — 소식 상세는 이제 홈 위에서 연다.

`src/screens/MediaScreen.tsx` 를 지운다: `git rm src/screens/MediaScreen.tsx`. 권한 검사에 막히면 사용자에게 `! git rm src/screens/MediaScreen.tsx` 를 청한다. `src/screens/index.ts` 가 `MediaScreen` 을 내보내면 그 줄도 지운다.

- [ ] **Step 5: 통과를 확인한다**

Run: `cd steelers-app && grep -rn "SEE_ALL_TARGET\|MediaScreen" src __tests__; npx jest && npx tsc --noEmit && npm run lint`
Expected: grep 결과 없음(테스트에 남아 있으면 그 테스트를 새 구조에 맞춘다), 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add -A src/navigation src/screens __tests__
git commit -m "커뮤니티 탭은 커뮤니티만 두고 소식·영상은 홈에서 들어가는 목록으로 뺀다"
```

---

### Task 8: 적용과 실측 (사용자와 함께)

- [ ] **Step 1**: `npx tsc --noEmit && npm run lint && npx jest` 전부 통과. `deno test --allow-read --no-lock supabase/functions` 통과 뒤 `git checkout -- deno.lock`
- [ ] **Step 2**: 사용자에게 0023 을 SQL Editor 에서 돌려 달라고 청한다 (`! pbcopy < supabase/migrations/0023_community.sql`). 답을 받기 전에는 넘어가지 않는다
- [ ] **Step 3**: 시험 글 두 개를 사용자에게 청한다 (쓰기 화면은 2단계라 SQL 로 넣는다). 사용자 본인 uid 는 SQL Editor 에서 `select id, email, created_at from auth.users order by created_at;` 로 보고 고른다

```sql
insert into public.posts (author, body, visibility) values
  ('<내 uid>', '커뮤니티 시험 글 — 공개', 'public'),
  ('<내 uid>', '커뮤니티 시험 글 — 나만 보기', 'private');
```

심사 전 시험 데이터 정리는 먼저 묻는다(메모리 `ask-before-app-review-cleanup`) — 지우지 말고 목록에 적어 둔다.

- [ ] **Step 4**: 로그인 없이 막히는지 본다

```bash
cd steelers-app && set -a && . ./.env && set +a
# 공개 글만 보여야 한다 (나만 보기 글은 없음)
curl -s -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/posts?select=body,visibility"
# 로그인 없이 글 쓰기는 막힌다
curl -s -X POST -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" -H "Content-Type: application/json" \
  "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/posts" -d '{"author":"00000000-0000-0000-0000-000000000000","body":"x"}'
# 나만 보기 글의 댓글을 읽을 수 없다 (subject_id 는 나만 보기 글 id)
curl -s -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/comments?select=id&subject_type=eq.post"
# 통계 뷰
curl -s -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/post_stats?select=*"
```

Expected: 첫 줄은 공개 글 하나만, 둘째는 `42501`(RLS), 셋째는 `[]`, 넷째는 공개 글 하나의 통계만

- [ ] **Step 5**: 폰에 설치한다. 네이티브 설정은 바뀌지 않았으므로 prebuild 없이

Run: `cd steelers-app && cat ios/.xcode.env.local && npx expo run:ios --configuration Release --device 00008130-001225AC01F2001C`
Expected: 빌드 성공

- [ ] **Step 6**: 사용자에게 확인을 청한다
  1. 탭바 셋째가 "커뮤니티", 들어가면 거르개와 피드만 있다
  2. 커뮤니티 피드에 공개 시험 글 하나만 보인다
  3. 누르면 상세, 댓글을 달 수 있다
  4. 홈의 소식·영상 "더 보기" 가 뒤로 가기 있는 전체 목록을 연다
  5. 거르개 `직관` 을 누르면 빈 안내, `자유` 는 시험 글

---

## 스펙 대비 메모

- 스펙의 좋아요 표는 이 단계에서 표·정책·통계 뷰까지 만들고, 누르기는 3단계다. 카드는 수만 보여 준다.
- 신고 표(`post_reports`)와 신고함·신고 메일 확장은 3단계 migration(0024)으로 미룬다. 1단계에는 쓰기가 없어 신고할 남의 글이 생기지 않는다.
- 직관 기록 사진 옮기기는 4단계다.
- "더 보기" 는 줄바꿈 기준으로만 띄운다. 긴 한 줄의 접힘은 2단계에서 다룬다.

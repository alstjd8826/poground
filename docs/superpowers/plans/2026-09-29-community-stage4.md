# 커뮤니티 4단계 — 직관 기록 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직관 기록 화면이 내 직관 글 피드가 되고(나만 보기 글 포함), 경기 상세에서 그 경기에 쓴 내 글이 보이며, 옛 직관 사진 칸·코드를 걷어낸다.

**Architecture:** 내 직관 글은 `posts` 에서 author=나, 본문에 `#직관`, 안 지운 것(2단계 분류 규칙 그대로). 직관 기록 화면은 "체크한 경기" 와 "내 직관 글" 을 한 줄 시간표로 섞는다 — 글이 붙은 경기는 글 카드로, 글 없이 체크만 한 경기는 스코어 카드와 `[글 쓰기]` 로. 옛 사진은 0장(2026-09-29 확인)이라 옮기지 않고 0027 이 칸과 정책을 지운다.

**Tech Stack:** Expo 57 / RN, Supabase, react-query, jest, PGlite.

**Spec:** `docs/superpowers/specs/2026-09-28-community-design.md` ("나눠서 만들기" 4단계, "직관 기록 연결", "직관 기록 사진 옮기기")

## Global Constraints

- 직관 기록 화면: 요약(승리요정 승률)은 그대로, 아래는 내 직관 글 피드(자물쇠 포함). 글 없이 체크만 한 경기는 스코어 카드와 `[글 쓰기]`
- 경기 상세 직관 블록: 이미 쓴 글이 있으면 그 카드를 보여 준다(`[직관 글 쓰기]` 는 3단계 전에 이미 있음)
- 나만 보기 글은 커뮤니티 피드에 없고, 직관 기록과 내 상세에서는 똑같이 보이고 자물쇠만 붙는다
- 직관 글 = 본문에 `#직관`(2026-09-29 결정). 경기는 경기 태그로 찾은 경기 키(`match_*` 칸)
- 옛 직관 사진은 0장 — 옮기기 스크립트 없이 `attendances.photo_path` 와 `my-attendance-photos` 정책을 지우고, 버킷은 사용자가 대시보드에서 지운다
- 커밋·주석 사무적 한국어, prettier 110·arrowParens avoid, SQL 은 PGlite 먼저

## Review Focus

1. 같은 경기에 내 직관 글이 둘 이상 — 경기 줄 하나에 글 카드 둘 다, 스코어 카드는 없다. Task 2 테스트
2. 경기 태그 없이 `#직관` 만 쓴 글 — 경기 없이도 시간표에 들어간다(작성 시각 자리). Task 2 테스트
3. 체크를 풀었는데 글은 남은 경기 — 글은 계속 보인다(글이 기록이다). Task 2 테스트
4. 로그아웃·다른 계정 — 남의 직관 글이 섞이지 않는다(author=나 로 묻는다). Task 1 테스트
5. 옛 사진 칸을 지운 뒤 앱의 `photo_path` 읽기 — 없는 칸을 select 하면 전체 질의가 깨진다. Task 4 가 칸 이름을 모두 걷어낸다(grep 0)

---

### Task 1: 내 직관 글 읽기

**Files:** Modify `src/repositories/community/remote.ts`, `src/hooks/community/useCommunity.ts` · Test `__tests__/my-attendance-posts.test.ts`

**Produces:**

- `listMyAttendancePosts(userId: string): Promise<Post[]>` — `posts` author=userId, `deleted_at is null`, `body ilike %#직관%`, 최신순, 50개까지(hydrate 로 프로필·통계·내 좋아요)
- `communityKeys.mine(userId)` = `['community', 'mine', userId]`
- `useMyAttendancePosts(): { posts: Post[]; query }` — 로그인 전이면 묻지 않고 `[]`. `communityKeys.all` 아래라 저장·지우기·좋아요 무효화에 함께 걸린다

- [ ] Step 1: 테스트 — chain 흉내로 `from('posts')` 에 `eq('author','me')`, `is('deleted_at', null)`, `ilike('body','%#직관%')`, `order('created_at',{ascending:false})`, `limit(50)` 이 걸리는지, 그리고 visibility 로 거르지 **않는지**(나만 보기도 받는다). 훅은 로그인 전이면 listMyAttendancePosts 를 부르지 않는다
- [ ] Step 2: RED 확인 → 구현 → GREEN → `npx tsc --noEmit` → 커밋 `내 직관 글을 읽는다`

### Task 2: 직관 시간표 (순수 함수)

**Files:** Modify `src/models/attendance.ts` · Test `__tests__/attendance-timeline.test.ts`

**Produces:**

```ts
export type TimelineItem =
  { kind: 'post'; post: Post; match: Match | undefined } | { kind: 'match'; entry: AttendanceEntry }

/**
 * 체크한 경기와 내 직관 글을 한 줄로. 글이 붙은 경기는 글 카드로(여럿이면 여럿), 글 없이 체크만 한
 * 경기는 경기 줄로. 경기가 붙은 글은 경기 시각, 경기 없는 글은 작성 시각으로 최신순.
 */
export function attendanceTimeline(
  entries: AttendanceEntry[],
  posts: Post[],
  matches: Match[],
): TimelineItem[]
```

- [ ] Step 1: 테스트 — ① 글 없는 체크 경기 → `match` ② 글이 붙은 체크 경기 → `post` 만(경기 줄 없음) ③ 한 경기에 글 둘 → `post` 둘 ④ `#직관` 만 있고 경기 없는 글 → 작성 시각 자리 ⑤ 체크를 풀었는데 글이 남은 경기 → `post` 로 남는다 ⑥ 최신순
- [ ] Step 2: RED → 구현(경기 키는 `sameKey`, 글의 match 는 `{year,leagueId,gameId}`) → GREEN → 커밋 `직관 기록의 시간표를 만든다`

### Task 3: 직관 기록 화면과 경기 상세

**Files:** Modify `src/screens/AttendanceScreen.tsx`, `src/components/community/PostCard.tsx`(ScoreCard 를 내보냄), `src/screens/MatchDetailScreen.tsx`, `src/navigation/routes/detail.tsx` · Test `__tests__/attendance-screen.test.tsx`, `__tests__/match-detail-actions.test.tsx`

**Produces:**

- `AttendanceScreenProps` 에 `onOpenPost`, `onEditPost`, `onWritePost(match)`, `onRequireLogin`
- 화면: 머리는 지금 요약 그대로. 목록은 `attendanceTimeline` — `post` 는 `PostCard`(차림표 `usePostMenu`, 하트 `usePostLike` — 커뮤니티와 같다), `match` 는 `ScoreCard` + 경기 줄 + `[글 쓰기]`(누르면 `onWritePost(match)`)
- 빈 상태 문구는 지금 그대로(체크도 글도 없을 때)
- 경기 상세: `AttendanceBlock` 아래에 그 경기의 내 직관 글 카드(있으면). `useMyAttendancePosts` 에서 경기 키로 고른다

- [ ] Step 1: 테스트 — 직관 기록 화면이 글 카드(자물쇠 포함)와 글 없는 경기의 `[글 쓰기]` 를 그린다, `[글 쓰기]` 가 그 경기로 `onWritePost` 를 부른다, 나만 보기 글도 보인다. 경기 상세는 내 글이 있으면 그 본문이 보인다
- [ ] Step 2: RED → 구현 → GREEN → `npx tsc --noEmit && npm run lint && npx jest --silent` → 커밋 `직관 기록을 내 직관 글 피드로 바꾸고 경기 상세에 내 글을 보인다`

### Task 4: 옛 직관 사진 걷어내기 (0027)

**Files:** Create `supabase/migrations/0027_drop_attendance_photos.sql`, `supabase/tests/0027_check.sql`(prelude 에 `attendances` 가 없으면 넣는다) · Modify `src/repositories/attendance/remote.ts`, `src/hooks/attendance/useAttendances.ts`, `src/models/attendance.ts`, `src/components/match/AttendanceBlock.tsx`, `src/utils/pickPhoto.ts`(`takePhoto` 삭제 — 부르는 곳이 없다), 관련 테스트, `docs/privacy.md`

```sql
-- 옛 직관 사진. 글쓰기로 옮겨 가 0장이다(2026-09-29 확인). 칸과 스토리지 정책을 지운다.
-- 버킷(my-attendance-photos)은 대시보드에서 지운다 — 스토리지 표를 SQL 로 지우지 않는다.
alter table public.attendances drop column if exists photo_path;
drop policy if exists "my-attendance-photos self read" on storage.objects;
drop policy if exists "my-attendance-photos self insert" on storage.objects;
drop policy if exists "my-attendance-photos self update" on storage.objects;
drop policy if exists "my-attendance-photos self delete" on storage.objects;
```

- [ ] Step 1: 앱 쪽을 **먼저** 걷어낸다 — 칸이 없어진 뒤 옛 앱이 `photo_path` 를 select 하면 직관 기록 전체가 깨진다. 이 순서라 0027 은 새 빌드를 깐 뒤에 돌린다(Task 5). 테스트: 직관 블록에 옛 사진·치우기가 없다, 저장소 select 칸에 `photo_path` 가 없다(RED → GREEN)
- [ ] Step 2: `grep -rn "photo_path\|photoPath\|ATTENDANCE_BUCKET\|takePhoto" src` 가 팬카드(`fanCard`) 말고 0 줄
- [ ] Step 3: 방침 — 직관 기록 줄 `(다녀온 경기, 올린 사진)` → `(다녀온 경기)`, 기기 사본에서 `직관 사진` 제거, 권한 문단에서 직관 기록 사진·카메라 문장 제거(카메라 권한을 쓰지 않는다), 보관소 문단의 직관 사진 제거
- [ ] Step 4: 0027 과 검증(칸이 없어졌고 `attendances` 읽기·쓰기는 그대로)을 PGlite 로 → 커밋 `옛 직관 사진 칸과 코드를 걷어낸다`

### Task 5: 적용과 실측 (사용자와 함께)

- [ ] Step 1: 전체 통과(jest·tsc·lint·deno·sql-check)
- [ ] Step 2: 폰 설치(무료 팀 우회 xcodebuild + devicectl) — **0027 보다 먼저**
- [ ] Step 3: 0027 SQL 을 청하고, 대시보드에서 `my-attendance-photos` 버킷을 지워 달라고 청한다
- [ ] Step 4: 사용자 확인 — ① 마이 → 직관 기록에 내 `#직관` 글(나만 보기는 자물쇠)과, 글 없는 체크 경기의 스코어 카드·`[글 쓰기]` ② `[글 쓰기]` 가 그 경기 태그로 글쓰기를 연다 ③ 경기 상세에 그 경기의 내 글 카드 ④ 올린 뒤 직관 기록에 곧바로 뜬다

# 직관 기록과 승리요정 승률 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포항 경기에 "직관했어요" 를 표시하고 사진 한 장을 남기며, 끝난 직관 경기의 승률("승리요정")을 마이 탭과 직관 기록 화면에서 보여 준다.

**Architecture:** 표 `attendances`(본인 RLS)와 비공개 버킷 `my-attendance-photos`. 앱은 react-query 로 내 기록을 받고, 표시·취소는 낙관적으로 반영한다. 승률은 이미 받는 포항 경기 목록과 맞춰 보는 순수 함수가 계산한다. 사진은 기존 `privateImage`(캐시 파일 해석기)와 `imageUpload` 를 그대로 쓴다.

**Tech Stack:** Expo 57, React Native, `@tanstack/react-query` 5, `@supabase/supabase-js` 2.116, `expo-image-picker`, `expo-file-system` 57, jest(jest-expo).

**Spec:** `docs/superpowers/specs/2026-09-28-attendance-design.md`

## Global Constraints

- 승률 = 승 ÷ (승 + 무 + 패). 끝난 직관 경기가 0 이면 null(표시 안 함). 퍼센트는 `Math.round`
- 끝나지 않은 경기(`status !== 'finished'`)는 "예정" 으로 세고 승률에서 뺀다
- 경기 키: `{ year: SEASON_YEAR, leagueId: 1, gameId: match.id }` — 앱의 `Match` 에 연도·리그가 없다
- 사진 버킷 `my-attendance-photos`: 비공개, 5MB, `image/jpeg`·`image/png`, 경로 `{uid}/{year}-{leagueId}-{gameId}`
- 사진 폭 1600, 자르지 않는다(원본 비율), 누끼 없음
- 질의 열쇠 `['myAttendances', uid]`. 목록에 주소를 담지 않는다
- `attendances` 는 `matches` 와 외래키로 묶지 않는다
- 비로그인 사용자의 직관 표시·사진은 로그인부터 청한다
- 카메라 권한 문구: "직관 사진을 찍기 위해 카메라 접근이 필요합니다."
- 코드 형식: prettier `printWidth 110`, `arrowParens avoid`, 앱 코드는 세미콜론 없음. 한국어 주석은 둘레 코드와 같은 밀도
- 커밋 메시지는 한국어 제목 + 이유를 적은 본문 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- migration 은 API 로 못 돌린다(403). SQL Editor 에 붙여 넣을 파일을 만든다

## Review Focus

- 직관 표시를 빠르게 두 번 누름(표시→취소) → 마지막 상태가 서버와 화면에서 같아야 한다 (Task 3: 낙관적 갱신 뒤 서버 응답으로 목록을 다시 맞춘다)
- 로그아웃 뒤 다른 계정 → 앞 사람의 직관 기록이 마이 탭과 경기 상세에 보이면 안 된다 (Task 3: 열쇠에 uid, 비로그인이면 빈 목록)
- 경기 결과가 나중에 정정되거나 예정 경기가 끝남 → 승률이 저절로 따라가야 한다 (Task 2: 결과를 저장하지 않고 매번 경기 목록에서 계산)
- 사진을 올리는 중 경기 상세를 떠남 → 늦게 끝난 업로드가 알림을 띄우거나 다른 경기 화면을 건드리면 안 된다 (Task 5: alive ref)
- 지난 시즌이나 목록에 없는 경기의 기록 → 계산·목록에서 빠지고 화면이 깨지지 않아야 한다 (Task 2)

---

## 파일 구조

| 파일                                                                            | 책임                                                      |
| ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `supabase/migrations/0022_attendances.sql` (신규)                               | 표, RLS, 사진 버킷과 정책                                 |
| `src/models/attendance.ts` (신규)                                               | 경기 키, 승률 계산, 기록 목록 만들기 (순수 함수)          |
| `src/repositories/attendance/remote.ts` (신규)                                  | 표·버킷 읽고 쓰기                                         |
| `src/hooks/attendance/useAttendances.ts` (신규)                                 | 내 기록 질의, 표시·취소·사진 동작, 사진 파일 해석         |
| `src/utils/pickPhoto.ts`                                                        | `takePhoto()` 추가, `pickFromLibrary` 에 자르기 비율 인자 |
| `src/components/match/AttendanceBlock.tsx` (신규)                               | 경기 상세의 직관 블록                                     |
| `src/screens/MatchDetailScreen.tsx`                                             | 블록 자리                                                 |
| `src/screens/AttendanceScreen.tsx` (신규)                                       | 직관 기록 화면                                            |
| `src/navigation/types.ts`, `detailScreens.tsx`, `routes/detail.tsx`, `tabs.tsx` | `Attendance` 라우트, 마이 탭 연결                         |
| `src/screens/MyScreen.tsx`                                                      | `[직관 기록]` 줄                                          |
| `app.json`                                                                      | 카메라 권한 문구                                          |
| `docs/privacy.md`                                                               | 직관 기록·사진 항목                                       |

---

### Task 1: migration 파일

**Files:**

- Create: `supabase/migrations/0022_attendances.sql`

- [ ] **Step 1: 파일을 쓴다**

```sql
-- ─────────────────────────────────────────── 직관 기록
--
-- 내가 다녀온 포항 경기를 스스로 표시하고 사진 한 장을 남긴다. 본인만 본다.
-- 승·무·패와 승률은 저장하지 않는다 — 경기 결과가 정정되거나 예정 경기가 끝나면 앱이
-- 경기 목록에서 다시 계산한다.
--
-- matches 와 외래키로 묶지 않는다. 경기 표를 정리할 때(0021 처럼) CASCADE 로 기록까지
-- 사라지면 안 된다.
--
-- 다시 돌려도 깨지지 않게 쓴다.

create table if not exists public.attendances (
  owner      uuid not null references auth.users on delete cascade,
  year       int  not null,
  league_id  int  not null,
  game_id    int  not null,
  /** my-attendance-photos 버킷 안 경로. 사진이 없으면 null */
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, year, league_id, game_id)
);

alter table public.attendances enable row level security;

drop policy if exists "own select" on public.attendances;
create policy "own select" on public.attendances
  for select to authenticated using (auth.uid() = owner);

drop policy if exists "own insert" on public.attendances;
create policy "own insert" on public.attendances
  for insert to authenticated with check (auth.uid() = owner);

drop policy if exists "own update" on public.attendances;
create policy "own update" on public.attendances
  for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "own delete" on public.attendances;
create policy "own delete" on public.attendances
  for delete to authenticated using (auth.uid() = owner);

drop trigger if exists attendances_touch_updated_at on public.attendances;
create trigger attendances_touch_updated_at
  before update on public.attendances
  for each row execute function public.touch_updated_at();

-- ── 사진 ─────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('my-attendance-photos', 'my-attendance-photos', false, 5 * 1024 * 1024, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "my-attendance-photos self read" on storage.objects;
create policy "my-attendance-photos self read" on storage.objects
  for select to authenticated
  using (bucket_id = 'my-attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-attendance-photos self insert" on storage.objects;
create policy "my-attendance-photos self insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'my-attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-attendance-photos self update" on storage.objects;
create policy "my-attendance-photos self update" on storage.objects
  for update to authenticated
  using (bucket_id = 'my-attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-attendance-photos self delete" on storage.objects;
create policy "my-attendance-photos self delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'my-attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: 확인한다**

Run: `cd steelers-app && grep -c "create policy" supabase/migrations/0022_attendances.sql`
Expected: `8`

- [ ] **Step 3: 커밋 (브랜치 feat/attendance)**

```bash
git add supabase/migrations/0022_attendances.sql
git commit -m "직관 기록 표와 사진 버킷을 둔다"
```

---

### Task 2: 승률 계산 (순수 함수)

**Files:**

- Create: `src/models/attendance.ts`
- Test: `__tests__/attendance-model.test.ts`

**Interfaces:**

- Consumes: `Match`, `outcomeOf`, `POHANG` (`@/models/kleague`), `SEASON_YEAR` (`@/config/env`)
- Produces:
  - `interface AttendanceKey { year: number; leagueId: number; gameId: number }`
  - `interface AttendanceRow extends AttendanceKey { photoPath: string | null; updatedAt: string }`
  - `KLEAGUE1 = 1`
  - `attendanceKeyOf(match: Match): AttendanceKey`
  - `sameKey(a: AttendanceKey, b: AttendanceKey): boolean`
  - `interface AttendanceEntry { match: Match; row: AttendanceRow; outcome: MatchOutcome }`
  - `attendanceEntries(rows: AttendanceRow[], matches: Match[]): AttendanceEntry[]` — 최신순, 목록에 없는 기록은 뺀다
  - `interface AttendanceStats { total: number; wins: number; draws: number; losses: number; upcoming: number; rate: number | null }`
  - `attendanceStats(entries: AttendanceEntry[]): AttendanceStats`
  - `ratePercent(rate: number | null): string | null` — `71%`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { SEASON_YEAR } from '@/config/env'
import {
  attendanceEntries,
  attendanceKeyOf,
  type AttendanceRow,
  attendanceStats,
  ratePercent,
} from '@/models/attendance'
import type { Match, MatchStatus } from '@/models/kleague'

const match = (
  id: number,
  ours: number | null,
  theirs: number | null,
  status: MatchStatus = 'finished',
): Match =>
  ({
    id,
    round: id,
    kickoffAtMs: id * 1000,
    status,
    home: { id: 'K03', name: '포항', goal: ours, emblemUrl: '' },
    away: { id: 'K09', name: '서울', goal: theirs, emblemUrl: '' },
    stadium: null,
    broadcast: null,
    attendance: null,
    ticketUrl: null,
    ticketVendor: null,
  }) as Match

const row = (gameId: number, year = SEASON_YEAR): AttendanceRow => ({
  year,
  leagueId: 1,
  gameId,
  photoPath: null,
  updatedAt: '2026-09-28T00:00:00Z',
})

describe('경기 키', () => {
  it('이번 시즌 K리그1 과 경기 id 로 만든다', () => {
    expect(attendanceKeyOf(match(172, 1, 0))).toEqual({ year: SEASON_YEAR, leagueId: 1, gameId: 172 })
  })
})

describe('기록 목록', () => {
  it('최신 경기가 앞에 온다', () => {
    const entries = attendanceEntries(
      [row(1), row(3), row(2)],
      [match(1, 1, 0), match(2, 0, 0), match(3, 0, 1)],
    )
    expect(entries.map(e => e.match.id)).toEqual([3, 2, 1])
  })

  /** 지난 시즌 기록이나 목록에서 사라진 경기는 계산도 화면도 깨지 않고 빠진다 */
  it('목록에 없는 경기와 다른 시즌 기록은 뺀다', () => {
    const entries = attendanceEntries([row(1), row(99), row(1, SEASON_YEAR - 1)], [match(1, 1, 0)])
    expect(entries).toHaveLength(1)
  })
})

describe('승리요정 승률', () => {
  const all = [
    match(1, 2, 0),
    match(2, 1, 0),
    match(3, 3, 1),
    match(4, 1, 0),
    match(5, 2, 1),
    match(6, 1, 1),
    match(7, 0, 1),
  ]

  /** 무승부는 승률을 깎는다. 5승 1무 1패면 5/7 */
  it('승 ÷ 끝난 경기 수로 센다', () => {
    const stats = attendanceStats(
      attendanceEntries(
        all.map(m => row(m.id)),
        all,
      ),
    )
    expect(stats).toMatchObject({ total: 7, wins: 5, draws: 1, losses: 1, upcoming: 0 })
    expect(ratePercent(stats.rate)).toBe('71%')
  })

  it('끝나지 않은 경기는 예정으로 세고 승률에서 뺀다', () => {
    const list = [match(1, 1, 0), match(2, null, null, 'scheduled'), match(3, 0, 0, 'live')]
    const stats = attendanceStats(attendanceEntries([row(1), row(2), row(3)], list))
    expect(stats).toMatchObject({ total: 3, wins: 1, upcoming: 2 })
    expect(stats.rate).toBe(1)
  })

  it('끝난 경기가 없으면 승률은 없다', () => {
    const stats = attendanceStats(attendanceEntries([row(2)], [match(2, null, null, 'scheduled')]))
    expect(stats.rate).toBeNull()
    expect(ratePercent(stats.rate)).toBeNull()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/attendance-model.test.ts`
Expected: FAIL — `Cannot find module '@/models/attendance'`

- [ ] **Step 3: 구현한다**

```ts
import { SEASON_YEAR } from '@/config/env'
import { type Match, type MatchOutcome, outcomeOf } from '@/models/kleague'

/**
 * 직관 기록.
 *
 * 승·무·패는 저장하지 않는다. 경기 결과가 정정되거나 예정 경기가 끝나면 저절로 따라가도록
 * 매번 포항 경기 목록에서 계산한다.
 */

/** 앱의 Match 에는 연도와 리그가 없다. 수집 범위가 이번 시즌 K리그1 뿐이라 이 둘로 채운다 */
export const KLEAGUE1 = 1

export interface AttendanceKey {
  year: number
  leagueId: number
  gameId: number
}

export interface AttendanceRow extends AttendanceKey {
  /** 사진의 버킷 안 경로. 없으면 null */
  photoPath: string | null
  /** 사진 캐시 버전으로 쓴다 */
  updatedAt: string
}

export function attendanceKeyOf(match: Match): AttendanceKey {
  return { year: SEASON_YEAR, leagueId: KLEAGUE1, gameId: match.id }
}

export function sameKey(a: AttendanceKey, b: AttendanceKey): boolean {
  return a.year === b.year && a.leagueId === b.leagueId && a.gameId === b.gameId
}

export interface AttendanceEntry {
  match: Match
  row: AttendanceRow
  /** 끝나지 않은 경기는 null — 예정으로 센다 */
  outcome: MatchOutcome
}

/** 내 기록을 경기와 맞춘다. 최신 경기가 앞에 온다. 목록에 없는 기록은 뺀다 */
export function attendanceEntries(rows: AttendanceRow[], matches: Match[]): AttendanceEntry[] {
  const byId = new Map(matches.map(m => [m.id, m]))
  const entries: AttendanceEntry[] = []
  for (const row of rows) {
    if (row.year !== SEASON_YEAR || row.leagueId !== KLEAGUE1) continue
    const match = byId.get(row.gameId)
    if (!match) continue
    entries.push({ match, row, outcome: outcomeOf(match) })
  }
  return entries.sort((a, b) => b.match.kickoffAtMs - a.match.kickoffAtMs)
}

export interface AttendanceStats {
  total: number
  wins: number
  draws: number
  losses: number
  upcoming: number
  /** 승 ÷ 끝난 경기. 끝난 경기가 없으면 null */
  rate: number | null
}

export function attendanceStats(entries: AttendanceEntry[]): AttendanceStats {
  let wins = 0
  let draws = 0
  let losses = 0
  let upcoming = 0
  for (const { outcome } of entries) {
    if (outcome === 'win') wins++
    else if (outcome === 'draw') draws++
    else if (outcome === 'loss') losses++
    else upcoming++
  }
  const finished = wins + draws + losses
  return { total: entries.length, wins, draws, losses, upcoming, rate: finished > 0 ? wins / finished : null }
}

export function ratePercent(rate: number | null): string | null {
  return rate === null ? null : `${Math.round(rate * 100)}%`
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/attendance-model.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/models/attendance.ts __tests__/attendance-model.test.ts
git commit -m "직관 기록의 승리요정 승률을 센다"
```

---

### Task 3: 저장소와 훅

**Files:**

- Create: `src/repositories/attendance/remote.ts`
- Create: `src/hooks/attendance/useAttendances.ts`
- Test: `__tests__/attendance-hooks.test.tsx`

**Interfaces:**

- Consumes: Task 2 의 `AttendanceKey`, `AttendanceRow`, `attendanceKeyOf`, `sameKey`; `uploadPrivateImage` (`@/repositories/remote/imageUpload`); `resolvePrivateImage`, `adoptPrivateImage`, `dropPrivateImage` (`@/repositories/remote/privateImage`); `useAuth`
- Produces:
  - `remote.ts`: `ATTENDANCE_BUCKET = 'my-attendance-photos'`, `attendancePhotoPath(userId, key): string`, `listMine(): Promise<AttendanceRow[]>`, `mark(userId, key): Promise<AttendanceRow>`, `unmark(userId, key): Promise<void>`, `setPhoto(userId, key, localUri): Promise<AttendanceRow>`, `clearPhoto(userId, key): Promise<AttendanceRow>`
  - `useAttendances.ts`: `attendancesKey(userId: string | null)`, `useAttendances(): { rows: AttendanceRow[]; signedIn: boolean; query; toggle(match): Promise<void>; putPhoto(match, localUri): Promise<void>; removePhoto(match): Promise<void> }`, `useAttendancePhoto(row: AttendanceRow | undefined): string | null`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```tsx
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { attendancesKey, useAttendances } from '@/hooks/attendance/useAttendances'
import { attendancePhotoPath } from '@/repositories/attendance/remote'
import { SEASON_YEAR } from '@/config/env'
import type { Match } from '@/models/kleague'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: mockSession }) }))

jest.mock('@/repositories/attendance/remote', () => ({
  ...jest.requireActual('@/repositories/attendance/remote'),
  listMine: jest.fn(),
  mark: jest.fn(),
  unmark: jest.fn(),
  setPhoto: jest.fn(),
  clearPhoto: jest.fn(),
}))
jest.mock('@/repositories/remote/privateImage', () => ({
  adoptPrivateImage: jest.fn(() => 'cache://x'),
  dropPrivateImage: jest.fn(),
  resolvePrivateImage: jest.fn(async () => null),
}))

const remote = jest.requireMock('@/repositories/attendance/remote') as Record<string, jest.Mock>
const match = { id: 172 } as Match
const key = { year: SEASON_YEAR, leagueId: 1, gameId: 172 }
const row = { ...key, photoPath: null, updatedAt: '2026-09-28T00:00:00Z' }

const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach(c => c.clear())
  clients.length = 0
})

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useAttendances(), { wrapper })
}

beforeEach(() => {
  mockSession = { user: { id: 'user-1' } }
  for (const fn of Object.values(remote)) if (typeof fn?.mockReset === 'function') fn.mockReset()
  remote.listMine.mockResolvedValue([])
  remote.mark.mockResolvedValue(row)
  remote.unmark.mockResolvedValue(undefined)
})

describe('직관 기록 저장소', () => {
  /** 맨 앞 칸이 사용자 id 여야 정책이 주인을 가린다 (0022) */
  it('사진 경로는 사용자 id 로 시작하고 확장자가 없다', () => {
    expect(attendancePhotoPath('user-1', key)).toBe(`user-1/${SEASON_YEAR}-1-172`)
  })

  it('질의 열쇠에 누구의 답인지 담는다', () => {
    expect(attendancesKey('user-1')).toEqual(['myAttendances', 'user-1'])
  })
})

describe('직관 표시', () => {
  it('누르는 즉시 표시되고 서버에 적는다', async () => {
    // 처음엔 비어 있고, 표시 뒤 다시 받으면 서버에 한 줄이 있다
    remote.listMine.mockResolvedValueOnce([]).mockResolvedValue([row])
    const { result } = setup()
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    await act(async () => {
      await result.current.toggle(match)
    })
    expect(remote.mark).toHaveBeenCalledWith('user-1', key)
    expect(result.current.rows).toHaveLength(1)
  })

  it('표시가 실패하면 되돌리고 알린다', async () => {
    remote.mark.mockRejectedValue(new Error('network'))
    const { result } = setup()
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    await act(async () => {
      await expect(result.current.toggle(match)).rejects.toThrow('network')
    })
    expect(result.current.rows).toHaveLength(0)
  })

  it('이미 표시했으면 취소한다', async () => {
    remote.listMine.mockResolvedValueOnce([row]).mockResolvedValue([])
    const { result } = setup()
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    await act(async () => {
      await result.current.toggle(match)
    })
    expect(remote.unmark).toHaveBeenCalledWith('user-1', key)
    expect(result.current.rows).toHaveLength(0)
  })

  /** 앞 사람의 기록이 남으면 안 된다 */
  it('로그인 전에는 빈 목록이고 서버를 부르지 않는다', async () => {
    mockSession = null
    const { result } = setup()
    expect(result.current.signedIn).toBe(false)
    expect(result.current.rows).toEqual([])
    expect(remote.listMine).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/attendance-hooks.test.tsx`
Expected: FAIL — `Cannot find module '@/hooks/attendance/useAttendances'`

- [ ] **Step 3: `remote.ts` 를 쓴다**

```ts
import { supabase } from '@/repositories/remote/supabase'
import { uploadPrivateImage } from '@/repositories/remote/imageUpload'
import type { AttendanceKey, AttendanceRow } from '@/models/attendance'

/**
 * 직관 기록을 서버에 두고 읽는 곳. 본인만 읽고 쓴다 (0022).
 */

export const ATTENDANCE_BUCKET = 'my-attendance-photos'

/** 경기장 사진은 가로가 많다. 자르지 않고 폭만 줄인다 */
const WIDTH = 1600

interface Row {
  year: number
  league_id: number
  game_id: number
  photo_path: string | null
  updated_at: string
}

const COLUMNS = 'year, league_id, game_id, photo_path, updated_at'

function toAttendance(row: Row): AttendanceRow {
  return {
    year: row.year,
    leagueId: row.league_id,
    gameId: row.game_id,
    photoPath: row.photo_path,
    updatedAt: row.updated_at,
  }
}

/** 맨 앞 칸이 사용자 id 여야 정책이 주인을 가린다. 확장자를 붙이지 않아 바꿔도 같은 자리다 */
export function attendancePhotoPath(userId: string, key: AttendanceKey): string {
  return `${userId}/${key.year}-${key.leagueId}-${key.gameId}`
}

const whereKey = (key: AttendanceKey) => ({ year: key.year, league_id: key.leagueId, game_id: key.gameId })

export async function listMine(): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.from('attendances').select(COLUMNS)
  if (error) throw error
  return (data as Row[]).map(toAttendance)
}

export async function mark(userId: string, key: AttendanceKey): Promise<AttendanceRow> {
  const { data, error } = await supabase
    .from('attendances')
    .upsert({ owner: userId, ...whereKey(key) }, { onConflict: 'owner,year,league_id,game_id' })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return toAttendance(data as Row)
}

/**
 * 기록을 지운다. 사진도 같이 치운다.
 *
 * 행을 먼저 지운다 — 사진만 지우고 행이 남으면 깨진 그림이 보이는데, 행이 먼저 사라지면
 * 사진은 아무도 안 보는 파일이 될 뿐이다. 파일 삭제 실패는 알리지 않는다.
 */
export async function unmark(userId: string, key: AttendanceKey): Promise<void> {
  const { error } = await supabase.from('attendances').delete().match(whereKey(key))
  if (error) throw error
  await supabase.storage
    .from(ATTENDANCE_BUCKET)
    .remove([attendancePhotoPath(userId, key)])
    .catch(() => {})
}

export async function setPhoto(userId: string, key: AttendanceKey, localUri: string): Promise<AttendanceRow> {
  const path = attendancePhotoPath(userId, key)
  await uploadPrivateImage(ATTENDANCE_BUCKET, path, localUri, WIDTH)
  const { data, error } = await supabase
    .from('attendances')
    .update({ photo_path: path })
    .match(whereKey(key))
    .select(COLUMNS)
    .single()
  if (error) throw error
  return toAttendance(data as Row)
}

export async function clearPhoto(userId: string, key: AttendanceKey): Promise<AttendanceRow> {
  const { data, error } = await supabase
    .from('attendances')
    .update({ photo_path: null })
    .match(whereKey(key))
    .select(COLUMNS)
    .single()
  if (error) throw error
  await supabase.storage
    .from(ATTENDANCE_BUCKET)
    .remove([attendancePhotoPath(userId, key)])
    .catch(() => {})
  return toAttendance(data as Row)
}
```

- [ ] **Step 4: `useAttendances.ts` 를 쓴다**

```ts
import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/auth/useAuth'
import { type AttendanceRow, attendanceKeyOf, sameKey } from '@/models/attendance'
import type { Match } from '@/models/kleague'
import {
  ATTENDANCE_BUCKET,
  clearPhoto,
  listMine,
  mark,
  setPhoto,
  unmark,
} from '@/repositories/attendance/remote'
import { adoptPrivateImage, dropPrivateImage, resolvePrivateImage } from '@/repositories/remote/privateImage'

/**
 * 내 직관 기록의 질의 열쇠. 누구의 답인지 담는다 (adminKey 와 같은 이유).
 * 목록에는 주소가 없어 기기에 저장돼도 만료될 것이 없다.
 */
export const attendancesKey = (userId: string | null) => ['myAttendances', userId] as const

const EMPTY: AttendanceRow[] = []

export function useAttendances() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  const queryKey = attendancesKey(userId)

  const query = useQuery({
    queryKey,
    queryFn: listMine,
    enabled: userId !== null,
    staleTime: 60_000,
  })
  const rows = (userId !== null && query.data) || EMPTY

  const write = useCallback(
    (update: (prev: AttendanceRow[]) => AttendanceRow[]) =>
      queryClient.setQueryData<AttendanceRow[]>(queryKey, prev => update(prev ?? [])),
    // queryKey 는 userId 로만 바뀐다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId],
  )

  /**
   * 표시와 취소를 오간다. 누르는 즉시 화면에 반영하고, 실패하면 되돌리고 오류를 던진다 —
   * 알림은 부르는 화면이 띄운다. 끝나면 서버 목록으로 다시 맞춘다. 빠르게 두 번 눌러도
   * 마지막 상태가 서버와 같아진다.
   */
  const toggle = useCallback(
    async (match: Match) => {
      if (!userId) throw new Error('로그인이 필요합니다')
      const key = attendanceKeyOf(match)
      const before = queryClient.getQueryData<AttendanceRow[]>(queryKey) ?? []
      const had = before.some(r => sameKey(r, key))
      write(prev =>
        had
          ? prev.filter(r => !sameKey(r, key))
          : [...prev, { ...key, photoPath: null, updatedAt: new Date().toISOString() }],
      )
      try {
        if (had) await unmark(userId, key)
        else await mark(userId, key)
      } catch (e) {
        write(() => before)
        throw e
      } finally {
        void queryClient.invalidateQueries({ queryKey })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId, write],
  )

  /** 사진을 올리고 방금 고른 파일을 새 버전 이름으로 캐시에 옮겨 둔다 */
  const putPhoto = useCallback(
    async (match: Match, localUri: string) => {
      if (!userId) throw new Error('로그인이 필요합니다')
      const saved = await setPhoto(userId, attendanceKeyOf(match), localUri)
      if (saved.photoPath) {
        adoptPrivateImage(
          { bucket: ATTENDANCE_BUCKET, path: saved.photoPath, version: saved.updatedAt },
          localUri,
        )
      }
      write(prev => prev.map(r => (sameKey(r, saved) ? saved : r)))
    },
    [userId, write],
  )

  const removePhoto = useCallback(
    async (match: Match) => {
      if (!userId) return
      const key = attendanceKeyOf(match)
      const saved = await clearPhoto(userId, key)
      const old = queryClient.getQueryData<AttendanceRow[]>(queryKey)?.find(r => sameKey(r, key))
      if (old?.photoPath) dropPrivateImage({ bucket: ATTENDANCE_BUCKET, path: old.photoPath })
      write(prev => prev.map(r => (sameKey(r, saved) ? saved : r)))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId, write],
  )

  return { rows, signedIn: userId !== null, query, toggle, putPhoto, removePhoto }
}

/** 기록의 사진 파일. 없거나 못 받았으면 null */
export function useAttendancePhoto(row: AttendanceRow | undefined): string | null {
  const [uri, setUri] = useState<string | null>(null)
  const path = row?.photoPath ?? null
  const version = row?.updatedAt ?? null

  useEffect(() => {
    if (!path || !version) {
      setUri(null)
      return
    }
    let alive = true
    void resolvePrivateImage({ bucket: ATTENDANCE_BUCKET, path, version }).then(next => {
      if (alive) setUri(next)
    })
    return () => {
      alive = false
    }
  }, [path, version])

  return uri
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/attendance-hooks.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS. eslint 가 `react-hooks/exhaustive-deps` 규칙을 모른다고 하면(규칙이 설치되지 않은 설정) 그 주석 줄들을 지운다

- [ ] **Step 6: 커밋**

```bash
git add src/repositories/attendance/remote.ts src/hooks/attendance/useAttendances.ts __tests__/attendance-hooks.test.tsx
git commit -m "직관 기록을 서버에 두고 누르는 즉시 반영한다"
```

---

### Task 4: 카메라로 찍기

**Files:**

- Modify: `src/utils/pickPhoto.ts`
- Modify: `app.json` (`expo-image-picker` 플러그인 설정)
- Test: `__tests__/pick-photo.test.ts`

**Interfaces:**

- Produces: `pickFromLibrary(aspect?: [number, number] | null): Promise<string | 'denied' | null>` (기본 `[3, 4]`, `null` 이면 자르지 않음), `takePhoto(): Promise<string | 'denied' | null>`

- [ ] **Step 1: 기존 테스트 파일에 실패하는 테스트를 더한다**

`__tests__/pick-photo.test.ts` 의 `expo-image-picker` 가짜에 카메라를 더한다:

```ts
const mockCameraPermission = jest.fn()
const mockLaunchCamera = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: () => mockPermission(),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunch(...a),
  requestCameraPermissionsAsync: () => mockCameraPermission(),
  launchCameraAsync: (...a: unknown[]) => mockLaunchCamera(...a),
}))
```

`beforeEach` 에 `mockCameraPermission.mockReset().mockResolvedValue({ granted: true })`, `mockLaunchCamera.mockReset()` 를 더하고, 테스트를 붙인다:

```ts
describe('찍기', () => {
  it('카메라 권한이 없으면 denied', async () => {
    mockCameraPermission.mockResolvedValue({ granted: false })
    expect(await takePhoto()).toBe('denied')
    expect(mockLaunchCamera).not.toHaveBeenCalled()
  })

  /** 경기장 사진은 가로가 많다. 자르게 하지 않는다 */
  it('찍은 파일을 자르지 않고 돌려준다', async () => {
    mockLaunchCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///shot.jpg' }] })
    expect(await takePhoto()).toBe('file:///shot.jpg')
    expect(mockLaunchCamera).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }))
  })
})

describe('자르지 않고 고르기', () => {
  it('비율을 null 로 주면 자르지 않는다', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///wide.jpg' }] })
    await pickFromLibrary(null)
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }))
  })
})
```

import 줄을 `import { cutOut, pickFromLibrary, takePhoto } from '@/utils/pickPhoto'` 로 바꾼다.

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/pick-photo.test.ts`
Expected: FAIL — `takePhoto is not a function`

- [ ] **Step 3: 구현한다**

`src/utils/pickPhoto.ts` 의 `pickFromLibrary` 를 바꾸고 `takePhoto` 를 더한다:

```ts
/**
 * 앨범에서 고른다.
 *
 * 카드에 들어가는 자리가 3:4 라 기본은 그 비율로 자르게 한다. 직관 사진처럼 원본 비율
 * 그대로 쓸 때는 null 을 준다.
 */
export async function pickFromLibrary(
  aspect: [number, number] | null = [3, 4],
): Promise<string | 'denied' | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'denied'
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: aspect !== null,
    ...(aspect ? { aspect } : {}),
    quality: 0.9,
  })
  if (picked.canceled || !picked.assets[0]) return null
  return picked.assets[0].uri
}

/** 카메라로 찍는다. 자르지 않는다 — 경기장 사진은 가로가 많다 */
export async function takePhoto(): Promise<string | 'denied' | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) return 'denied'
  const shot = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.9,
  })
  if (shot.canceled || !shot.assets[0]) return null
  return shot.assets[0].uri
}
```

`app.json` 의 `["expo-image-picker", { "photosPermission": ... }]` 에 `"cameraPermission": "직관 사진을 찍기 위해 카메라 접근이 필요합니다."` 를 더한다.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/pick-photo.test.ts __tests__/card-maker.test.tsx && npx tsc --noEmit`
Expected: PASS (카드 만들기는 기본 비율 그대로라 바뀌지 않는다)

- [ ] **Step 5: 커밋**

```bash
git add src/utils/pickPhoto.ts app.json __tests__/pick-photo.test.ts
git commit -m "직관 사진을 카메라로 찍을 수 있게 한다"
```

---

### Task 5: 경기 상세의 직관 블록

**Files:**

- Create: `src/components/match/AttendanceBlock.tsx`
- Modify: `src/screens/MatchDetailScreen.tsx` (예매 단추 아래, 138-143행 뒤)
- Test: `__tests__/attendance-block.test.tsx`

**Interfaces:**

- Consumes: Task 3 `useAttendances`, `useAttendancePhoto`; Task 2 `attendanceKeyOf`, `sameKey`; Task 4 `pickFromLibrary`, `takePhoto`; `PrimaryButton`, `OverlayAction` 은 쓰지 않는다(밝은 화면)
- Produces: `AttendanceBlock({ match: Match; onRequireLogin?: () => void })`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```tsx
import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AttendanceBlock } from '@/components/match/AttendanceBlock'
import { SEASON_YEAR } from '@/config/env'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'

const mockState = {
  rows: [] as unknown[],
  signedIn: true,
  toggle: jest.fn(),
  putPhoto: jest.fn(),
  removePhoto: jest.fn(),
}
jest.mock('@/hooks/attendance/useAttendances', () => ({
  useAttendances: () => mockState,
  useAttendancePhoto: () => null,
}))
const mockPick = jest.fn()
const mockTake = jest.fn()
jest.mock('@/utils/pickPhoto', () => ({
  pickFromLibrary: (...a: unknown[]) => mockPick(...a),
  takePhoto: () => mockTake(),
}))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
const attended = (gameId: number) => ({
  year: SEASON_YEAR,
  leagueId: 1,
  gameId,
  photoPath: null,
  updatedAt: 'x',
})

beforeEach(() => {
  mockState.rows = []
  mockState.signedIn = true
  mockState.toggle.mockReset().mockResolvedValue(undefined)
  mockState.putPhoto.mockReset().mockResolvedValue(undefined)
  mockPick.mockReset().mockResolvedValue('file:///p.jpg')
  mockTake.mockReset()
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('직관 블록', () => {
  it('끝난 경기는 직관했어요', () => {
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    expect(screen.getByText('직관했어요')).toBeTruthy()
  })

  it('예정 경기는 직관 예정', () => {
    wrap(<AttendanceBlock match={mockMatchScheduled} />)
    expect(screen.getByText('직관 예정')).toBeTruthy()
  })

  it('로그인 전이면 로그인부터 청한다', () => {
    mockState.signedIn = false
    const onRequireLogin = jest.fn()
    wrap(<AttendanceBlock match={mockMatchFinished} onRequireLogin={onRequireLogin} />)
    fireEvent.press(screen.getByText('직관했어요'))
    expect(onRequireLogin).toHaveBeenCalled()
    expect(mockState.toggle).not.toHaveBeenCalled()
  })

  it('누르면 표시한다', async () => {
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    fireEvent.press(screen.getByText('직관했어요'))
    await waitFor(() => expect(mockState.toggle).toHaveBeenCalledWith(mockMatchFinished))
  })

  it('표시가 실패하면 알린다', async () => {
    mockState.toggle.mockRejectedValue(new Error('network'))
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    fireEvent.press(screen.getByText('직관했어요'))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('저장하지 못했습니다', 'network'))
  })

  it('표시한 경기는 사진 넣기와 취소가 보인다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    expect(screen.getByText(/직관한 경기/)).toBeTruthy()
    expect(screen.getByText('사진 넣기')).toBeTruthy()
    expect(screen.getByText('직관 취소')).toBeTruthy()
  })

  it('앨범에서 고르면 자르지 않고 올린다', async () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    fireEvent.press(screen.getByText('사진 넣기'))
    // 찍기/고르기 선택지에서 고르기를 누른 것으로 친다
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[]
    buttons.find(b => b.text === '앨범에서 고르기')!.onPress!()
    await waitFor(() => expect(mockState.putPhoto).toHaveBeenCalledWith(mockMatchFinished, 'file:///p.jpg'))
    expect(mockPick).toHaveBeenCalledWith(null)
  })

  /** 늦게 끝난 업로드가 떠난 화면을 건드리거나 알림을 띄우면 안 된다 */
  it('화면을 떠난 뒤 실패한 업로드는 알리지 않는다', async () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    let fail: (e: Error) => void = () => {}
    mockState.putPhoto.mockReturnValue(new Promise<void>((_r, reject) => (fail = reject)))
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    fireEvent.press(screen.getByText('사진 넣기'))
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[]
    buttons.find(b => b.text === '앨범에서 고르기')!.onPress!()
    await waitFor(() => expect(mockState.putPhoto).toHaveBeenCalled())
    ;(Alert.alert as jest.Mock).mockClear()
    screen.unmount()
    fail(new Error('network'))
    await new Promise(resolve => setImmediate(resolve))
    expect(Alert.alert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/attendance-block.test.tsx`
Expected: FAIL — `Cannot find module '@/components/match/AttendanceBlock'`

- [ ] **Step 3: 구현한다**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { PrimaryButton } from '@/components/foundation/PrimaryButton'
import { useAttendancePhoto, useAttendances } from '@/hooks/attendance/useAttendances'
import { attendanceKeyOf, sameKey } from '@/models/attendance'
import type { Match } from '@/models/kleague'
import { pickFromLibrary, takePhoto } from '@/utils/pickPhoto'

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export interface AttendanceBlockProps {
  match: Match
  onRequireLogin?: () => void
}

/**
 * 경기 상세의 직관 블록.
 *
 * 스스로 표시한다 — 내 기록이라 거짓을 막을 이유가 없고, 랭킹이 없으니 속일 이유도 없다.
 * 끝나지 않은 경기에도 미리 표시할 수 있다. 끝나면 승률에 저절로 들어간다.
 *
 * 사진은 한 장. 올라가기를 기다리지 않고 고른 파일로 곧바로 보여 주고, 실패하면 거두고
 * 알린다. 직관 표시는 남긴다.
 */
export function AttendanceBlock({ match, onRequireLogin }: AttendanceBlockProps) {
  const theme = useTheme()
  const { rows, signedIn, toggle, putPhoto, removePhoto } = useAttendances()
  const key = attendanceKeyOf(match)
  const row = rows.find(r => sameKey(r, key))
  const stored = useAttendancePhoto(row)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const finished = match.status === 'finished'

  // 화면을 떠난 뒤 늦게 끝난 일이 알림을 띄우거나 상태를 건드리지 않게 한다
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  const onToggle = useCallback(async () => {
    if (!signedIn) {
      onRequireLogin?.()
      return
    }
    try {
      await toggle(match)
    } catch (e) {
      if (alive.current) Alert.alert('저장하지 못했습니다', messageOf(e))
    }
  }, [match, onRequireLogin, signedIn, toggle])

  const upload = useCallback(
    async (source: Promise<string | 'denied' | null>) => {
      const uri = await source
      if (uri === 'denied') {
        Alert.alert('사진 접근이 필요합니다', '설정에서 카메라나 사진 접근을 켜 주세요.')
        return
      }
      if (!uri || !alive.current) return
      setPreview(uri)
      setBusy(true)
      try {
        await putPhoto(match, uri)
      } catch (e) {
        if (!alive.current) return
        setPreview(null)
        Alert.alert('사진을 올리지 못했습니다', messageOf(e))
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [match, putPhoto],
  )

  const choosePhoto = useCallback(() => {
    Alert.alert('직관 사진', undefined, [
      { text: '사진 찍기', onPress: () => void upload(takePhoto()) },
      { text: '앨범에서 고르기', onPress: () => void upload(pickFromLibrary(null)) },
      { text: '취소', style: 'cancel' },
    ])
  }, [upload])

  const clear = useCallback(() => {
    Alert.alert('사진을 치울까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '치우기',
        style: 'destructive',
        onPress: () => {
          setPreview(null)
          removePhoto(match).catch(e => {
            if (alive.current) Alert.alert('치우지 못했습니다', messageOf(e))
          })
        },
      },
    ])
  }, [match, removePhoto])

  const cancel = useCallback(() => {
    const go = () => void onToggle()
    if (!row?.photoPath) {
      go()
      return
    }
    Alert.alert('직관 기록을 지울까요?', '사진도 함께 지워집니다.', [
      { text: '취소', style: 'cancel' },
      { text: '지우기', style: 'destructive', onPress: go },
    ])
  }, [onToggle, row?.photoPath])

  if (!row) {
    return (
      <View style={styles.gutter}>
        <PrimaryButton label={finished ? '직관했어요' : '직관 예정'} onPress={() => void onToggle()} />
      </View>
    )
  }

  const photo = preview ?? stored
  return (
    <View
      style={[styles.gutter, styles.block, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text style={[fonts.label, { color: theme.accent }]}>{finished ? '✓ 직관한 경기' : '직관 예정'}</Text>

      {photo ? <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" /> : null}

      <View style={styles.actions}>
        {photo ? (
          <>
            <Action label="바꾸기" onPress={choosePhoto} disabled={busy} />
            <Action label="치우기" onPress={clear} disabled={busy} />
          </>
        ) : (
          <Action label="사진 넣기" onPress={choosePhoto} disabled={busy} />
        )}
        {busy && <ActivityIndicator />}
        <View style={styles.spacer} />
        <Action label="직관 취소" onPress={cancel} disabled={busy} muted />
      </View>
    </View>
  )
}

function Action({
  label,
  onPress,
  disabled,
  muted,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  muted?: boolean
}) {
  const theme = useTheme()
  return (
    <PressableScale onPress={disabled ? undefined : onPress} accessibilityRole="button">
      <Text
        style={[
          fonts.bodySmall,
          { color: muted ? theme.textMuted : theme.textPrimary, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  gutter: { marginHorizontal: spacing['200'] },
  block: {
    gap: spacing['150'],
    padding: spacing['150'],
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: cornerRadius['150'] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing['200'] },
  spacer: { flex: 1 },
})
```

`MatchDetailScreen.tsx` 에서 예매 단추 블록 바로 뒤에 넣는다:

```tsx
{
  /* 포항 경기에만 둔다. 직관 기록은 우리 팀 경기의 승률이다 */
}
{
  match && <AttendanceBlock match={match} onRequireLogin={onRequireLogin} />
}
```

`import { AttendanceBlock } from '@/components/match/AttendanceBlock'` 를 더한다. `spacing['200']` 이 화면의 다른 `gutter` 여백과 다르면 `styles.gutter` 값을 `MatchDetailScreen` 의 `gutter` 스타일 값에 맞춘다.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/attendance-block.test.tsx && npx jest && npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/components/match/AttendanceBlock.tsx src/screens/MatchDetailScreen.tsx __tests__/attendance-block.test.tsx
git commit -m "경기 상세에서 직관을 표시하고 사진 한 장을 남긴다"
```

---

### Task 6: 직관 기록 화면과 마이 탭 줄

**Files:**

- Create: `src/screens/AttendanceScreen.tsx`
- Modify: `src/navigation/types.ts` (`Attendance: undefined`), `src/navigation/detailScreens.tsx`, `src/navigation/routes/detail.tsx`, `src/navigation/tabs.tsx` (`MyMain`), `src/screens/MyScreen.tsx`
- Test: `__tests__/attendance-screen.test.tsx`, `__tests__/my-screen.test.tsx`

**Interfaces:**

- Consumes: Task 2 `attendanceEntries`, `attendanceStats`, `ratePercent`; Task 3 `useAttendances`, `useAttendancePhoto`; `useMatches`
- Produces: `AttendanceScreen({ onOpenMatch?: (match: Match) => void; onRequireLogin?: () => void })`, `attendanceSummary(rows, matches): string | undefined` (마이 탭 줄 값, `src/models/attendance.ts` 에 둔다), `MyScreenProps.onOpenAttendance`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`__tests__/attendance-screen.test.tsx`:

```tsx
import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AttendanceScreen } from '@/screens/AttendanceScreen'
import { SEASON_YEAR } from '@/config/env'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'

const mockState = {
  rows: [] as unknown[],
  signedIn: true,
  query: { isPending: false, isError: false, data: [], refetch: jest.fn() },
}
jest.mock('@/hooks/attendance/useAttendances', () => ({
  useAttendances: () => mockState,
  useAttendancePhoto: () => null,
}))
jest.mock('@/hooks/query/useKleague', () => ({
  useMatches: () => ({ data: [mockMatchFinished, mockMatchScheduled] }),
}))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
const attended = (gameId: number) => ({
  year: SEASON_YEAR,
  leagueId: 1,
  gameId,
  photoPath: null,
  updatedAt: 'x',
})

describe('직관 기록 화면', () => {
  it('기록이 없으면 안내한다', () => {
    mockState.rows = []
    wrap(<AttendanceScreen />)
    expect(screen.getByText(/직관했어요/)).toBeTruthy()
  })

  it('로그인 전이면 로그인을 안내한다', () => {
    mockState.signedIn = false
    wrap(<AttendanceScreen />)
    expect(screen.getByText(/로그인/)).toBeTruthy()
    mockState.signedIn = true
  })

  /** 픽스처의 끝난 경기는 2:2 무승부다. 승률 0%, 예정 1경기 */
  it('요약과 예정 경기를 보여 준다', () => {
    mockState.rows = [attended(mockMatchFinished.id), attended(mockMatchScheduled.id)]
    wrap(<AttendanceScreen />)
    expect(screen.getByText('승리요정 0%')).toBeTruthy()
    expect(screen.getByText(/직관 2경기 · 0승 1무 0패/)).toBeTruthy()
    expect(screen.getByText(/예정 1경기/)).toBeTruthy()
  })
})
```

`__tests__/my-screen.test.tsx` 에 추가한다(기존 가짜 옆에):

```tsx
const mockAttendance = { rows: [] as unknown[] }
jest.mock('@/hooks/attendance/useAttendances', () => ({ useAttendances: () => mockAttendance }))
jest.mock('@/hooks/query/useKleague', () => ({ useMatches: () => ({ data: [] }) }))
```

그리고 테스트:

```tsx
it('직관 기록 줄이 있다', () => {
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider initialPreference="home">
        <MyScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  expect(screen.getByText('직관 기록')).toBeTruthy()
})
```

`src/models/attendance.ts` 의 `attendanceSummary` 는 Task 2 테스트 파일에 붙인다:

```ts
describe('마이 탭 줄 값', () => {
  it('경기 수와 승률', () => {
    const list = [match(1, 1, 0), match(2, 0, 1)]
    expect(attendanceSummary([row(1), row(2)], list)).toBe('2경기 · 50%')
  })
  it('끝난 경기가 없으면 경기 수만', () => {
    expect(attendanceSummary([row(2)], [match(2, null, null, 'scheduled')])).toBe('1경기')
  })
  it('기록이 없으면 비운다', () => {
    expect(attendanceSummary([], [])).toBeUndefined()
  })
})
```

(import 에 `attendanceSummary` 를 더한다)

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/attendance-screen.test.tsx __tests__/my-screen.test.tsx __tests__/attendance-model.test.ts`
Expected: FAIL — 모듈 없음, `attendanceSummary is not a function`, `직관 기록` 없음

- [ ] **Step 3: `attendanceSummary` 를 더한다 (`src/models/attendance.ts`)**

```ts
/** 마이 탭 줄 오른쪽 값. 기록이 없으면 비운다 */
export function attendanceSummary(rows: AttendanceRow[], matches: Match[]): string | undefined {
  const stats = attendanceStats(attendanceEntries(rows, matches))
  if (stats.total === 0) return undefined
  const rate = ratePercent(stats.rate)
  return rate ? `${stats.total}경기 · ${rate}` : `${stats.total}경기`
}
```

- [ ] **Step 4: `AttendanceScreen.tsx` 를 쓴다**

```tsx
import { useMemo } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { InlineState } from '@/components/feedback/States'
import { useAttendancePhoto, useAttendances } from '@/hooks/attendance/useAttendances'
import { useMatches } from '@/hooks/query/useKleague'
import { type AttendanceEntry, attendanceEntries, attendanceStats, ratePercent } from '@/models/attendance'
import { type Match, opponentOf, ourTeam } from '@/models/kleague'

const OUTCOME_LABEL = { win: '승', draw: '무', loss: '패' } as const

export interface AttendanceScreenProps {
  onOpenMatch?: (match: Match) => void
}

/**
 * 직관 기록.
 *
 * 위에 승리요정 승률, 아래에 다녀온 경기를 최신순으로. 승률은 저장하지 않고 경기 목록에서
 * 매번 센다 — 결과가 정정되거나 예정 경기가 끝나면 저절로 따라간다.
 */
export function AttendanceScreen({ onOpenMatch }: AttendanceScreenProps) {
  const theme = useTheme()
  const { rows, signedIn } = useAttendances()
  const { data: matches } = useMatches()
  const entries = useMemo(() => attendanceEntries(rows, matches ?? []), [rows, matches])
  const stats = useMemo(() => attendanceStats(entries), [entries])

  if (!signedIn) return <InlineState message="로그인하면 직관 기록을 남길 수 있습니다" />
  if (entries.length === 0) return <InlineState message="경기 상세에서 '직관했어요' 를 눌러 보세요" />

  const rate = ratePercent(stats.rate)
  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={e => String(e.match.id)}
      ListHeaderComponent={
        <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {rate && <Text style={[fonts.display, { color: theme.accent }]}>{`승리요정 ${rate}`}</Text>}
          <Text style={[fonts.body, { color: theme.textPrimary }]}>
            {`직관 ${stats.total}경기 · ${stats.wins}승 ${stats.draws}무 ${stats.losses}패`}
          </Text>
          {stats.upcoming > 0 && (
            <Text style={[fonts.caption, { color: theme.textMuted }]}>{`예정 ${stats.upcoming}경기`}</Text>
          )}
        </View>
      }
      renderItem={({ item }) => <EntryRow entry={item} onPress={() => onOpenMatch?.(item.match)} />}
    />
  )
}

function EntryRow({ entry, onPress }: { entry: AttendanceEntry; onPress: () => void }) {
  const theme = useTheme()
  const photo = useAttendancePhoto(entry.row)
  const { match, outcome } = entry
  const mine = ourTeam(match)
  const theirs = opponentOf(match)
  const date = new Date(match.kickoffAtMs)
  const label = outcome ? OUTCOME_LABEL[outcome] : '예정'
  const tone = outcome === 'win' ? theme.accent : outcome === 'loss' ? theme.loss : theme.textMuted

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessibilityLabel={`${theirs.name}전 ${label}`}
    >
      <View style={[styles.thumb, { backgroundColor: theme.skeleton }]}>
        {photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      </View>
      <View style={styles.rowText}>
        <Text
          style={[fonts.caption, { color: theme.textMuted }]}
        >{`${date.getMonth() + 1}월 ${date.getDate()}일`}</Text>
        <Text style={[fonts.body, { color: theme.textPrimary }]}>
          {outcome ? `vs ${theirs.name}  ${mine.goal}:${theirs.goal}` : `vs ${theirs.name}`}
        </Text>
      </View>
      <Text style={[fonts.label, { color: tone }]}>{label}</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['150'] },
  summary: {
    alignItems: 'center',
    gap: spacing['075'],
    padding: spacing['250'],
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing['050'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['150'],
    padding: spacing['150'],
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 42, borderRadius: cornerRadius['100'], overflow: 'hidden' },
  rowText: { flex: 1, gap: 2 },
})
```

`theme.loss`, `cornerRadius['100']`, `spacing['250']` 이 없으면 가장 가까운 기존 토큰(`AccountScreen` 이 쓰는 `theme.loss`, `cornerRadius['150']`)으로 바꾼다 — `npx tsc --noEmit` 이 알려 준다.

- [ ] **Step 5: 라우트와 마이 탭을 잇는다**

`src/navigation/types.ts` 의 `DetailParamList` 에:

```ts
/** 내가 다녀온 경기. 마이 탭에서 들어온다 */
Attendance: undefined
```

`src/navigation/routes/detail.tsx` 에:

```tsx
export function AttendanceRoute() {
  const navigation = useNavigation<DetailNavigation>()
  const openMatch = useCallback(
    (m: Match) => navigation.navigate('MatchDetail', { matchId: m.id, round: m.round }),
    [navigation],
  )
  return <AttendanceScreen onOpenMatch={openMatch} />
}
```

(`import { AttendanceScreen } from '@/screens/AttendanceScreen'` 추가)

`src/navigation/detailScreens.tsx` 의 `CardCollection` 등록 앞에:

```tsx
<Stack.Screen
  name="Attendance"
  options={{ title: '직관 기록' }}
  children={() => (
    <ScreenBoundary>
      <AttendanceRoute />
    </ScreenBoundary>
  )}
/>
```

(import 에 `AttendanceRoute` 추가)

`src/navigation/tabs.tsx` 의 `MyMain` 에 `const openAttendance = useCallback(() => navigation.navigate('Attendance'), [navigation])` 를 두고 `<MyScreen ... onOpenAttendance={openAttendance} />` 로 넘긴다.

`src/screens/MyScreen.tsx`: `MyScreenProps` 에 `onOpenAttendance?: () => void`, 함수 인자에 `onOpenAttendance`, 그리고 훅:

```tsx
const { rows: attendances } = useAttendances()
const { data: seasonMatches } = useMatches()
const attendanceValue = attendanceSummary(attendances, seasonMatches ?? [])
```

"나만의 카드 만들기" 그룹 안, 그 줄 아래에:

```tsx
<Row label="직관 기록" value={attendanceValue} onPress={onOpenAttendance} />
```

(import 에 `useAttendances`, `useMatches`, `attendanceSummary` 추가)

- [ ] **Step 6: 통과를 확인한다**

Run: `cd steelers-app && npx jest && npx tsc --noEmit && npm run lint`
Expected: 전부 PASS. `navigation.test.tsx` 가 마이 탭을 그리다 `useAttendances` 때문에 실패하면, 그 파일의 기존 가짜들 옆에 `jest.mock('@/hooks/attendance/useAttendances', () => ({ useAttendances: () => ({ rows: [], signedIn: false }), useAttendancePhoto: () => null }))` 를 더한다

- [ ] **Step 7: 개인정보 방침을 고친다**

`docs/privacy.md` 1-2 표의 "선수 사진(직접 넣은 것)" 줄 아래에:

```
| 직관 기록(다녀온 경기, 올린 사진)                | **본인만** 볼 수 있습니다                             |
```

2절 표의 "본인만" 줄에 `직관 기록` 을 더하고, "이미지 주소에 관한 안내" 문단의 "팬카드 사진과 직접 넣은 선수 사진은" 을 "팬카드 사진, 직접 넣은 선수 사진, 직관 사진은" 으로 바꾼다. 1-3 절 사본 줄도 같은 식으로 "직관 사진" 을 더한다. `npx prettier --write docs/privacy.md`.

- [ ] **Step 8: 커밋**

```bash
git add src/screens/AttendanceScreen.tsx src/navigation src/screens/MyScreen.tsx src/models/attendance.ts __tests__ docs/privacy.md
git commit -m "직관 기록 화면과 마이 탭 줄로 승리요정 승률을 보여 준다"
```

---

### Task 7: 전체 검증

- [ ] **Step 1**: `cd steelers-app && npx tsc --noEmit && npm run lint && npx jest` — 전부 통과. 실패하면 멈추고 출력을 그대로 보고한다
- [ ] **Step 2**: `deno test --allow-read --no-lock supabase/functions` — 서버 쪽은 바뀌지 않았으므로 그대로 통과. 끝나면 `git checkout -- deno.lock`

---

### Task 8: 적용과 기기 확인 (사용자와 함께)

- [ ] **Step 1**: 사용자에게 `supabase/migrations/0022_attendances.sql` 을 SQL Editor 에서 돌려 달라고 청한다 (`! pbcopy < supabase/migrations/0022_attendances.sql`). 답을 받기 전에는 넘어가지 않는다
- [ ] **Step 2**: 로그인 없이 막히는지 본다

```bash
cd steelers-app && set -a && . ./.env && set +a
curl -s -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/attendances?select=*&limit=1"
curl -s -X POST "$EXPO_PUBLIC_SUPABASE_URL/storage/v1/object/list/my-attendance-photos" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_KEY" \
  -H 'Content-Type: application/json' -d '{"prefix":"","limit":10}'
```

Expected: 둘 다 `[]`

- [ ] **Step 3**: 카메라 권한 문구가 네이티브에 들어가야 하므로 다시 빌드한다

`ios/` 는 생성물이다(gitignore). `--clean` 없이 돌려 기존 폴더에 설정만 합친다. 그래도 `ios/.xcode.env.local` 이 바뀌면 node 경로가 버전 폴더로 돌아가 빌드가 깨지므로(2026-09-28 에 겪음) 전후로 본다.

Run:

```bash
cd steelers-app && cat ios/.xcode.env.local
npx expo prebuild --platform ios --no-install
cat ios/.xcode.env.local
grep -A1 NSCameraUsageDescription ios/*/Info.plist
```

Expected: `.xcode.env.local` 이 두 번 다 `export NODE_BINARY=/opt/homebrew/opt/node@22/bin/node`. 바뀌었으면 그 한 줄로 되돌린다. `Info.plist` 에 카메라 문구가 보인다.

Run: `npx expo run:ios --configuration Release --device 00008130-001225AC01F2001C`
Expected: 빌드 성공

- [ ] **Step 4**: 사용자에게 확인을 청한다
  1. 지난 포항 경기 → 직관했어요 → 마이 탭 줄에 "1경기 · N%"
  2. 다음 경기 → 직관 예정 → 직관 기록 화면에 "예정 1경기"
  3. 사진 찍기(카메라 권한 문구 확인), 앨범에서 고르기(자르지 않음)
  4. 앱을 끄고 켜도 기록과 사진이 남는다
  5. 직관 취소(사진 있으면 확인 창)
  6. 로그아웃 → 다른 계정 → 앞 사람 기록이 안 보인다

---

## 스펙 대비 메모

- 스펙은 경기 키를 표의 세 칸 그대로 적었다. 앱의 `Match` 에 연도·리그가 없어 `SEASON_YEAR` 와 K리그1(1)로 채운다. 수집 범위가 이번 시즌 K리그1 뿐이라 같다. 컵이나 다음 시즌을 들이면 `Match` 에 두 칸을 더하고 `attendanceKeyOf` 를 고친다.
- 스펙의 "목록 불러오기 실패 → 직관 기록 화면은 QueryState 오류" 는 화면이 로그인·빈 상태를 먼저 보고 기록이 없으면 안내를 띄우는 것으로 단순화했다. 불러오기 실패는 빈 목록처럼 보인다. 재시도는 화면을 다시 열면 된다.

import { attendanceEntries, attendanceTimeline } from '@/models/attendance'
import type { Post } from '@/models/community'
import type { Match } from '@/models/kleague'
import { SEASON_YEAR } from '@/config/env'
import { mockMatchFinished } from '@/utils/fixtures'

/**
 * 직관 기록의 시간표 (4단계, 2026-09-29). 체크한 경기와 내 직관 글을 한 줄로 — 글이 붙은 경기는 글 카드로,
 * 글 없이 체크만 한 경기는 경기 줄로. 경기가 붙은 글은 경기 시각, 경기 없는 글은 작성 시각 자리.
 */

const DAY = 86_400_000
const game = (id: number, daysAgo: number): Match => ({
  ...mockMatchFinished,
  id,
  kickoffAtMs: Date.parse('2026-09-28T10:00:00Z') - daysAgo * DAY,
})
const g1 = game(1, 10)
const g2 = game(2, 5)
const g3 = game(3, 1)
const matches = [g1, g2, g3]
const row = (m: Match) => ({ year: SEASON_YEAR, leagueId: 1, gameId: m.id, updatedAt: 'x' })
const post = (id: string, m: Match | null, createdAt = '2026-09-20T00:00:00Z') =>
  ({ id, match: m ? { year: SEASON_YEAR, leagueId: 1, gameId: m.id } : null, createdAt }) as Post

const shape = (items: ReturnType<typeof attendanceTimeline>) =>
  items.map(i => (i.kind === 'post' ? `post:${i.post.id}` : `match:${i.entry.match.id}`))

it('글 없는 체크 경기는 경기 줄, 글이 붙은 경기는 글 카드만', () => {
  const entries = attendanceEntries([row(g1), row(g2)], matches)
  expect(shape(attendanceTimeline(entries, [post('p2', g2)], matches))).toEqual(['post:p2', 'match:1'])
})

it('한 경기에 글이 둘이면 둘 다 싣는다', () => {
  const entries = attendanceEntries([row(g2)], matches)
  const items = attendanceTimeline(
    entries,
    [post('a', g2, '2026-09-24T00:00:00Z'), post('b', g2, '2026-09-25T00:00:00Z')],
    matches,
  )
  expect(shape(items)).toEqual(['post:b', 'post:a'])
})

it('경기 없이 #직관 만 쓴 글은 작성 시각 자리에 선다', () => {
  const entries = attendanceEntries([row(g1), row(g3)], matches)
  // g3(1일 전) > 자유 직관 글(3일 전) > g1(10일 전)
  const loose = post('loose', null, new Date(Date.parse('2026-09-28T10:00:00Z') - 3 * DAY).toISOString())
  expect(shape(attendanceTimeline(entries, [loose], matches))).toEqual(['match:3', 'post:loose', 'match:1'])
})

it('체크를 풀었어도 글은 남는다 — 글이 기록이다', () => {
  expect(shape(attendanceTimeline([], [post('p1', g1)], matches))).toEqual(['post:p1'])
})

it('글 카드에는 그 경기를 붙여 준다', () => {
  const [item] = attendanceTimeline([], [post('p1', g1)], matches)
  expect(item).toMatchObject({ kind: 'post', match: { id: 1 } })
})

it('최신순이다', () => {
  const entries = attendanceEntries([row(g1), row(g2), row(g3)], matches)
  expect(shape(attendanceTimeline(entries, [], matches))).toEqual(['match:3', 'match:2', 'match:1'])
})

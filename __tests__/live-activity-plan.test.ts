import { liveActivityDecision } from '@/models/liveActivityPlan'
import { attendanceKeyOf } from '@/models/attendance'
import type { Match } from '@/models/kleague'
import { mockMatchScheduled } from '@/utils/fixtures'

/**
 * 잠금 화면 킥오프 카운트다운 (2026-09-30). iOS 는 앱이 켜져 있을 때만 새로 띄울 수 있어서, 앱을 열 때마다
 * 지금 무엇을 띄우고 무엇을 내릴지 정한다.
 * - 띄우기: 직관 가요 경기, 킥오프 6시간 전부터 킥오프까지
 * - 내리기: 킥오프 3시간 뒤, 직관 체크를 풀었을 때(직접 띄운 것은 빼고), 설정을 껐을 때
 */

const HOUR = 3_600_000
const KICKOFF = Date.parse('2026-10-03T19:00:00+09:00')
const game = (id: number, kickoffAtMs = KICKOFF): Match => ({ ...mockMatchScheduled, id, kickoffAtMs })
const base = (over: Partial<Parameters<typeof liveActivityDecision>[0]> = {}) => ({
  matches: [game(1)],
  attended: [attendanceKeyOf(game(1))],
  enabled: true,
  active: null,
  now: KICKOFF - 2 * HOUR,
  ...over,
})

it('직관 경기 킥오프 6시간 전부터 띄운다', () => {
  expect(liveActivityDecision(base())).toEqual({ start: 1 })
  expect(liveActivityDecision(base({ now: KICKOFF - 7 * HOUR }))).toEqual({})
})

it('직관 체크가 없는 경기는 스스로 띄우지 않는다', () => {
  expect(liveActivityDecision(base({ attended: [] }))).toEqual({})
})

it('이미 떠 있으면 다시 띄우지 않는다', () => {
  expect(liveActivityDecision(base({ active: { gameId: 1, manual: false } }))).toEqual({})
})

it('킥오프 3시간 뒤에는 내린다', () => {
  expect(
    liveActivityDecision(base({ now: KICKOFF + 3 * HOUR + 1, active: { gameId: 1, manual: false } })),
  ).toEqual({
    end: true,
  })
  // 킥오프가 지났으면 새로 띄우지도 않는다
  expect(liveActivityDecision(base({ now: KICKOFF + HOUR }))).toEqual({})
})

it('직관 체크를 풀면 내리고, 직접 띄운 것은 둔다', () => {
  expect(liveActivityDecision(base({ attended: [], active: { gameId: 1, manual: false } }))).toEqual({
    end: true,
  })
  expect(liveActivityDecision(base({ attended: [], active: { gameId: 1, manual: true } }))).toEqual({})
})

it('설정을 끄면 띄우지 않고, 떠 있던 것도 내린다', () => {
  expect(liveActivityDecision(base({ enabled: false }))).toEqual({})
  expect(liveActivityDecision(base({ enabled: false, active: { gameId: 1, manual: true } }))).toEqual({
    end: true,
  })
})

it('경기 목록에서 사라진 경기가 떠 있으면 내린다', () => {
  expect(liveActivityDecision(base({ matches: [], active: { gameId: 1, manual: true } }))).toEqual({
    end: true,
  })
})

it('두 경기가 겹치면 먼저 하는 경기를 띄운다', () => {
  const early = game(2, KICKOFF - HOUR)
  const decision = liveActivityDecision(
    base({ matches: [game(1), early], attended: [attendanceKeyOf(game(1)), attendanceKeyOf(early)] }),
  )
  expect(decision).toEqual({ start: 2 })
})

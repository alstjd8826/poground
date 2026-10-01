import { MAX_SCHEDULED, planNotifications } from '@/models/notificationPlan'
import { attendanceKeyOf } from '@/models/attendance'
import type { Match } from '@/models/kleague'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'

/**
 * 기기가 스스로 울리는 알림 (2026-09-30). 두 가지를 따로 켜고 끈다.
 * - 직관 경기 알림(기본 켜짐): 직관 가요 경기에 전날 저녁 8시 + 킥오프 1시간 전
 * - 모든 경기 킥오프 알림(기본 꺼짐): 포항 모든 예정 경기에 1시간 전. 직관 경기와 겹치면 한 번만
 */

const at = (s: string) => new Date(s).getTime()
// 픽스처 예정 경기: 포항(홈) vs 서울, 2026-09-20 19:00(+09:00), 포항 스틸야드
const game = (id: number, kickoff: string): Match => ({ ...mockMatchScheduled, id, kickoffAtMs: at(kickoff) })
const NOW = at('2026-09-15T12:00:00+09:00')

it('직관 경기는 전날 저녁 8시와 킥오프 1시간 전에 울린다', () => {
  const m = game(1, '2026-09-20T19:00:00+09:00')
  const plan = planNotifications({
    matches: [m],
    attended: [attendanceKeyOf(m)],
    prefs: { attended: true, allKickoffs: false },
    now: NOW,
  })
  expect(plan.map(n => [n.id, n.at])).toEqual([
    ['eve-1', at('2026-09-19T20:00:00+09:00')],
    ['kick-1', at('2026-09-20T18:00:00+09:00')],
  ])
  expect(plan[0]).toMatchObject({ title: '내일 직관이에요', gameId: 1 })
  expect(plan[0]!.body).toBe('포항 vs 서울 · 19:00 포항 스틸야드')
  expect(plan[1]!.title).toBe('1시간 뒤 킥오프')
})

it('모든 경기 알림을 켜면 직관 안 가는 경기도 1시간 전에, 직관 경기와는 겹치지 않게', () => {
  const going = game(1, '2026-09-20T19:00:00+09:00')
  const home = game(2, '2026-09-27T19:00:00+09:00')
  const plan = planNotifications({
    matches: [going, home],
    attended: [attendanceKeyOf(going)],
    prefs: { attended: true, allKickoffs: true },
    now: NOW,
  })
  expect(plan.map(n => n.id)).toEqual(['eve-1', 'kick-1', 'kick-2'])
})

it('직관 경기 알림을 끄면 직관 경기도 모든 경기 알림으로만 울린다', () => {
  const going = game(1, '2026-09-20T19:00:00+09:00')
  expect(
    planNotifications({
      matches: [going],
      attended: [attendanceKeyOf(going)],
      prefs: { attended: false, allKickoffs: true },
      now: NOW,
    }).map(n => n.id),
  ).toEqual(['kick-1'])
  expect(
    planNotifications({
      matches: [going],
      attended: [attendanceKeyOf(going)],
      prefs: { attended: false, allKickoffs: false },
      now: NOW,
    }),
  ).toEqual([])
})

it('지난 시각과 끝난 경기는 잡지 않는다', () => {
  // 전날 8시는 지났고 1시간 전은 아직
  const tonight = game(3, '2026-09-15T19:00:00+09:00')
  const plan = planNotifications({
    matches: [tonight, mockMatchFinished],
    attended: [attendanceKeyOf(tonight), attendanceKeyOf(mockMatchFinished)],
    prefs: { attended: true, allKickoffs: true },
    now: NOW,
  })
  expect(plan.map(n => n.id)).toEqual(['kick-3'])
})

it('가까운 순으로, 기기가 들고 있을 수 있는 만큼만', () => {
  const many = Array.from({ length: 80 }, (_, i) =>
    game(100 + i, new Date(NOW + (i + 2) * 86_400_000).toISOString()),
  )
  const plan = planNotifications({
    matches: many,
    attended: [],
    prefs: { attended: true, allKickoffs: true },
    now: NOW,
  })
  expect(plan).toHaveLength(MAX_SCHEDULED)
  expect(plan[0]!.gameId).toBe(100)
  expect([...plan].sort((a, b) => a.at - b.at)).toEqual(plan)
})

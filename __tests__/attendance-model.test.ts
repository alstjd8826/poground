import { SEASON_YEAR } from '@/config/env'
import {
  attendanceCountdown,
  attendanceEntries,
  attendanceKeyOf,
  type AttendanceRow,
  attendanceStats,
  attendanceSummary,
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

/** 홈의 다음 경기 카드 오른쪽 위에 테이프로 붙인다 (2026-09-30). 달력 날짜로 센다 — 밤 경기라도 시간이 아니라 날로 */
describe('직관 D-day', () => {
  const at = (s: string) => new Date(s).getTime()

  it('경기 날이면 D-DAY', () => {
    expect(attendanceCountdown(at('2026-10-05T19:00:00'), at('2026-10-05T09:00:00'))).toBe('D-DAY')
  })

  it('남은 날을 달력으로 센다', () => {
    expect(attendanceCountdown(at('2026-10-05T19:00:00'), at('2026-10-04T23:30:00'))).toBe('D-1')
    expect(attendanceCountdown(at('2026-10-05T19:00:00'), at('2026-10-02T08:00:00'))).toBe('D-3')
  })
})

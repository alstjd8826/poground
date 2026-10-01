import { fairyCardData, matchProofData } from '@/models/shareCard'
import type { AttendanceEntry } from '@/models/attendance'
import type { Match, MatchOutcome } from '@/models/kleague'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'

/**
 * 승리요정 공유 카드에 담을 숫자 (2026-09-30). 끝난 경기만 센다 — 아직 안 한 경기를 "직관 N경기" 에 넣으면
 * 밖에 올린 카드가 부풀려진다. 최근 직관은 끝난 경기 셋, 최신순
 */

const entry = (
  id: number,
  kickoffAtMs: number,
  home: number,
  away: number,
  outcome: MatchOutcome,
): AttendanceEntry => {
  const match: Match = {
    ...mockMatchFinished,
    id,
    kickoffAtMs,
    home: { ...mockMatchFinished.home, goal: home },
    away: { ...mockMatchFinished.away, goal: away },
  }
  return { match, row: { year: 2026, leagueId: 1, gameId: id, updatedAt: 'x' }, outcome }
}
const at = (s: string) => new Date(s).getTime()

it('끝난 경기만 세고 승률을 낸다', () => {
  const entries = [
    entry(1, at('2026-09-20T19:00:00'), 2, 1, 'win'),
    entry(2, at('2026-09-13T19:00:00'), 0, 1, 'loss'),
    entry(3, at('2026-08-30T19:00:00'), 3, 0, 'win'),
    { match: mockMatchScheduled, row: { year: 2026, leagueId: 1, gameId: 9, updatedAt: 'x' }, outcome: null },
  ]
  const card = fairyCardData(entries)!
  expect(card.played).toBe(3)
  expect([card.wins, card.draws, card.losses]).toEqual([2, 0, 1])
  expect(card.rate).toBe('67%')
})

it('최근 직관은 끝난 경기 셋, 최신순으로 날짜·상대·스코어·결과를 담는다', () => {
  const entries = [
    entry(1, at('2026-09-20T19:00:00'), 2, 1, 'win'),
    entry(2, at('2026-09-13T19:00:00'), 0, 1, 'loss'),
    entry(3, at('2026-08-30T19:00:00'), 3, 0, 'win'),
    entry(4, at('2026-08-16T19:00:00'), 1, 1, 'draw'),
  ]
  const { recent } = fairyCardData(entries)!
  expect(recent).toHaveLength(3)
  expect(recent[0]).toMatchObject({ date: '9.20', outcome: 'win' })
  expect(recent.map(r => r.date)).toEqual(['9.20', '9.13', '8.30'])
  // 스코어는 우리 팀 먼저
  expect(recent[1]!.score).toMatch(/^\d+:\d+$/)
})

it('끝난 직관 경기가 없으면 카드를 만들지 않는다', () => {
  expect(fairyCardData([])).toBeNull()
  expect(
    fairyCardData([
      {
        match: mockMatchScheduled,
        row: { year: 2026, leagueId: 1, gameId: 9, updatedAt: 'x' },
        outcome: null,
      },
    ]),
  ).toBeNull()
})

/** 한 경기 직관 인증 카드 (2026-09-30). 끝난 경기만. 우리 팀을 먼저 적는다 */
describe('직관 인증 카드', () => {
  it('원정 경기도 우리 팀을 먼저, 날짜·경기장·결과를 담는다', () => {
    // 픽스처는 대전 2:2 포항, 9월 12일 대전 월드컵
    const card = matchProofData(mockMatchFinished)!
    expect(card).toMatchObject({ us: '포항', them: '대전', ourGoal: 2, theirGoal: 2, outcome: 'draw' })
    expect(card.date).toMatch(/^9\.12 \([일월화수목금토]\)$/)
    expect(card.stadium).toBe(mockMatchFinished.stadium)
    expect(card.side).toBe('원정')
  })

  it('끝나지 않은 경기는 카드를 만들지 않는다', () => {
    expect(matchProofData(mockMatchScheduled)).toBeNull()
  })
})

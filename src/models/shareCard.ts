import { type AttendanceEntry, ratePercent } from '@/models/attendance'
import { type Match, opponentOf, ourTeam, outcomeOf, sideOf } from '@/models/kleague'

/** 카드에 싣는 최근 직관 경기 수 */
const RECENT = 3

export interface RecentLine {
  gameId: number
  /** 9.20 */
  date: string
  opponent: string
  /** 우리 팀 먼저. 2:1 */
  score: string
  outcome: 'win' | 'draw' | 'loss'
}

export interface FairyCardData {
  /** 승리요정 승률. 67% */
  rate: string
  /** 끝난 직관 경기 수 */
  played: number
  wins: number
  draws: number
  losses: number
  recent: RecentLine[]
}

/**
 * 승리요정 공유 카드에 담을 숫자 (2026-09-30).
 *
 * 끝난 경기만 센다 — 아직 안 한 경기를 "직관 N경기" 에 넣으면 밖에 올린 카드가 부풀려진다. 끝난 직관 경기가
 * 없으면 카드를 만들지 않는다(null). 최근 직관은 끝난 경기 셋, 최신순. entries 는 attendanceEntries 가 준
 * 최신순을 그대로 받는다.
 */
export function fairyCardData(entries: AttendanceEntry[]): FairyCardData | null {
  const finished = entries.filter(e => e.outcome !== null)
  if (finished.length === 0) return null
  const wins = finished.filter(e => e.outcome === 'win').length
  const draws = finished.filter(e => e.outcome === 'draw').length
  const losses = finished.length - wins - draws
  const recent = [...finished]
    .sort((a, b) => b.match.kickoffAtMs - a.match.kickoffAtMs)
    .slice(0, RECENT)
    .map(({ match, outcome }) => {
      const d = new Date(match.kickoffAtMs)
      return {
        gameId: match.id,
        date: `${d.getMonth() + 1}.${d.getDate()}`,
        opponent: opponentOf(match).name,
        score: `${ourTeam(match).goal}:${opponentOf(match).goal}`,
        outcome: outcome as RecentLine['outcome'],
      }
    })
  return { rate: ratePercent(wins / finished.length)!, played: finished.length, wins, draws, losses, recent }
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

export interface MatchProofData {
  us: string
  them: string
  ourGoal: number
  theirGoal: number
  outcome: 'win' | 'draw' | 'loss'
  /** 9.20 (토) */
  date: string
  stadium: string | null
  side: '홈' | '원정'
}

/**
 * 한 경기 직관 인증 카드에 담을 것 (2026-09-30). 끝난 경기만 — 결과가 없는 경기를 "직관했어요" 로 올릴 일은
 * 없다. 홈이든 원정이든 우리 팀을 먼저 적는다.
 */
export function matchProofData(match: Match): MatchProofData | null {
  const outcome = outcomeOf(match)
  if (outcome === null) return null
  const d = new Date(match.kickoffAtMs)
  return {
    us: ourTeam(match).name,
    them: opponentOf(match).name,
    ourGoal: ourTeam(match).goal ?? 0,
    theirGoal: opponentOf(match).goal ?? 0,
    outcome,
    date: `${d.getMonth() + 1}.${d.getDate()} (${WEEKDAY[d.getDay()]})`,
    stadium: match.stadium,
    side: sideOf(match) === 'home' ? '홈' : '원정',
  }
}

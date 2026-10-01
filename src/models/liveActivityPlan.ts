import { type AttendanceKey, attendanceKeyOf, sameKey } from '@/models/attendance'
import type { Match } from '@/models/kleague'

/**
 * 잠금 화면 킥오프 카운트다운을 언제 띄우고 내릴지 (2026-09-30).
 *
 * iOS 는 앱이 켜져 있을 때만 Live Activity 를 새로 띄울 수 있다(서버 푸시 없이). 그래서 앱을 열 때마다 지금
 * 무엇을 띄우고 무엇을 내릴지 정한다. 한 번에 하나만 띄운다.
 *
 * - 띄우기: 직관 가요 경기, 킥오프 6시간 전부터 킥오프까지. 겹치면 먼저 하는 경기
 * - 내리기: 킥오프 3시간 뒤, 직관 체크를 풀었을 때(경기 상세에서 직접 띄운 것은 빼고), 설정을 껐을 때,
 *   경기 목록에서 그 경기가 사라졌을 때
 */

const HOUR = 3_600_000
/** 킥오프 몇 시간 전부터 스스로 띄우나 */
export const START_BEFORE = 6 * HOUR
/** 킥오프 몇 시간 뒤에 내리나. iOS 도 켜진 것을 8시간 뒤 스스로 내린다 */
export const END_AFTER = 3 * HOUR
/** 경기 상세의 [잠금 화면에 띄우기] 가 보이는 창. 킥오프 24시간 전부터 */
export const MANUAL_BEFORE = 24 * HOUR

export interface ActiveCountdown {
  gameId: number
  /** 경기 상세에서 직접 띄웠는가. 직관 체크를 풀어도 내리지 않는다 */
  manual: boolean
}

export type LiveActivityDecision = { start?: number; end?: true }

export function liveActivityDecision({
  matches,
  attended,
  enabled,
  active,
  now,
}: {
  matches: Match[]
  attended: AttendanceKey[]
  enabled: boolean
  active: ActiveCountdown | null
  now: number
}): LiveActivityDecision {
  const going = (m: Match) => attended.some(k => sameKey(k, attendanceKeyOf(m)))

  if (active) {
    const match = matches.find(m => m.id === active.gameId)
    const over = !match || now > match.kickoffAtMs + END_AFTER
    const dropped = match !== undefined && !active.manual && !going(match)
    return !enabled || over || dropped ? { end: true } : {}
  }
  if (!enabled) return {}

  const next = matches
    .filter(m => m.status === 'scheduled' && going(m))
    .filter(m => now >= m.kickoffAtMs - START_BEFORE && now < m.kickoffAtMs)
    .sort((a, b) => a.kickoffAtMs - b.kickoffAtMs)[0]
  return next ? { start: next.id } : {}
}

/** 경기 상세에서 직접 띄울 수 있는가. 킥오프 24시간 전부터 킥오프까지의 예정 경기 */
export function canStartManually(match: Match, now: number): boolean {
  return match.status === 'scheduled' && now >= match.kickoffAtMs - MANUAL_BEFORE && now < match.kickoffAtMs
}

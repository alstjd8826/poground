import { SEASON_YEAR } from '@/config/env'
import { type Match, type MatchOutcome, outcomeOf } from '@/models/kleague'
import type { Post } from '@/models/community'

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
  updatedAt: string
}

export function attendanceKeyOf(match: Match): AttendanceKey {
  return { year: SEASON_YEAR, leagueId: KLEAGUE1, gameId: match.id }
}

export function sameKey(a: AttendanceKey, b: AttendanceKey): boolean {
  return a.year === b.year && a.leagueId === b.leagueId && a.gameId === b.gameId
}

/**
 * 경기 키로 경기를 찾는 함수. 경기 id 는 시즌·리그마다 다시 쓰이므로 id 만으로 찾으면 지난 시즌 글이
 * 올해 같은 번호 경기에 붙는다. 한 번 만들어 두고 글마다 부른다
 */
export function matchLookup(matches: Match[]): (key: AttendanceKey | null) => Match | undefined {
  const byKey = new Map(matches.map(m => [keyText(attendanceKeyOf(m)), m]))
  return key => (key ? byKey.get(keyText(key)) : undefined)
}

const keyText = (k: AttendanceKey) => `${k.year}:${k.leagueId}:${k.gameId}`

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

/** 마이 탭 줄 오른쪽 값. 기록이 없으면 비운다 */
export function attendanceSummary(rows: AttendanceRow[], matches: Match[]): string | undefined {
  const stats = attendanceStats(attendanceEntries(rows, matches))
  if (stats.total === 0) return undefined
  const rate = ratePercent(stats.rate)
  return rate ? `${stats.total}경기 · ${rate}` : `${stats.total}경기`
}

/**
 * 직관 예정 경기까지 남은 날. 홈의 다음 경기 카드 오른쪽 위에 테이프로 붙인다.
 *
 * 시간이 아니라 달력 날짜로 센다 — 내일 저녁 경기를 오늘 밤에 보면 24시간이 안 남았어도 D-1 이다.
 */
export function attendanceCountdown(kickoffAtMs: number, nowMs: number = Date.now()): string {
  const day = (ms: number) => {
    const d = new Date(ms)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const days = Math.round((day(kickoffAtMs) - day(nowMs)) / 86_400_000)
  return days <= 0 ? 'D-DAY' : `D-${days}`
}

/** 직관 기록 시간표의 한 줄. 글 카드거나, 글 없이 체크만 한 경기 줄이다 */
export type TimelineItem =
  { kind: 'post'; post: Post; match: Match | undefined } | { kind: 'match'; entry: AttendanceEntry }

/**
 * 체크한 경기와 내 직관 글을 한 줄로 (4단계, 2026-09-29).
 *
 * 글이 붙은 경기는 글 카드로(여럿이면 여럿), 글 없이 체크만 한 경기는 경기 줄로. 체크를 풀었어도 글은
 * 남는다 — 글이 기록이다. 경기가 붙은 글은 경기 시각, 경기 없는 글(#직관 만 쓴 것)은 작성 시각으로
 * 최신순. 같은 경기 글끼리는 나중에 쓴 것이 앞이다.
 */
export function attendanceTimeline(
  entries: AttendanceEntry[],
  posts: Post[],
  matches: Match[],
): TimelineItem[] {
  const matchOf = (post: Post) =>
    post.match ? matches.find(m => sameKey(attendanceKeyOf(m), post.match!)) : undefined
  const timed: { at: number; tie: number; item: TimelineItem }[] = []

  const covered = new Set<number>()
  for (const post of posts) {
    const match = matchOf(post)
    if (match) covered.add(match.id)
    const written = Date.parse(post.createdAt)
    timed.push({ at: match ? match.kickoffAtMs : written, tie: written, item: { kind: 'post', post, match } })
  }
  for (const entry of entries) {
    if (covered.has(entry.match.id)) continue
    timed.push({ at: entry.match.kickoffAtMs, tie: 0, item: { kind: 'match', entry } })
  }

  return timed.sort((a, b) => b.at - a.at || b.tie - a.tie).map(t => t.item)
}

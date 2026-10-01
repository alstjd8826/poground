import { matchRepository } from '@/repositories/kleague/matchRepository'
import { type Match, POHANG } from '@/models/kleague'
import { toMatch } from './mappers'

const MINUTE = 60_000
/** 축구 한 경기는 하프타임 포함 대략 2시간이면 끝난다. 여유를 둬 150분을 "아직 오늘 경기" 로 본다. */
const MATCH_WINDOW = 150 * MINUTE

/**
 * 경기 도메인.
 *
 * 리포지토리가 가져온 행을 화면이 쓰는 개념으로 바꾼다.
 * "다음 경기", "최근 경기" 같은 판단이 화면이나 훅에 흩어지지 않게 여기 모은다.
 */

/** 다음 경기 = 아직 안 끝난 것 중 가장 이른 경기 */
export function nextMatchOf(matches: Match[] | undefined, now = new Date()): Match | undefined {
  return matches
    ?.filter(m => m.status !== 'finished' && m.kickoffAtMs >= now.getTime() - MATCH_WINDOW)
    .sort((a, b) => a.kickoffAtMs - b.kickoffAtMs)[0]
}

/** 최근 경기 = 끝난 것 중 가장 늦은 경기 */
export function lastMatchOf(matches: Match[] | undefined): Match | undefined {
  return matches?.filter(m => m.status === 'finished').sort((a, b) => b.kickoffAtMs - a.kickoffAtMs)[0]
}

/** 진행 중인 경기가 있으면 화면을 더 자주 갱신해야 한다 */
export function hasLiveMatch(matches: Match[] | undefined): boolean {
  return !!matches?.some(m => m.status === 'live')
}

export interface HomeMatches {
  all: Match[]
  next?: Match
  last?: Match
  hasLive: boolean
}

/**
 * 시즌 목록에서 홈 화면이 필요로 하는 것만 추린다.
 *
 * 네트워크를 타지 않는 순수 함수다. 훅이 시즌 목록 쿼리 하나에 select 로 얹어 쓰므로
 * 홈과 일정 탭이 같은 캐시를 공유하고, 같은 데이터를 두 번 받아오지 않는다.
 */
export function toHomeMatches(all: Match[], now = new Date()): HomeMatches {
  return { all, next: nextMatchOf(all, now), last: lastMatchOf(all), hasLive: hasLiveMatch(all) }
}

/** 일정 탭: 시즌 전체를 킥오프 순으로 */
export async function getSeasonMatches(teamId = POHANG): Promise<Match[]> {
  return (await matchRepository.findByTeam(teamId)).map(toMatch)
}

// ─────────────────────────────── 월 필터

/** 'YYYY-MM'. 정렬하면 시간 순이 되고, 화면이 라벨을 만들기도 쉽다 */
export type MatchMonth = string

export function monthKeyOf(match: Match): MatchMonth {
  const d = new Date(match.kickoffAtMs)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 경기가 하루라도 있는 달만, 시간 순으로 */
export function monthsOf(matches: Match[] | undefined): MatchMonth[] {
  return [...new Set((matches ?? []).map(monthKeyOf))].sort()
}

/**
 * 시즌이 놓인 해의 열두 달 전부. 경기가 없는 달도 자리를 지킨다.
 *
 * 비어 있다는 것도 정보다 — 6월이 빠진 걸 보여줘야 "왜 없지" 가 아니라 "이 달은 쉬는구나"
 * 로 읽힌다. 화면은 이 목록을 늘어놓고 monthsOf 에 없는 달을 잠근다.
 * 시즌이 해를 넘기면 두 해의 열두 달을 모두 준다.
 */
export function seasonMonthsOf(matches: Match[] | undefined): MatchMonth[] {
  const years = [...new Set(monthsOf(matches).map(m => m.slice(0, 4)))].sort()
  return years.flatMap(year =>
    Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`),
  )
}

export function matchesInMonth(matches: Match[] | undefined, month: MatchMonth): Match[] {
  return (matches ?? []).filter(m => monthKeyOf(m) === month).sort((a, b) => a.kickoffAtMs - b.kickoffAtMs)
}

/**
 * 처음 보여줄 달.
 *
 * 다음 경기가 있는 달을 연다 — 팬이 일정 탭을 여는 이유는 대개 "다음이 언제냐" 다.
 * 시즌이 끝났으면 마지막 경기가 있는 달로 떨어진다.
 */
export function defaultMonthOf(matches: Match[] | undefined, now = new Date()): MatchMonth | undefined {
  const all = matches ?? []
  if (all.length === 0) return undefined
  const next = nextMatchOf(all, now)
  return monthKeyOf(next ?? lastMatchOf(all) ?? all[0]!)
}

/** '2026-09' -> '9월' */
export function monthLabelOf(month: MatchMonth): string {
  return `${Number(month.slice(5))}월`
}

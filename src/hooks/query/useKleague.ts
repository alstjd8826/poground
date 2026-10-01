import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getClubs, getHeadCoach, getSquad } from '@/services/kleague/clubService'
import { getSeasonMatches, toHomeMatches } from '@/services/kleague/matchService'
import { getNewsDetail, getRecentNews } from '@/services/kleague/newsService'
import { getMatchLineup } from '@/services/kleague/lineupService'
import { getPlayerAppearances } from '@/services/kleague/playerService'
import { getStandingsWithOurTeam } from '@/services/kleague/standingService'
import { getMatchVideos, getVideos } from '@/services/kleague/videoService'
import { type Match, POHANG } from '@/models/kleague'

/**
 * react-query 글루.
 *
 * 여기에는 캐시 정책(queryKey, staleTime)만 둔다.
 * 데이터를 어디서 어떻게 가져오는지는 services/ 와 repositories/ 가 안다.
 * 훅은 예외 없이 services/ 만 부른다. 리포지토리를 직접 부르지 않는다 —
 * 한 군데라도 뚫려 있으면 나중에 규칙이 생겼을 때 넣을 자리를 찾기 어렵다.
 */

/** 수집 주기에 맞춰 staleTime 을 잡는다. 서버가 30분마다 긁는 걸 앱이 1분마다 물어볼 이유가 없다. */
const MINUTE = 60_000

export const queryKeys = {
  matches: (teamId: string) => ['matches', teamId] as const,
  standings: (teamId: string) => ['standings', teamId] as const,
  news: (limit: number) => ['news', limit] as const,
  newsDetail: (seq: number) => ['news', 'detail', seq] as const,
  videos: (category?: string) => ['videos', category ?? 'all'] as const,
  matchVideos: (round: number) => ['videos', 'round', round] as const,
  matchLineup: (gameId: number) => ['lineup', gameId] as const,
  squad: (teamId: string) => ['squad', teamId] as const,
  playerAppearances: (playerId: string) => ['player', playerId, 'appearances'] as const,
  clubs: () => ['clubs'] as const,
  headCoach: (teamId: string) => ['club', teamId, 'coach'] as const,
}

export function useMatches(teamId = POHANG) {
  return useQuery({
    queryKey: queryKeys.matches(teamId),
    queryFn: () => getSeasonMatches(teamId),
    staleTime: 5 * MINUTE,
  })
}

/**
 * 홈 화면용. 시즌 목록과 같은 캐시를 쓰고 select 로 필요한 것만 추린다.
 * 키를 따로 두면 같은 데이터를 두 번 받아오고, 다른 화면에서 캐시를 못 쓴다.
 */
export function useHomeMatches(teamId = POHANG) {
  return useQuery({
    queryKey: queryKeys.matches(teamId),
    queryFn: () => getSeasonMatches(teamId),
    staleTime: 5 * MINUTE,
    select: toHomeMatches,
  })
}

export function useStandings(teamId = POHANG) {
  return useQuery({
    queryKey: queryKeys.standings(teamId),
    queryFn: () => getStandingsWithOurTeam(teamId),
    staleTime: 30 * MINUTE,
  })
}

/**
 * 순위 목록만 필요한 화면용. select 로 같은 캐시에서 배열만 꺼낸다.
 * 별도 쿼리가 아니므로 요청이 두 번 나가지 않는다.
 */
export function useStandingsList(teamId = POHANG) {
  return useQuery({
    queryKey: queryKeys.standings(teamId),
    queryFn: () => getStandingsWithOurTeam(teamId),
    staleTime: 30 * MINUTE,
    select: s => s.all,
  })
}

export function useNews(limit = 30) {
  return useQuery({
    queryKey: queryKeys.news(limit),
    queryFn: () => getRecentNews(limit),
    staleTime: 15 * MINUTE,
  })
}

export function useNewsDetail(seq: number) {
  return useQuery({
    queryKey: queryKeys.newsDetail(seq),
    queryFn: () => getNewsDetail(seq),
    // 기사 본문은 한 번 확정되면 바뀌지 않는다
    staleTime: Infinity,
  })
}

export function useVideos(category?: string) {
  return useQuery({
    queryKey: queryKeys.videos(category),
    queryFn: () => getVideos(category),
    staleTime: 30 * MINUTE,
    /**
     * 카테고리를 바꿔도 이전 목록을 화면에 둔 채 뒤에서 받아온다.
     *
     * 없으면 탭 한 번에 목록이 두 번 갈아엎어진다.
     *   목록 언마운트 -> 스켈레톤 마운트 -> 스켈레톤 언마운트 -> 카드 재마운트
     * 이 마운트/언마운트가 JS 스레드를 잡아서 탭 반응이 늦어진다.
     */
    placeholderData: keepPreviousData,
  })
}

export function useMatchVideos(round: number) {
  return useQuery({
    queryKey: queryKeys.matchVideos(round),
    queryFn: () => getMatchVideos(round),
    staleTime: 30 * MINUTE,
  })
}

/**
 * 경기 라인업.
 *
 * 끝난 경기의 라인업은 더 바뀌지 않지만, 진행 중인 경기는 교체·경고가 계속 붙는다.
 * 수집이 경기 창에서 5분마다 도므로 앱도 그 정도만 신선하면 된다.
 */
export function useMatchLineup(match?: Match) {
  return useQuery({
    queryKey: queryKeys.matchLineup(match?.id ?? -1),
    queryFn: () => getMatchLineup(match!.id, match),
    // 경기 객체가 아직 캐시에 없으면 게임 ID 를 모르므로 요청 자체를 미룬다
    enabled: match != null,
    staleTime: match?.status === 'live' ? 5 * MINUTE : 60 * MINUTE,
  })
}

export function useSquad(teamId = POHANG) {
  return useQuery({
    queryKey: queryKeys.squad(teamId),
    queryFn: () => getSquad(teamId),
    staleTime: 60 * MINUTE,
  })
}

/** 한 선수의 출전 기록. 경기가 끝나야 늘어나므로 자주 물을 이유가 없다 */
export function usePlayerAppearances(playerId: string | null) {
  return useQuery({
    queryKey: queryKeys.playerAppearances(playerId ?? ''),
    queryFn: () => getPlayerAppearances(playerId!),
    enabled: Boolean(playerId),
    staleTime: 60 * MINUTE,
  })
}

/** 지금 감독. 시즌 중에 한두 번 바뀔까 말까라 오래 묵혀 둔다 */
export function useHeadCoach(teamId = POHANG) {
  return useQuery({
    queryKey: queryKeys.headCoach(teamId),
    queryFn: () => getHeadCoach(teamId),
    staleTime: 24 * 60 * MINUTE,
  })
}

export function useClubs() {
  return useQuery({
    queryKey: queryKeys.clubs(),
    queryFn: () => getClubs(),
    staleTime: 24 * 60 * MINUTE,
  })
}

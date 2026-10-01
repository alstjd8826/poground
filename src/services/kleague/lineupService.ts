import { lineupRepository } from '@/repositories/kleague/lineupRepository'
import type { Match, MatchLineup } from '@/models/kleague'
import { toMatchLineup } from './mappers'

/**
 * 라인업 도메인.
 *
 * 선수 행과 감독 행이 다른 테이블에 있지만 화면에서는 한 덩어리로 읽힌다.
 * 두 번 부르는 건 여기서 끝내고, 화면에는 이미 갈라 놓은 모양으로 넘긴다.
 */
export async function getMatchLineup(gameId: number, match?: Match): Promise<MatchLineup> {
  // 감독이 없어도 라인업은 보여줘야 하므로 둘을 나란히 기다린다
  const [players, coaches] = await Promise.all([
    lineupRepository.findByMatch(gameId),
    lineupRepository.findCoaches(gameId),
  ])
  return toMatchLineup(players, coaches, match)
}

import { lineupRepository } from '@/repositories/kleague/lineupRepository'
import { matchRepository } from '@/repositories/kleague/matchRepository'
import { opponentOf, type PlayerAppearance, POHANG, sideOf } from '@/models/kleague'
import { toMatch } from './mappers'

/**
 * 한 선수의 출전 기록.
 *
 * 라인업 행 하나가 곧 한 경기지만, 그 행은 상대가 누구였는지도 언제였는지도 모른다.
 * 경기 목록과 이어 붙여야 "9.12 대전 원정에서 선발" 이 된다.
 *
 * 명단에만 들고 안 뛴 경기는 뺀다 — 교체 명단에 앉아 있던 것을 "출전" 으로 세면
 * 시즌 합계와 어긋나 보인다. 선발이거나 교체로 들어간 경기만 남긴다.
 */
export async function getPlayerAppearances(playerId: string, teamId = POHANG): Promise<PlayerAppearance[]> {
  const [rows, matchRows] = await Promise.all([
    lineupRepository.findByPlayer(playerId),
    matchRepository.findByTeam(teamId),
  ])

  const matches = new Map(matchRows.map(toMatch).map(m => [m.id, m]))

  return rows
    .map(row => {
      const match = matches.get(row.game_id)
      if (!match) return null
      const played = row.is_starter || row.records.includes('교체')
      if (!played) return null
      return {
        matchId: match.id,
        round: match.round,
        kickoffAtMs: match.kickoffAtMs,
        opponent: opponentOf(match, teamId).name,
        side: sideOf(match, teamId),
        isStarter: row.is_starter,
        records: row.records,
        substitutedAt: row.substituted_at,
      }
    })
    .filter((a): a is PlayerAppearance => a !== null)
    .sort((a, b) => b.kickoffAtMs - a.kickoffAtMs)
}

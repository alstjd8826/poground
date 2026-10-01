import { getHtml } from "./http.ts";
import { type MatchLineup, parseMatchLineup } from "./parsers/lineup.ts";

/**
 * 경기 상세(match.do)에서 라인업을 가져온다.
 *
 * 파라미터 네 개가 **전부** 있어야 한다. 하나라도 빠지면 400 이다.
 *   year / leagueId / gameId / meetSeq
 *
 * meetSeq 가 지뢰다. 대회를 고르는 값인데, 틀린 값을 줘도 404 가 아니라
 * **다른 대회의 엉뚱한 경기를 200 으로** 돌려준다. 실제로 확인한 예:
 *
 *   gameId=178&meetSeq=1  ->  라인업 없음 (아직 안 치른 경기. 올바른 응답)
 *   gameId=178&meetSeq=2  ->  23R 박건하 vs 손현준 (전혀 다른 경기)
 *
 * 그래서 값을 고정하는 것만으로는 부족하고, 받아온 라인업이 정말 그 경기인지
 * 팀 코드로 확인해야 한다 — belongsTo() 가 그 역할이다.
 */
const K_LEAGUE1_MEET_SEQ = "1";

export interface MatchRef {
  year: number;
  leagueId: number;
  gameId: number;
  homeTeamId: string;
  awayTeamId: string;
}

export function fetchMatchLineup(ref: MatchRef): Promise<MatchLineup> {
  return getHtml("/match.do", {
    year: String(ref.year),
    leagueId: String(ref.leagueId),
    gameId: String(ref.gameId),
    meetSeq: K_LEAGUE1_MEET_SEQ,
  }).then(parseMatchLineup);
}

/**
 * 받아온 라인업이 정말 이 경기의 것인지.
 *
 * 선수 행마다 팀 코드가 박혀 있으므로 그게 우리가 아는 두 팀과 맞는지 본다.
 * 한 명이라도 다른 팀이 섞여 있으면 엉뚱한 경기를 받은 것이니 통째로 버린다 —
 * 남의 경기 라인업이 들어가느니 비어 있는 편이 낫다.
 */
export function belongsTo(lineup: MatchLineup, ref: MatchRef): boolean {
  if (lineup.players.length === 0) return false;
  const expected = new Set([ref.homeTeamId, ref.awayTeamId]);
  const seen = new Set(lineup.players.map((p) => p.teamId));
  if (seen.size !== 2) return false;
  for (const teamId of seen) if (!expected.has(teamId)) return false;
  return true;
}

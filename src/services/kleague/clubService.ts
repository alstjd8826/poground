import { clubRepository } from '@/repositories/kleague/clubRepository'
import { lineupRepository } from '@/repositories/kleague/lineupRepository'
import { matchRepository } from '@/repositories/kleague/matchRepository'
import type { TeamPlayerRow } from '@/repositories/kleague/rows'
import { type Club, type Player, POHANG, sideOf } from '@/models/kleague'
import { toClub, toMatch, toPlayer } from './mappers'

export async function getClubs(): Promise<Club[]> {
  return (await clubRepository.findAll()).map(toClub)
}

/** 공격부터. 팬이 먼저 찾는 쪽이 위에 온다. 포지션을 모르는 선수는 맨 뒤로 */
const POSITION_ORDER = ['FW', 'MF', 'DF', 'GK']
const positionRank = (p: string | null) => {
  const i = POSITION_ORDER.indexOf(p ?? '')
  return i === -1 ? POSITION_ORDER.length : i
}

/**
 * 스쿼드.
 *
 * 두 곳을 합친다. 시즌 기록(출전·득점·도움)은 스쿼드 API 가 주지만 **선수ID·등번호·포지션은
 * 전부 null 로 준다.** 그 셋은 실제로 뛴 기록인 라인업에만 있으므로 거기서 끌어온다.
 *
 * 잇는 열쇠는 이름이다. 선수ID 로 잇고 싶지만 스쿼드 쪽에 그 값이 없다. 2026 시즌 포항은
 * 양쪽 37명이 이름으로 정확히 맞아떨어진다. 동명이인이 생기면 여기가 먼저 틀어진다.
 *
 * 등번호는 시즌 중에 바뀔 수 있으므로 가장 최근 경기의 값을 쓴다.
 */
export async function getSquad(teamId = POHANG): Promise<Player[]> {
  const [rows, lineups] = await Promise.all([
    clubRepository.findSquad(teamId),
    lineupRepository.findTeamPlayers(teamId),
  ])

  const latest = new Map<string, TeamPlayerRow>()
  for (const row of lineups) {
    const seen = latest.get(row.name)
    if (!seen || row.game_id >= seen.game_id) latest.set(row.name, row)
  }

  const players = rows.map(toPlayer).map(player => {
    const seen = latest.get(player.name)
    if (!seen) return player
    return {
      ...player,
      playerId: seen.player_id,
      backNo: seen.back_no,
      position: seen.position,
      // 선수 사진은 앱이 내보내지 않는다. 사용자가 넣은 것만 프로필과 카드에서 본다
      // (usePlayerPhoto). 목록은 전원 실루엣이다
    }
  })

  // 포지션 묶음 -> 등번호 순. 축구 명단이 늘 이렇게 읽힌다
  return players.sort(
    (a, b) => positionRank(a.position) - positionRank(b.position) || (a.backNo ?? 999) - (b.backNo ?? 999),
  )
}

/**
 * 지금 감독.
 *
 * 감독만 따로 모은 표는 없다. 경기마다 양 팀 감독이 한 줄씩 남을 뿐이라, 가장 최근에
 * 치른 경기에서 우리 쪽에 앉아 있던 사람을 집는다. 시즌 중에 바뀌어도 자동으로 따라온다.
 *
 * 경기 표에는 팀 코드가 있지만 감독 표에는 없다(홈/원정만 있다). 그래서 경기를 먼저
 * 찾아 우리가 어느 쪽이었는지 알아낸 다음에야 이름을 고를 수 있다.
 */
export async function getHeadCoach(teamId = POHANG): Promise<string | null> {
  const matches = (await matchRepository.findByTeam(teamId)).map(toMatch)
  const played = matches.filter(m => m.status === 'finished').sort((a, b) => b.kickoffAtMs - a.kickoffAtMs)
  const last = played[0]
  if (!last) return null

  const coaches = await lineupRepository.findCoaches(last.id)
  return coaches.find(c => c.side === sideOf(last, teamId))?.name ?? null
}

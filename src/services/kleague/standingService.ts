import { standingRepository } from '@/repositories/kleague/standingRepository'
import { POHANG, type Standing } from '@/models/kleague'
import { toStanding } from './mappers'

export interface StandingsWithOurTeam {
  all: Standing[]
  /** 우리 팀 순위. 시즌 전이면 없을 수 있다 */
  ours?: Standing
  /** 우리 팀 바로 위·아래 구단까지 (홈 화면의 미니 표) */
  around: Standing[]
}

/**
 * 순위 도메인.
 *
 * "우리 팀을 찾고 그 주변을 잘라낸다" 는 판단이 화면에 있던 걸 옮겼다.
 * 화면은 all / ours / around 중 필요한 걸 고르기만 하면 된다.
 */
export async function getStandingsWithOurTeam(teamId = POHANG): Promise<StandingsWithOurTeam> {
  const all = (await standingRepository.findAll()).map(toStanding)
  const ours = all.find(s => s.teamId === teamId)
  const around = ours ? all.filter(s => Math.abs(s.rank - ours.rank) <= 1) : []
  return { all, ours, around }
}

import { SEASON_YEAR } from '@/config/env'
import { supabase } from '@/repositories/remote/supabase'
import { LINEUP_IDENTITY, type CoachRow, type LineupRow, type TeamPlayerRow } from './rows'

/**
 * 경기 라인업.
 *
 * 한 경기의 라인업은 40행 안쪽이라 나눠 받을 이유가 없다. 화면이 양 팀을 함께 보여주므로
 * 한 번에 다 가져와 서비스에서 가른다.
 */
export const lineupRepository = {
  async findByMatch(gameId: number, year = SEASON_YEAR): Promise<LineupRow[]> {
    const { data, error } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('year', year)
      .eq('game_id', gameId)
      // 원본 등장 순서가 곧 선발 순서다. 정렬을 바꾸면 포지션 흐름이 깨진다
      .order('side', { ascending: true })
      .order('lineup_order', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  /**
   * 한 구단 선수들의 신원. 선수ID·등번호·포지션은 스쿼드 API 가 전부 null 로 주므로
   * 실제로 뛴 기록(라인업)에서 끌어온다.
   *
   * PostgREST 는 한 번에 1000행까지만 주고 DISTINCT 도 없다. 끝까지 넘겨 읽은 뒤
   * 선수마다 가장 최근 경기의 값을 남기는 건 서비스가 한다 — 등번호는 시즌 중에 바뀔 수 있다.
   *
   * 여기만 `*` 를 쓰지 않는다. 한 시즌을 통째로 넘겨 받는 유일한 쿼리라 열 하나가 행 수만큼
   * 곱해진다 — 2026 포항 기준 580행에서 188KB 였던 것이 필요한 여섯 열만 고르면 61KB 다.
   */
  async findTeamPlayers(teamId: string, year = SEASON_YEAR): Promise<TeamPlayerRow[]> {
    const PAGE = 1000
    const all: TeamPlayerRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('match_lineups')
        .select(LINEUP_IDENTITY)
        .eq('year', year)
        .eq('team_id', teamId)
        .order('game_id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = data ?? []
      all.push(...rows)
      if (rows.length < PAGE) return all
    }
  },

  /** 한 선수가 뛴 모든 경기. 한 시즌이라 38행을 넘지 않는다 */
  async findByPlayer(playerId: string, year = SEASON_YEAR): Promise<LineupRow[]> {
    const { data, error } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('year', year)
      .eq('player_id', playerId)
      .order('game_id', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async findCoaches(gameId: number, year = SEASON_YEAR): Promise<CoachRow[]> {
    const { data, error } = await supabase
      .from('match_coaches')
      .select('*')
      .eq('year', year)
      .eq('game_id', gameId)
    if (error) throw error
    return data ?? []
  },
}

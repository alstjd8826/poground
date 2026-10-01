import { SEASON_YEAR } from '@/config/env'
import { supabase } from '@/repositories/remote/supabase'
import type { MatchRow } from './rows'

/**
 * 경기 테이블 접근.
 *
 * 이 계층만 Supabase 를 안다. 테이블명·컬럼·PostgREST 필터 문법이 밖으로 새지 않게 한다.
 * 조합이나 도메인 판단은 하지 않는다. 그건 services/ 의 일이다.
 */
export const matchRepository = {
  /** 우리 팀이 홈이든 원정이든 낀 경기 전부 */
  async findByTeam(teamId: string, year = SEASON_YEAR): Promise<MatchRow[]> {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('year', year)
      // PostgREST 의 or 는 문자열 문법이라 밖으로 노출하지 않는다
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('kickoff_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },
}

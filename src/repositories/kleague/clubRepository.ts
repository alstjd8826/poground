import { SEASON_YEAR } from '@/config/env'
import { supabase } from '@/repositories/remote/supabase'
import type { ClubRow, PlayerRow } from './rows'

export const clubRepository = {
  async findAll(): Promise<ClubRow[]> {
    const { data, error } = await supabase.from('clubs').select('*')
    if (error) throw error
    return data ?? []
  },

  async findSquad(teamId: string, year = SEASON_YEAR): Promise<PlayerRow[]> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('year', year)
      .eq('team_id', teamId)
      .order('back_no', { ascending: true, nullsFirst: false })
    if (error) throw error
    return data ?? []
  },
}

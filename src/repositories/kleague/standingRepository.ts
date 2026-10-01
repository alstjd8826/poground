import { SEASON_YEAR } from '@/config/env'
import { supabase } from '@/repositories/remote/supabase'
import type { StandingRow } from './rows'

export const standingRepository = {
  async findAll(year = SEASON_YEAR): Promise<StandingRow[]> {
    const { data, error } = await supabase
      .from('standings')
      .select('*')
      .eq('year', year)
      .order('rank', { ascending: true })
    if (error) throw error
    return data ?? []
  },
}

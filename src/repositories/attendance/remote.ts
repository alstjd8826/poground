import { supabase } from '@/repositories/remote/supabase'
import type { AttendanceKey, AttendanceRow } from '@/models/attendance'

/**
 * 직관 기록을 서버에 두고 읽는 곳. 본인만 읽고 쓴다 (0022). 사진은 글로 옮겨 갔다 — 0027 이 칸을 지운다.
 */

interface Row {
  year: number
  league_id: number
  game_id: number
  updated_at: string
}

const COLUMNS = 'year, league_id, game_id, updated_at'

function toAttendance(row: Row): AttendanceRow {
  return {
    year: row.year,
    leagueId: row.league_id,
    gameId: row.game_id,
    updatedAt: row.updated_at,
  }
}

const whereKey = (key: AttendanceKey) => ({ year: key.year, league_id: key.leagueId, game_id: key.gameId })

export async function listMine(): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.from('attendances').select(COLUMNS)
  if (error) throw error
  return (data as Row[]).map(toAttendance)
}

export async function mark(userId: string, key: AttendanceKey): Promise<AttendanceRow> {
  const { data, error } = await supabase
    .from('attendances')
    .upsert({ owner: userId, ...whereKey(key) }, { onConflict: 'owner,year,league_id,game_id' })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return toAttendance(data as Row)
}

/** 기록을 지운다. 직관 사진은 글로 옮겨 갔다(4단계) — 치울 파일이 없다 */
export async function unmark(key: AttendanceKey): Promise<void> {
  const { error } = await supabase.from('attendances').delete().match(whereKey(key))
  if (error) throw error
}

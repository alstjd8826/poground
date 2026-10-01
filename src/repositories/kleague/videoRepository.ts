import { supabase } from '@/repositories/remote/supabase'
import type { VideoRow } from './rows'

export const videoRepository = {
  async findRecent(category?: string, limit = 30): Promise<VideoRow[]> {
    let q = supabase
      .from('videos')
      .select('*')
      .not('youtube_id', 'is', null)
      .order('published_on', { ascending: false })
      .order('seq', { ascending: false })
      .limit(limit)
    if (category) q = q.eq('category', category)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },

  /** 한 경기의 영상. 원본이 경기 ID 를 안 주므로 라운드로 묶는다(videos.round_id) */
  async findByRound(round: number): Promise<VideoRow[]> {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('round_id', round)
      .not('youtube_id', 'is', null)
      .order('published_on', { ascending: false })
    if (error) throw error
    return data ?? []
  },
}

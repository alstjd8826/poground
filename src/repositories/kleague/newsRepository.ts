import { supabase } from '@/repositories/remote/supabase'
import type { NewsRow } from './rows'

export const newsRepository = {
  /** 목록은 본문(body)을 빼고 받는다. 기사 하나가 수 KB 라 목록에서는 낭비다. */
  async findRecent(limit = 30): Promise<NewsRow[]> {
    const { data, error } = await supabase
      .from('news')
      .select('seq,category,club_tag,title,published_on,view_count')
      .order('published_on', { ascending: false })
      .order('seq', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as NewsRow[]
  },

  async findBySeq(seq: number): Promise<NewsRow | null> {
    const { data, error } = await supabase.from('news').select('*').eq('seq', seq).maybeSingle()
    if (error) throw error
    return data
  },
}

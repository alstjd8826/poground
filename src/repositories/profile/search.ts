import { supabase } from '@/repositories/remote/supabase'

/** 언급 후보 한 사람 */
export interface HandleCandidate {
  id: string
  handle: string
  avatarUrl: string | null
}

/** 한 번에 띄우는 후보 수. 입력칸 위 좁은 자리라 많이 둘 수 없다 */
export const MENTION_SUGGEST_LIMIT = 5

/**
 * @ 를 칠 때 아이디 앞부분으로 찾는다 (2026-09-29). 프로필은 누구나 읽는다(0006 "public read").
 *
 * 아이디 모양(소문자·숫자·밑줄)이 아닌 글자가 섞이면 묻지 않는다. LIKE 의 `_` 는 "아무 글자 하나" 라
 * 글자 그대로 찾도록 막는다 — 안 그러면 `fan_` 을 쳤는데 `fanx…` 도 걸린다.
 */
export async function searchHandles(prefix: string): Promise<HandleCandidate[]> {
  if (!/^[a-z0-9_]{1,20}$/.test(prefix)) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id,handle,avatar_url')
    .ilike('handle', `${prefix.replace(/_/g, '\\_')}%`)
    .order('handle')
    .limit(MENTION_SUGGEST_LIMIT)
  if (error) throw error
  return ((data ?? []) as { id: string; handle: string; avatar_url: string | null }[]).map(r => ({
    id: r.id,
    handle: r.handle,
    avatarUrl: r.avatar_url,
  }))
}

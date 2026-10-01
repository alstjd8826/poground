import type { QueryClient } from '@tanstack/react-query'

import { supabase } from '@/repositories/remote/supabase'

/**
 * 보는 사람에 따라 답이 달라지는데 열쇠에 사람이 없는 캐시. 글·댓글에는 내 좋아요가 들어 있고
 * 차단한 사람이 걸러져 있다. 신고함은 관리자만 받는다.
 */
const VIEWER_KEYS = [['community'], ['comments'], ['reports']] as const

/** supabase.auth 에서 여기가 쓰는 것만. 테스트가 흉내 내기 쉽게 좁힌다 */
interface Auth {
  onAuthStateChange: (callback: (event: string, session: { user: { id: string } } | null) => void) => {
    data: { subscription: { unsubscribe: () => void } }
  }
}

/**
 * 계정이 바뀌면 위 캐시를 비운다. 두지 않으면 앞사람의 하트가 다시 받을 때까지 남아 보였다.
 *
 * 앱을 켤 때 같은 사람으로 이어지면 기기에 저장된 캐시를 그대로 쓴다. 로그아웃 상태로 켜지면
 * 비운다 — 앱이 꺼진 사이 세션이 끝났으면 남은 캐시는 앞사람의 것이다.
 */
/**
 * 기기에 남겨도 되는 캐시인가. 보는 사람에 딸린 것은 남기지 않는다 — 저장 캐시는 마운트 뒤에 늦게
 * 되살아나서, 로그아웃 상태로 켜 아래가 비운 뒤에 앞사람의 것이 다시 들어올 수 있다
 */
export function persistsAcrossViewers(queryKey: readonly unknown[]): boolean {
  return !VIEWER_KEYS.some(([head]) => queryKey[0] === head)
}

export function clearOnViewerChange(client: QueryClient, auth: Auth = supabase.auth): () => void {
  let viewer: string | null | undefined
  const { data } = auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null
    const changed = viewer === undefined ? next === null : next !== viewer
    viewer = next
    if (!changed) return
    // resetQueries 는 떠 있는 화면에도 알린다 — 세션 변화로 다시 그리지 않는 화면이 옛 답을 쥐지 않게
    for (const queryKey of VIEWER_KEYS) void client.resetQueries({ queryKey })
  })
  return () => data.subscription.unsubscribe()
}

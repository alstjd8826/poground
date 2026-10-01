import { supabase } from '@/repositories/remote/supabase'

/**
 * 내 계정을 지운다 (앱스토어 지침 5.1.1(v), 2026-09-30).
 *
 * 서버 함수 delete-account 가 사진 파일을 치우고, 댓글은 자리만 남기고, 계정을 지운다. 글·좋아요·팬카드·
 * 직관 기록·차단은 계정을 따라 DB 가 지운다. 누구를 지울지는 보내지 않는다 — 함수가 토큰의 주인만 지운다.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
  if (!error) return
  // 함수가 돌려준 까닭을 꺼낸다. 'non-2xx status code' 만 보이면 무엇이 안 됐는지 알 수 없다
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context
  const body = await context
    ?.json?.()
    .then(b => b as { error?: string })
    .catch(() => null)
  throw new Error(body?.error ?? error.message)
}

import { AppState } from 'react-native'

/**
 * 로그인 코드를 세션으로 바꾸는 요청을 앱이 앞에 있을 때 보낸다.
 *
 * 카카오 로그인은 카카오톡 앱에 다녀온다. 돌아오는 순간 인앱 브라우저가 끝났다고 알려
 * 오는데, 그때 앱이 아직 완전히 앞으로 나오지 않았으면 iOS 가 막 출발한 교환 요청(POST)을
 * 끊는다 — 앱이 뒤에 있으면 OS 가 진행 중인 요청을 끊는다(expo/expo#42946). 사용자에게는
 * "fetch failed: … 취소됨" 이 떴고, 다시 누르면 됐다.
 *
 * 그래서 앞으로 나올 때까지 기다렸다가 보낸다. 그래도 끊기면 다시 보내지 않는다 —
 * supabase 는 교환 요청이 네트워크에서 실패하면 기기에 둔 PKCE 비밀값을 지우므로 같은
 * 코드로 다시 보내면 반드시 실패한다. 대신 무엇을 하면 되는지 우리 말로 알린다. 다른
 * 오류(코드가 틀렸거나 이미 쓴 경우)는 그대로 던진다.
 */

/** 앱이 앞으로 나올 때까지 기다린다. 이미 앞이면 곧바로 */
export function whenActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve()
  return new Promise(resolve => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return
      sub.remove()
      resolve()
    })
  })
}

/** iOS 가 끊은 요청인지. 문구가 기기 언어로 온다 (취소됨 / cancelled) */
export function isCancelledRequest(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return /취소됨|cancell?ed/i.test(e.message)
}

type Exchange = () => Promise<{ error: Error | null }>

export const CANCELLED_MESSAGE = '연결이 잠깐 끊겼습니다. 로그인을 한 번 더 눌러 주세요.'

export async function exchangeInForeground(exchange: Exchange, active: () => Promise<void> = whenActive) {
  await active()
  let error: Error | null
  try {
    error = (await exchange()).error
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e))
  }
  if (error && isCancelledRequest(error)) throw new Error(CANCELLED_MESSAGE)
  if (error) throw error
}

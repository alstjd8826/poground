import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { AppState, Platform } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'

import { supabase } from '@/repositories/remote/supabase'
import { codeFromCallback } from '@/hooks/auth/callbackUrl'
import { exchangeInForeground } from '@/hooks/auth/exchange'
import { APPLE_LOGIN_ENABLED, type SocialProvider } from '@/hooks/auth/providers'

/**
 * 로그인 상태.
 *
 * 화면 여러 곳이 같은 세션을 봐야 해서 모듈 수준에 한 벌만 둔다 —
 * 컴포넌트마다 useState 를 두면 한쪽에서 로그인해도 다른 쪽은 로그아웃인 채로 남는다.
 * (팬 카드에서 이미 한 번 겪은 일이라 처음부터 이렇게 간다)
 */

let session: Session | null = null
let ready = false
const listeners = new Set<() => void>()

/**
 * 마지막으로 무엇으로 들어왔는지.
 *
 * 다음에 올 때 "저번에 이걸로 했다" 를 버튼 옆에 알려 주려고 적어 둔다. 소셜이 넷쯤
 * 되면 어느 것으로 가입했는지 사람들이 정말 못 외운다 — 잘못 고르면 빈 계정이 하나 더
 * 생긴다.
 *
 * 기기에만 둔다. 서버에 둘 만한 것이 아니고, 로그아웃해도 남아야 쓸모가 있다.
 */
const LAST_KEY = 'auth.lastProvider'
let lastProvider: SocialProvider | null = null

void AsyncStorage.getItem(LAST_KEY).then(value => {
  if (value === 'kakao' || value === 'apple' || value === 'google') {
    lastProvider = value
    emit()
  }
})

function rememberProvider(provider: SocialProvider) {
  lastProvider = provider
  emit()
  void AsyncStorage.setItem(LAST_KEY, provider)
}

function emit() {
  listeners.forEach(fn => fn())
}

function setSession(next: Session | null) {
  session = next
  ready = true
  emit()
}

/**
 * 앱이 처음 뜰 때 한 번 세션을 읽고, 그 뒤로는 Supabase 가 알려 주는 대로 따라간다.
 * getSession 은 AsyncStorage 에 적어 둔 것을 읽는 것이라 네트워크를 타지 않는다.
 */
supabase.auth.getSession().then(({ data }) => setSession(data.session))
supabase.auth.onAuthStateChange((_event, next) => setSession(next))

/**
 * 토큰 자동 갱신은 앱이 앞에 있을 때만 돈다.
 *
 * 백그라운드에서 타이머를 돌리면 iOS 가 앱을 깨우거나 갱신이 조용히 실패한다.
 * 다시 앞으로 나올 때 한 번 갱신하고 이어 가면 된다.
 */
AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export interface AuthState {
  session: Session | null
  /** 첫 조회가 끝났는지. 끝나기 전에는 "로그인 안 됨" 과 구분이 안 된다 */
  ready: boolean
  /** 로그인을 시도한다. **실제로 로그인됐을 때만 true** — 창을 닫으면 false 다 */
  signIn: (provider: SocialProvider, options?: SignInOptions) => Promise<boolean>
  signOut: () => Promise<void>
  /** 이 기기에서 마지막으로 쓴 것. 처음이거나 지웠으면 null */
  lastProvider: SocialProvider | null
}

/**
 * 동의 화면을 인앱 브라우저로 열어 로그인한다. 카카오·구글이 이 길을 쓴다.
 *
 * 열쇠는 앱에 없다. Supabase 가 들고 있고 우리는 Supabase 가 만들어 준 주소를 열어 줄
 * 뿐이다. 그래서 앱 번들에는 비밀값이 하나도 안 들어간다.
 *
 * 흐름:
 *   1. signInWithOAuth 로 동의 화면 주소를 받는다 (skipBrowserRedirect: 직접 열 것이므로)
 *   2. 인앱 브라우저로 연다. 카카오톡이 깔려 있으면 그 안에 "카카오톡으로 로그인" 이 뜬다
 *   3. 끝나면 steelers:// 로 돌아오는데, 주소에 일회용 code 가 붙어 온다
 *   4. code 를 세션으로 바꾼다 (PKCE 라 이 기기에서만 교환된다)
 *
 * 끝까지 갔을 때만 true 를 돌려준다. 창을 닫은 것은 실패가 아니지만 로그인도 아니라서,
 * 부르는 쪽이 둘을 구분하지 못하면 "닫았는데 로그인된 것처럼" 화면을 넘겨 버린다.
 */
/**
 * 로그인 요청 옵션.
 *
 * 다른 계정으로 들어가려는 것이면 소셜 쪽에 계정을 다시 묻게 한다 (2026-09-30). 기기에 카카오 로그인이 남아
 * 있으면 그 계정으로 곧장 들어가 다른 계정을 고를 수 없었다. 카카오는 prompt=login 이면 남은 로그인과
 * 상관없이 로그인 화면을 다시 띄우고, 구글은 prompt=select_account 면 계정 고르기를 띄운다. 평소에는 붙이지
 * 않는다 — 매번 붙이면 카카오톡 한 번 누르기 로그인이 사라진다.
 */
export function oauthOptions(provider: 'kakao' | 'google', redirectTo: string, switchAccount: boolean) {
  return {
    redirectTo,
    skipBrowserRedirect: true,
    queryParams: switchAccount ? { prompt: provider === 'kakao' ? 'login' : 'select_account' } : undefined,
  }
}

async function signInWithBrowser(provider: 'kakao' | 'google', switchAccount: boolean): Promise<boolean> {
  const redirectTo = Linking.createURL('auth/callback')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: oauthOptions(provider, redirectTo, switchAccount),
  })
  if (error) throw error
  if (!data.url) throw new Error('로그인 주소를 받지 못했습니다')

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    /**
     * 사파리 쿠키를 같이 쓰지 않는다.
     *
     * 이걸 끄면 iOS 가 로그인 전에 "'포그라운드'이(가) 'xxxx.supabase.co'를 사용하여
     * 로그인하려 합니다" 를 한 번 묻는다. 주소가 우리 것처럼 안 생겨서 쓰는 사람이
     * 멈칫하는데, 정작 그 글자는 iOS 가 실제 주소를 그대로 보여주는 것이라 바꿀 수 없다.
     *
     * 쿠키를 공유하지 않으면 iOS 가 묻지 않는다. 대신 사파리에 카카오가 로그인돼 있어도
     * 물려받지 못하는데, 카카오톡이 깔려 있으면 앱으로 넘어가 한 번에 끝나므로
     * 실제로 손해 보는 경우는 카카오톡이 없는 사용자뿐이다.
     */
    preferEphemeralSession: true,
  })
  // 사용자가 그냥 닫았다. 실패가 아니므로 조용히 끝내되, 로그인은 아니라고 알린다
  if (result.type !== 'success') return false

  const code = codeFromCallback(result.url)
  // 카카오톡에 다녀오면 앱이 앞으로 나오기 전에 요청이 끊길 수 있다 (exchange.ts)
  await exchangeInForeground(() => supabase.auth.exchangeCodeForSession(code))
  return true
}

/**
 * 애플로 로그인한다. iOS 에서만 부른다.
 *
 * 카카오·구글과 달리 브라우저를 열지 않는다. 애플이 주는 네이티브 시트가 뜨고 Face ID
 * 한 번으로 끝난다 — 심사에서 보는 것도 이 모습이고, 웹 흐름으로 하면 Services ID 를
 * 따로 만들어야 한다.
 *
 * nonce 를 쓰는 이유는 받은 토큰이 **이 요청에 대한 답인지** 확인하기 위해서다.
 * 애플에게는 해시를 주고 Supabase 에는 원본을 주면, Supabase 가 토큰 안의 해시와
 * 맞춰 본다. 가로챈 토큰을 다른 요청에 끼워 넣는 것을 막는다.
 *
 * 이름과 메일은 **맨 처음 한 번만** 온다. 두 번째부터는 애플이 주지 않으므로, 받은
 * 그때 프로필 기본값으로 챙겨 두지 않으면 다시 물을 길이 없다.
 */
async function signInWithApple(): Promise<boolean> {
  const rawNonce = Crypto.randomUUID()
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  }).catch((e: unknown) => {
    // 시트를 닫은 것은 실패가 아니다. 카카오 창을 닫은 것과 같게 다룬다
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return null
    throw e
  })
  if (!credential) return false
  if (!credential.identityToken) throw new Error('애플에서 토큰을 받지 못했습니다')

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  })
  if (error) throw error

  await rememberAppleName(credential.fullName)
  return true
}

/**
 * 애플이 처음 한 번 준 이름을 계정에 적어 둔다.
 *
 * 애플 계정에는 닉네임이 없어서 이걸 안 챙기면 프로필 만들 때 빈칸에서 시작한다.
 * 실패해도 로그인은 이미 끝난 것이므로 조용히 넘어간다 — 이름은 나중에 고칠 수 있다.
 */
async function rememberAppleName(fullName: AppleAuthentication.AppleAuthenticationFullName | null) {
  const parts = [fullName?.familyName, fullName?.givenName].filter(Boolean)
  if (parts.length === 0) return
  await supabase.auth.updateUser({ data: { name: parts.join('') } }).catch(() => {})
}

/**
 * 이 기기에서 애플 로그인을 쓸 수 있는지.
 *
 * 안드로이드와 옛 iOS 에는 없고, 유료 개발자 계정이 아니면 자격을 못 넣어 아예 못 쓴다
 * (APPLE_LOGIN_ENABLED 주석 참고).
 */
export async function isAppleAvailable(): Promise<boolean> {
  if (!APPLE_LOGIN_ENABLED) return false
  if (Platform.OS !== 'ios') return false
  return AppleAuthentication.isAvailableAsync()
}

/** 고른 것으로 로그인한다. 끝까지 갔을 때만 true */
export interface SignInOptions {
  /** 기기에 남은 소셜 로그인 대신 다른 계정으로 들어간다 */
  switchAccount?: boolean
}

async function signInWith(provider: SocialProvider, options?: SignInOptions): Promise<boolean> {
  if (provider === 'apple') {
    const done = await signInWithApple()
    if (done) rememberProvider(provider)
    return done
  }
  const done = await signInWithBrowser(provider, options?.switchAccount ?? false)
  if (done) rememberProvider(provider)
  return done
}

export function useAuth(): AuthState {
  const current = useSyncExternalStore(
    subscribe,
    () => session,
    () => session,
  )
  const isReady = useSyncExternalStore(
    subscribe,
    () => ready,
    () => ready,
  )
  const last = useSyncExternalStore(
    subscribe,
    () => lastProvider,
    () => lastProvider,
  )

  // 인앱 브라우저는 미리 데워 두면 눈에 띄게 빨리 열린다
  useEffect(() => {
    WebBrowser.warmUpAsync().catch(() => {})
    return () => {
      WebBrowser.coolDownAsync().catch(() => {})
    }
  }, [])

  const signIn = useCallback(
    (provider: SocialProvider, options?: SignInOptions) => signInWith(provider, options),
    [],
  )
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) return

    /*
      서버가 거절해도 기기에서는 나가야 한다.

      계정이 지워졌거나 토큰이 이미 죽었으면 서버 쪽 정리는 할 것도 없는데, 여기서
      던져 버리면 앱은 **없는 계정으로 로그인된 채** 갇힌다. 로그아웃이 안 되니
      다시 로그인할 수도 없다. 그래서 기기에 적힌 것만 지우는 쪽으로 한 번 더 간다.
    */
    const { error: localError } = await supabase.auth.signOut({ scope: 'local' })
    if (localError) throw localError
  }, [])

  return { session: current, ready: isReady, signIn, signOut, lastProvider: last }
}

/** 로그인한 사람의 표시 이름. 카카오가 준 것이 없으면 빈 값 */
export function displayNameOf(session: Session | null): string {
  const meta = session?.user.user_metadata as Record<string, unknown> | undefined
  const name = meta?.name ?? meta?.full_name ?? meta?.preferred_username
  return typeof name === 'string' ? name : ''
}

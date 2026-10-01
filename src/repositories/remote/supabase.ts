import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config/env'
import { installWebCrypto } from '@/repositories/remote/webcrypto'

// createClient 보다 먼저 불러야 한다. PKCE 챌린지 방식이 이 시점의 crypto 로 정해진다
installWebCrypto()

/**
 * 설정이 비었을 때 쓰는 더미 값.
 *
 * createClient 는 URL 이 비면 모듈을 불러오는 순간 예외를 던진다.
 * 그러면 .env 하나 빠진 것으로 앱이 흰 화면으로 죽고, 테스트도 통째로 못 돈다.
 * 더미로 만들어 두면 앱은 정상적으로 뜨고 각 화면이 "불러오지 못했습니다" 를 보여준다.
 */
const FALLBACK_URL = 'https://unconfigured.supabase.co'
const FALLBACK_KEY = 'unconfigured'

/**
 * 읽기는 anon 키로 누구나, 쓰기는 로그인한 사람만 자기 것만.
 *
 * 경기·선수 같은 수집 자료는 여전히 "public read" 라 로그인 없이 보인다.
 * 로그인은 팬 카드처럼 **내 것** 을 서버에 두기 위한 것이고, 그때부터 RLS 가
 * auth.uid() 로 주인을 가린다.
 *
 * 설정 세 가지가 각각 필요한 이유:
 *   storage          세션을 기기에 적어 둔다. 없으면 앱을 끌 때마다 로그아웃된다
 *   flowType 'pkce'  브라우저를 거치는 로그인에서 코드 가로채기를 막는다.
 *                    signInWithOAuth -> 인앱 브라우저 -> exchangeCodeForSession 흐름의 전제다
 *   detectSessionInUrl  웹 전용이다. 주소창이 없는 앱에서 켜면 엉뚱하게 동작한다
 */
export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : FALLBACK_URL,
  isSupabaseConfigured ? SUPABASE_ANON_KEY : FALLBACK_KEY,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
)

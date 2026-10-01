import { useCallback, useEffect, useState } from 'react'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'

import { supabase } from '@/repositories/remote/supabase'
import type { SocialProvider } from '@/hooks/auth/providers'
import { codeFromCallback } from '@/hooks/auth/callbackUrl'
import { exchangeInForeground } from '@/hooks/auth/exchange'

/**
 * 한 계정에 붙어 있는 소셜들.
 *
 * 카카오로 들어온 사람과 애플로 들어온 사람은 **서로 다른 계정**이다. 메일이 같고 둘 다
 * 확인된 경우에만 Supabase 가 알아서 합치는데, 카카오는 메일을 안 주는 경우가 있어서
 * 그 조건이 자주 안 맞는다. 그래서 "로그인한 뒤에 여기서 잇는다" 가 확실한 길이다.
 *
 * 잇고 끊는 것은 Supabase 대시보드에서 **Manual Linking** 을 켜야 동작한다. 꺼져 있으면
 * 잇기를 부를 때 서버가 막는다.
 */
export interface IdentityState {
  /** 지금 붙어 있는 것들 */
  linked: SocialProvider[]
  loading: boolean
  /** 소셜 하나를 이 계정에 잇는다. 창을 닫으면 false */
  link: (provider: SocialProvider) => Promise<boolean>
  /** 끊는다. 마지막 하나는 끊을 수 없다 — 들어올 길이 없어진다 */
  unlink: (provider: SocialProvider) => Promise<void>
  refresh: () => Promise<void>
}

function toProviders(list: { provider: string }[] | null | undefined): SocialProvider[] {
  const known: SocialProvider[] = ['kakao', 'apple', 'google']
  return known.filter(p => list?.some(i => i.provider === p))
}

export function useIdentities(): IdentityState {
  const [linked, setLinked] = useState<SocialProvider[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.getUserIdentities()
    setLoading(false)
    // 못 읽은 것과 하나도 없는 것은 다르다. 못 읽었으면 화면을 건드리지 않는다
    if (error) return
    setLinked(toProviders(data?.identities))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /**
   * 잇기는 로그인과 같은 길을 간다 — 동의 화면을 열고 돌아온 code 를 교환한다.
   * 다른 점은 새 계정을 만드는 대신 지금 계정에 붙는다는 것뿐이다.
   *
   * 애플도 여기서는 브라우저로 간다. 네이티브 시트(signInWithIdToken)는 "로그인" 만
   * 할 수 있고 "잇기" 는 못 한다. 그래서 애플 쪽 설정에 Services ID 가 따로 있어야 한다.
   */
  const link = useCallback(
    async (provider: SocialProvider) => {
      const redirectTo = Linking.createURL('auth/callback')
      const { data, error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data.url) throw new Error('연동 주소를 받지 못했습니다')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
        preferEphemeralSession: true,
      })
      if (result.type !== 'success') return false

      /*
        코드가 없으면 서버가 거절한 것이다. 예전에는 그냥 넘어가고 true 를 돌려줬는데,
        그러면 잇기가 막혀 있어도 화면이 조용히 그대로 있어 무엇이 잘못됐는지 알 길이
        없었다. codeFromCallback 이 서버가 준 이유를 그대로 올린다.
      */
      const code = codeFromCallback(result.url)
      // 카카오톡에 다녀오면 앱이 앞으로 나오기 전에 요청이 끊길 수 있다 (exchange.ts)
      await exchangeInForeground(() => supabase.auth.exchangeCodeForSession(code))

      await refresh()
      return true
    },
    [refresh],
  )

  const unlink = useCallback(
    async (provider: SocialProvider) => {
      const { data } = await supabase.auth.getUserIdentities()
      const target = data?.identities?.find(i => i.provider === provider)
      if (!target) return
      // 마지막 하나를 끊으면 다시 들어올 길이 없다. 서버도 막지만 여기서 먼저 막는다
      if ((data?.identities?.length ?? 0) <= 1) {
        throw new Error('마지막 하나는 끊을 수 없어요. 다른 것을 먼저 연결해 주세요.')
      }
      const { error } = await supabase.auth.unlinkIdentity(target)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  return { linked, loading, link, unlink, refresh }
}

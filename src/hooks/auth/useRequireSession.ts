import { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'

import { useAuth } from '@/hooks/auth/useAuth'

/**
 * 로그인해야 볼 수 있는 화면에서 부른다.
 *
 * 로그아웃하면 그 화면은 보여 줄 것이 없어진다 — 닉네임·아이디가 빈 값이 되고
 * 로그아웃 단추만 남는다. 그대로 두면 "로그아웃이 안 된 것" 처럼 보인다.
 *
 * goBack 이 아니라 popToTop 이다. 내 계정 위에 닉네임·아이디 화면이 얹혀 있으면
 * 각 화면이 저마다 한 칸씩 뒤로 가려 들어 몇 칸이 빠질지 알 수 없다. 탭의 첫
 * 화면으로 한 번에 돌아가면 그런 셈이 없다.
 *
 * ready 를 기다리는 이유는 첫 조회가 끝나기 전에는 "로그인 안 됨" 과 구분이 안
 * 되기 때문이다. 안 기다리면 앱을 켜자마자 화면이 튕겨 나간다.
 */
export function useRequireSession(): void {
  const { session, ready } = useAuth()
  const navigation = useNavigation()

  useEffect(() => {
    if (!ready || session) return
    const stack = navigation as unknown as { popToTop?: () => void }
    stack.popToTop?.()
  }, [navigation, ready, session])
}

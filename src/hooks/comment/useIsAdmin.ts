import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'

import { amIAdmin } from '@/repositories/comment/remote'
import { useAuth } from '@/hooks/auth/useAuth'

/**
 * 명단 질의 열쇠.
 *
 * **누구의 답인지를 열쇠에 넣는다.** 안 넣으면 관리자가 로그아웃한 뒤에도 `true` 가
 * 캐시에 남아, 로그인하지 않은 사람에게 신고함 줄이 그대로 보인다. 그 캐시는 기기에도
 * 저장되므로 앱을 껐다 켜도 살아 있다. 다른 사람이 같은 기기에 로그인해도 마찬가지다.
 *
 * 열쇠가 다르면 서로의 답을 물려받지 않는다. 한자리에 둬야 쓰는 곳들이 어긋나지 않는다.
 */
export const adminKey = (userId: string | null) => ['admin', userId] as const

/**
 * 내가 관리자인지.
 *
 * useComments 안에도 같은 질의가 있지만 그쪽은 댓글이 있는 화면에서만 돈다. 마이 탭처럼
 * 댓글과 상관없는 자리에서도 물어야 해서 따로 뺐다. 질의 열쇠가 같아 두 번 받지는 않는다.
 */
export function useIsAdmin(): boolean {
  const { session } = useAuth()
  const query = useQuery({
    queryKey: adminKey(session?.user.id ?? null),
    queryFn: amIAdmin,
    enabled: session !== null,
    staleTime: 30_000,
  })
  return session !== null && query.data === true
}

/**
 * 관리자가 아니면 화면에서 되돌린다.
 *
 * 들어오는 길(마이 탭의 줄)은 이미 관리자에게만 보이고, 서버도 정책으로 막는다.
 * 그래도 여기서 한 번 더 보는 이유는 **막지 못해서가 아니라 화면이 이상해져서**다 —
 * 일반 사용자가 들어오면 제가 넣은 신고만 덩그러니 보이고, 단추는 누를 때마다
 * 실패한다. 무엇이 잘못됐는지 읽을 수 없는 상태로 남는 것이 제일 나쁘다.
 *
 * 아직 모르는 동안에는 되돌리지 않는다. 첫 조회가 끝나기 전에는 "관리자가 아님" 과
 * 구분이 안 되어, 관리자가 들어와도 한 번 튕겨 나간다.
 */
export function useRequireAdmin(): void {
  const { session, ready } = useAuth()
  const navigation = useNavigation()
  const query = useQuery({
    queryKey: adminKey(session?.user.id ?? null),
    queryFn: amIAdmin,
    enabled: session !== null,
    staleTime: 30_000,
  })

  const unknown = session !== null && query.isPending
  const allowed = session !== null && query.data === true

  useEffect(() => {
    if (!ready || unknown || allowed) return
    const stack = navigation as unknown as { popToTop?: () => void }
    stack.popToTop?.()
  }, [allowed, navigation, ready, unknown])
}

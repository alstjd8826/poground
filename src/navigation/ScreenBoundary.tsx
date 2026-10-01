import React from 'react'
import { useIsFocused } from '@react-navigation/native'
import { SharedTransitionBoundary } from 'react-native-reanimated'

/**
 * shared element 전환의 경계.
 *
 * Reanimated 4 는 화면을 스스로 찾지 않는다. 전환이 시작될 때 **활성 경계**를 위에서부터 훑어
 * 떠나는 화면과 들어오는 화면을 잡아내고, 둘을 못 찾으면 조용히 아무것도 하지 않는다
 * (LayoutAnimations/SharedTransitions.cpp 의 findActiveBoundary).
 * 그래서 태그만 맞춰둬도 애니메이션이 안 돈다 — 화면마다 이 경계를 둘러야 한다.
 *
 * isActive 는 포커스를 그대로 쓴다. 푸시가 커밋되는 순간 떠나는 화면은 false, 들어오는 화면은
 * true 가 되므로 Reanimated 가 보는 "이전 top / 다음 top" 과 정확히 맞아떨어진다.
 */
export function ScreenBoundary({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused()
  // 경계는 순수하게 네이티브 쪽 장치다. jest-expo 의 Reanimated 목에는 없으므로 화면을 그냥 통과시킨다.
  if (!SharedTransitionBoundary) return <>{children}</>
  return <SharedTransitionBoundary isActive={isFocused}>{children}</SharedTransitionBoundary>
}

/** 스택에 등록할 화면을 경계로 감싼다. 화면 컴포넌트 자체는 건드리지 않는다. */
export function withBoundary<P extends object>(Component: React.ComponentType<P>) {
  return function BoundedScreen(props: P) {
    return (
      <ScreenBoundary>
        <Component {...props} />
      </ScreenBoundary>
    )
  }
}

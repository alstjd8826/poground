import React from 'react'

import { sharedMotion } from '@/utils/sharedTransition'

export interface SharedProps {
  /** @/utils/sharedTransition 의 sharedGroup 이 찍어 준 태그. 없으면 그냥 지나간다 */
  tag?: string
  children: React.ReactElement
}

/**
 * 자식을 화면 사이를 잇는 원소로 만든다.
 *
 * 자식을 **감싸지 않고 자식에게 태그를 붙인다.** 감싸면 안 되는 이유가 있다 —
 * Reanimated 는 태그 붙은 뷰가 스스로 그리는 것만 복제해 날리므로(자식은 안 따라온다),
 * 배경도 그림도 없는 껍데기에 태그가 붙으면 보이지 않는 빈 상자가 날아간다.
 * 그래서 실제로 무언가를 그리는 자식 — Animated.View / Animated.Text / Animated.Image,
 * 혹은 그 props 를 그대로 넘겨주는 컴포넌트 — 를 하나만 받는다.
 *
 * 태그와 전환 설정을 늘 같이 붙여 주므로 한쪽만 빠뜨릴 일이 없다.
 * 전환은 태그가 어긋나도 에러를 내지 않고 그 조각만 조용히 빠지므로, 이런 실수를
 * 애초에 못 하게 막는 게 중요하다.
 */
export function Shared({ tag, children }: SharedProps) {
  if (!tag) return children
  return React.cloneElement(children, {
    sharedTransitionTag: tag,
    sharedTransitionStyle: sharedMotion,
  } as Partial<unknown>)
}

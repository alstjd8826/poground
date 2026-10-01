import { createContext, useContext } from 'react'
import { SharedTransition } from 'react-native-reanimated'

import { motion } from '@/styles'

/**
 * 화면 사이를 잇는 원소(shared element)의 태그를 만드는 도구.
 *
 * Reanimated 4 의 공유 전환에는 손이 베이기 쉬운 지점이 두 군데 있다.
 *
 * 1. **태그 붙은 뷰가 스스로 그리는 것만 날아간다.** 전환이 시작되면 그 뷰의 props 로
 *    자식 없는 복제본을 만들어 루트에 얹고 그걸 움직인다 (SharedTransitions.cpp 의
 *    getOrCreateContainer). 그래서 카드 껍데기에만 태그를 붙이면 빈 상자가 날아가고
 *    글자와 그림은 양쪽에서 숨겨진 채 끝에서 튀어나온다.
 *    카드처럼 덩어리로 옮기려면 **보이는 조각마다** 태그를 붙여야 한다.
 * 2. 태그가 어긋나거나 빠져도 **에러가 나지 않는다.** 그 조각만 조용히 대열에서 빠질 뿐이라
 *    눈으로만 잡힌다. 그래서 태그를 손으로 짓지 말고 여기서 찍어 낸다.
 *
 * 태그를 실제로 붙이는 일은 @/components/foundation/Shared 가 맡는다.
 * 화면을 감싸는 경계는 또 별도다 — @/navigation/ScreenBoundary 참고.
 */

/** Shared 가 자식에게 넣어 주는 전환 설정. 직접 만들 일은 없고 타입만 필요할 때 쓴다 */
export type SharedTransitionStyle = typeof sharedMotion

/** 조각 이름을 받아 태그를 돌려준다. 꺼져 있으면 undefined 라 호출부에 분기가 없다 */
export type SharedTag = (part: string) => string | undefined

/**
 * 기본 리듬. 네이티브 푸시가 밀려 들어오는 시간과 비슷해야 조각만 먼저 도착해 겉돌지 않는다.
 * 모듈 수준에 한 번만 만든다 — 렌더마다 새 인스턴스를 넘기면 매번 설정을 다시 내려보낸다.
 */
export const sharedMotion = SharedTransition
  ? SharedTransition.duration(motion.duration.slow).easing(motion.easing.decelerate)
  : undefined // jest-expo 의 Reanimated 목에는 없다

/**
 * 한 덩어리로 움직일 조각들의 태그를 찍어내는 도장.
 *
 * `scope` 와 `id` 로 앞자리를 잡는다. 태그는 한 화면 안에서 유일해야 하므로
 * 같은 종류의 카드가 여러 장 놓이는 화면을 위해 id 를 반드시 섞는다.
 *
 * @example
 * const sharedTag = sharedGroup('match', match.id, shared)
 * <Shared tag={sharedTag('home-name')}>
 *   <Animated.Text>대전</Animated.Text>
 * </Shared>
 */
export function sharedGroup(scope: string, id: string | number, enabled = true): SharedTag {
  if (!enabled) return () => undefined
  return part => `${scope}-${id}-${part}`
}

/**
 * 태그가 유일해야 하는 범위.
 *
 * 하단 탭은 한 번 연 화면을 계속 띄워 둔다. 그래서 홈의 "다음 경기" 와 경기 탭의 일정
 * 목록에 같은 경기가 들어 있으면, 같은 태그를 단 뷰가 **두 화면에 동시에** 존재하게 된다.
 * 공유 전환은 원본 뷰를 숨겼다 되돌리는데 같은 태그가 둘이면 엉뚱한 쪽을 숨기고 안
 * 되돌린다 — 탭을 몇 번 오가면 홈의 카드가 사라졌다.
 *
 * 탭마다 다른 범위를 주면 겹치지 않는다. 상세 화면은 자기를 연 탭의 스택 안에 있으므로
 * 같은 범위를 물려받아 짝이 그대로 맞는다.
 */
const TagScopeContext = createContext('app')

export const TagScopeProvider = TagScopeContext.Provider

export function useTagScope(): string {
  return useContext(TagScopeContext)
}

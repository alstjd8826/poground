import { useEffect, useRef } from 'react'
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { motion } from '@/styles'

/** 내려앉기 전 위로 떠 있는 거리. Reanimated 의 FadeInDown 과 같다 */
const RISE = 25

/**
 * 목록 카드의 등장 — 흐린 채 조금 위에서 내려앉고, 순번만큼 늦게 시작한다 (FadeInDown 과 같은 모양).
 *
 * 레이아웃 애니메이션(entering)을 쓰지 않는다 (2026-09-30). 안드로이드에서 entering 은 시작할 때 자리를
 * 붙잡아, 그 사이 FlashList 가 카드를 재고 자리를 옮기면 카드가 옛 자리에 멈췄다 — 갤럭시에서 경기 카드가
 * 앞 카드에 올라탔다. 이것은 투명도와 translateY 만 움직여 자리를 붙잡지 않는다.
 *
 * FlashList 는 칸을 다른 항목에 다시 쓴다. 그때 값이 그대로 옮겨 가지 않게 id 가 바뀌면 끝 상태로 되돌린다
 * (FlashList 문서가 권하는 방식). 재활용된 칸은 다시 등장하지 않는다 — entering 도 처음 붙을 때만 돌았다.
 */
export function useAppear(index: number, id: string | number) {
  const progress = useSharedValue(0)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      progress.value = withDelay(motion.stagger(index), withTiming(1, motion.timing.normal))
      return
    }
    cancelAnimation(progress)
    progress.value = 1
    // 순번은 처음 한 번만 쓴다. 재활용될 때 새 순번으로 다시 늦출 까닭이 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -RISE }],
  }))
}

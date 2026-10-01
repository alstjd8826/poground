import React, { useCallback } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'

import { motion } from '@/styles'
import type { SharedTransitionStyle } from '@/utils/sharedTransition'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  /** 눌렸을 때 줄어드는 비율. 큰 카드는 덜 줄여야 자연스럽다 */
  scaleTo?: number
  /** 눌림 중 흐려지는 정도 */
  dimTo?: number
  /** Shared 가 넣어 준다. 직접 적지 말 것 — @/components/foundation/Shared 참고 */
  sharedTransitionTag?: string
  sharedTransitionStyle?: SharedTransitionStyle

  children: React.ReactNode
}

/**
 * 누르면 살짝 줄고 흐려지는 터치 영역.
 *
 * 스프링을 쓰면 떼는 순간 원래 크기로 튕겨 돌아와 손맛이 산다.
 * 값 변경은 전부 워클릿에서 일어나 JS 스레드가 막혀도 반응이 끊기지 않는다.
 */
export function PressableScale({
  style,
  scaleTo = motion.pressScale,
  dimTo = 0.92,
  children,
  disabled,
  sharedTransitionTag,
  sharedTransitionStyle,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const onPressIn = useCallback(() => {
    scale.value = withSpring(scaleTo, motion.spring.press)
    opacity.value = withTiming(dimTo, motion.timing.instant)
  }, [scale, opacity, scaleTo, dimTo])

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, motion.spring.press)
    opacity.value = withTiming(1, motion.timing.fast)
  }, [scale, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <AnimatedPressable
      {...rest}
      sharedTransitionTag={sharedTransitionTag}
      sharedTransitionStyle={sharedTransitionStyle as never}
      disabled={disabled}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      style={[style, animatedStyle, disabled && { opacity: 0.4 }]}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
    >
      {children}
    </AnimatedPressable>
  )
}

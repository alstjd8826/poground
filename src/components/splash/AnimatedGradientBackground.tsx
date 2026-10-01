import React, { useEffect, useMemo } from 'react'
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Rect,
  RadialGradient,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg'

import { motion, palette } from '@/styles'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/**
 * 떠다니는 컬러 블롭 하나.
 * from/to 는 화면 크기에 대한 비율(0~1)이라 기기 해상도와 무관하게 같은 구도가 나온다.
 */
export interface Blob {
  id: string
  color: string
  /** 반지름 비율. 화면 너비 기준 */
  radius: number
  from: { x: number; y: number }
  to: { x: number; y: number }
  /** 중심 불투명도 */
  opacity: number
  /** 한 번 왕복하는 데 걸리는 시간(ms) */
  period: number
  delay?: number
}

/**
 * 구단 4색 조합. 검정 바탕에서 빨강이 올라오고 그 위로 불꽃(Sandal)이 번지며,
 * 시안 포인트가 가장자리에서 아주 옅게 깔린다.
 */
export const STEELERS_BLOBS: Blob[] = [
  {
    id: 'red',
    color: palette.red,
    radius: 0.85,
    from: { x: 0.18, y: 0.28 },
    to: { x: 0.52, y: 0.46 },
    opacity: 0.9,
    period: 9000,
  },
  {
    id: 'sandal',
    color: palette.sandal,
    radius: 0.62,
    from: { x: 0.85, y: 0.72 },
    to: { x: 0.55, y: 0.5 },
    opacity: 0.75,
    period: 11000,
    delay: 600,
  },
  {
    id: 'deep',
    color: palette.red80,
    radius: 0.95,
    from: { x: 0.9, y: 0.12 },
    to: { x: 0.62, y: 0.3 },
    opacity: 0.7,
    period: 13000,
    delay: 1200,
  },
  {
    id: 'cyan',
    color: palette.cyan,
    radius: 0.45,
    from: { x: 0.08, y: 0.9 },
    to: { x: 0.3, y: 0.72 },
    // 포인트 컬러라 아주 옅게만 깐다. 여기 값을 올리면 구단 톤이 깨진다.
    opacity: 0.28,
    period: 15000,
    delay: 400,
  },
]

function DriftingBlob({
  blob,
  width,
  height,
  animate,
}: {
  blob: Blob
  width: number
  height: number
  animate: boolean
}) {
  const t = useSharedValue(0)

  useEffect(() => {
    if (!animate) {
      t.value = 0.5
      return
    }
    t.value = withDelay(
      blob.delay ?? 0,
      withRepeat(
        withTiming(1, {
          duration: blob.period,
          easing: motion.easing.ambient,
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        // 되돌아오게 해서 루프 이음새가 보이지 않게 한다
        true,
      ),
    )
    return () => cancelAnimation(t)
  }, [t, blob, animate])

  const animatedProps = useAnimatedProps(() => ({
    cx: (blob.from.x + (blob.to.x - blob.from.x) * t.value) * width,
    cy: (blob.from.y + (blob.to.y - blob.from.y) * t.value) * height,
  }))

  return (
    <AnimatedCircle animatedProps={animatedProps} r={blob.radius * width} fill={`url(#grad-${blob.id})`} />
  )
}

export interface AnimatedGradientBackgroundProps {
  blobs?: Blob[]
  /** 끄면 정지 화면이 된다. 스크린샷·테스트용 */
  animate?: boolean
  style?: ViewStyle
  children?: React.ReactNode
}

/**
 * 애니메이티드 메시 그라디언트 배경.
 *
 * 블러 라이브러리 없이 SVG RadialGradient 의 바깥 stop 을 투명으로 두어 부드러운 경계를 만든다.
 * 중심 좌표만 워클릿에서 갱신하므로 JS 스레드를 전혀 쓰지 않는다.
 */
export function AnimatedGradientBackground({
  blobs = STEELERS_BLOBS,
  animate = true,
  style,
  children,
}: AnimatedGradientBackgroundProps) {
  const { width, height } = useWindowDimensions()
  const defs = useMemo(
    () =>
      blobs.map(b => (
        <RadialGradient key={b.id} id={`grad-${b.id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
          <Stop offset="0.55" stopColor={b.color} stopOpacity={b.opacity * 0.35} />
          <Stop offset="1" stopColor={b.color} stopOpacity={0} />
        </RadialGradient>
      )),
    [blobs],
  )

  return (
    <View style={[styles.root, style]}>
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <SvgLinearGradient id="base" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={palette.black} />
            <Stop offset="0.55" stopColor="#140304" />
            <Stop offset="1" stopColor={palette.black} />
          </SvgLinearGradient>
          {defs}
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#base)" />
        {blobs.map(b => (
          <DriftingBlob key={b.id} blob={b} width={width} height={height} animate={animate} />
        ))}
      </Svg>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.black },
})

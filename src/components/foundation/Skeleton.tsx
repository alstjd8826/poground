import { useEffect } from 'react'
import { type DimensionValue, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { cornerRadius } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'

/** RN 0.87 타입에서 StyleSheet.absoluteFillObject 가 빠져 같은 값을 직접 둔다 */
const absoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const

export interface SkeletonProps {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: ViewStyle
}

const SHIMMER_WIDTH = 160

/**
 * 로딩 자리표시자.
 *
 * 불투명도만 깜빡이면 화면에 여러 개 떴을 때 산만해서, 하이라이트 띠가 한 방향으로
 * 훑고 지나가는 shimmer 로 통일한다.
 *
 * 그라디언트는 react-native-svg 로 그린다. 별도 그라디언트 네이티브 모듈을 더 붙이지 않고,
 * 움직이는 건 Animated.View 의 translateX 뿐이라 전부 UI 스레드에서 돈다.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = cornerRadius['100'],
  style,
}: SkeletonProps) {
  const theme = useTheme()
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
      -1,
      false,
    )
    // 언마운트 때 취소하지 않으면 리스트를 빠르게 스크롤할 때 타이머가 쌓인다
    return () => cancelAnimation(progress)
  }, [progress])

  const shimmerStyle = useAnimatedStyle(() => ({
    // 컨테이너 밖에서 시작해 반대편 밖으로 빠져나간다
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-SHIMMER_WIDTH, 360]) }],
  }))

  return (
    <View
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.skeleton }, styles.clip, style]}
      // 스크린리더가 빈 상자를 읽지 않게 한다
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.shimmer, shimmerStyle]}>
        <Svg width={SHIMMER_WIDTH} height="100%">
          <Defs>
            <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={theme.skeletonHighlight} stopOpacity={0} />
              <Stop offset="0.5" stopColor={theme.skeletonHighlight} stopOpacity={1} />
              <Stop offset="1" stopColor={theme.skeletonHighlight} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={SHIMMER_WIDTH} height="100%" fill="url(#shimmer)" />
        </Svg>
      </Animated.View>
    </View>
  )
}

/** 여러 줄짜리 텍스트 자리표시자. 마지막 줄을 짧게 해 문단처럼 보이게 한다. */
export function SkeletonText({
  lines = 3,
  lineHeight = 14,
  gap = 8,
  lastLineWidth = '60%',
}: {
  lines?: number
  lineHeight?: number
  gap?: number
  lastLineWidth?: DimensionValue
}) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === lines - 1 ? lastLineWidth : '100%'} radius={4} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  shimmer: { ...absoluteFill, width: SHIMMER_WIDTH },
})

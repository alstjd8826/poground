import { useEffect } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { fonts, palette } from '@/styles'

/** RN 0.87 타입에서 StyleSheet.absoluteFillObject 가 빠져 같은 값을 직접 둔다 */
const absoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const

/**
 * 마크 한 변. **app.json 의 expo-splash-screen.imageWidth 와 같은 값이어야 한다** —
 * 네이티브가 이 크기로 띄운 그림을 JS 가 이어받는다. 한쪽만 고치면 마크가 한 번 튄다.
 */
const MARK_SIZE = 220

/** 마크 아래끝과 이름 사이 간격 */
const NAME_GAP = 32

export interface SplashScreenProps {
  /** 등장 연출이 끝나면 호출된다. 데이터 준비와 무관하게 최소 노출 시간을 보장하는 용도 */
  onFinish?: () => void
  /** 연출을 건너뛰고 최종 상태로 둔다. 스냅샷 테스트용 */
  staticMode?: boolean
}

/**
 * 스플래시.
 *
 * 네이티브 스플래시(app.json 의 expo-splash-screen)가 구단 빨강 위에 POG 마크를 띄우고,
 * JS 가 붙으면 이 화면이 같은 구도를 그대로 이어받는다.
 *
 * 이음새를 없애는 규칙 두 가지:
 *   1. 배경이 같아야 한다 -> 양쪽 모두 단색 palette.red. 그라디언트를 깔던 시절에는
 *      기기 비율마다 잘리는 자리가 달라 첫 프레임을 손으로 맞춰야 했다
 *   2. 마크가 안 움직여야 한다 -> 양쪽 모두 화면 정중앙, 같은 크기(MARK_SIZE), 페이드인 없음
 *
 * 그래서 여기서 애니메이션이 붙는 건 이름뿐이다. 마크에 인트로를 넣으면 네이티브에서
 * 이미 보이던 그림이 한 번 깜빡였다가 다시 나타난다.
 */
export function SplashScreen({ onFinish, staticMode = false }: SplashScreenProps) {
  const nameOpacity = useSharedValue(staticMode ? 1 : 0)
  const nameY = useSharedValue(staticMode ? 0 : 10)

  useEffect(() => {
    if (staticMode) return
    const ease = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }

    nameOpacity.value = withDelay(220, withTiming(1, { duration: 460, ...ease }))
    nameY.value = withDelay(
      220,
      withTiming(0, { duration: 460, ...ease }, finished => {
        'worklet'
        if (finished && onFinish) runOnJS(onFinish)()
      }),
    )
  }, [staticMode, nameOpacity, nameY, onFinish])

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }],
  }))

  return (
    <View style={styles.root}>
      {/*
        마크를 화면 정중앙에 둔다. 구단 엠블럼은 쓰지 않는다 — 비공식 앱이 남의 상표를
        첫 화면에 크게 띄우면 공식 앱처럼 읽힌다.
      */}
      <View style={styles.center} pointerEvents="none">
        <Image
          source={require('@assets/icon/splash-mark.png')}
          style={styles.mark}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      {/* 이름은 아래에 스며들며 붙는다. 마크 자리에 영향을 주지 않게 절대 배치다 */}
      <Animated.View
        style={[styles.nameBox, { paddingTop: MARK_SIZE / 2 + NAME_GAP }, nameStyle]}
        pointerEvents="none"
      >
        <Text style={styles.name}>포그라운드</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...absoluteFill, backgroundColor: palette.red },
  center: { ...absoluteFill, alignItems: 'center', justifyContent: 'center' },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  /**
   * 박스 윗변을 화면 정중앙(top: 50%)에 두고, 거기서 마크 절반 + 갭만큼 내린다.
   * 이렇게 하면 이름의 높이를 몰라도 위치가 정확히 떨어진다.
   * (absoluteFill + justifyContent:center + paddingTop 조합은 패딩이 절반만 먹어서 겹친다)
   */
  nameBox: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  name: {
    ...fonts.display,
    color: palette.white,
    textAlign: 'center',
  },
})

import { type ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import { useHoloTilt } from './tilt'

const DEG = Math.PI / 180

export interface HoloLayerProps {
  /**
   * 카드 면에서 얼마나 떠 있나(pt). 0 이면 면에 붙어 카드와 똑같이 움직이고,
   * 클수록 기울일 때 많이 어긋나 튀어나와 보인다.
   */
  depth?: number
  /** 떠 있는 만큼 커 보이게 할지. 누끼처럼 진짜 앞으로 나온 것에만 쓴다 */
  scale?: number
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/**
 * 홀로 표면 위에 떠 있는 층.
 *
 * 카드를 통째로 기울이면 그 위의 것도 같이 기울 뿐이라 전부 한 장의 그림으로 보인다.
 * 면보다 depth 만큼 앞에 있는 점은 카드가 기울 때 그만큼 옆으로 밀려 보이므로,
 * 그 어긋남을 평면 이동으로 흉내 낸다 — 누끼 사진만 카드에서 빠져나온 것처럼 뜬다.
 *
 * 밀어야 하는 양은 삼각비로 나온다. 카드 좌표에서 z=depth 인 점이 rotateY φ 뒤에
 * 화면상 x = depth·sinφ 로 가는데, 평면에서 같은 자리에 두려면 depth·tanφ 만큼
 * 옮기면 된다. 위아래(rotateX)는 방향이 반대다.
 */
export function HoloLayer({ depth = 18, scale = 0, style, children }: HoloLayerProps) {
  const tilt = useHoloTilt()

  const float = useAnimatedStyle(() => {
    if (!tilt) return {}
    const rx = tilt.rotX.value * DEG
    const ry = tilt.rotY.value * DEG
    // 기울기가 셀수록 1 에 가까워진다. 확대는 방향과 무관하게 "얼마나 기울었나" 만 본다
    const lean = Math.min(Math.hypot(rx, ry) / (tilt.limit * DEG), 1)
    return {
      transform: [
        { translateX: depth * Math.tan(ry) },
        { translateY: -depth * Math.tan(rx) },
        { scale: 1 + scale * lean },
      ],
    }
  })

  return <Animated.View style={[StyleSheet.absoluteFill, style, float]}>{children}</Animated.View>
}

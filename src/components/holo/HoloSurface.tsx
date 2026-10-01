import { type ReactNode, useMemo } from 'react'
import { View } from 'react-native'
import { Canvas, Fill, ImageShader, Shader, Skia, type SkImage } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { motion } from '@/styles'
import { buildShine, type ShineKey } from './shine'
import { type HoloTilt, TiltProvider } from './tilt'

/**
 * 빛나는 표면.
 *
 * 문지르면 기울고, 그 위로 빛이 흐른다. 카드 전용은 아니다 — 이미지와 마스크만 주면
 * 어떤 사물에든 걸린다.
 *
 * 기울기와 셰이더 값을 컨텍스트로 내보낸다. 표면 위에 얹은 것들(누끼 사진 같은)이 같은
 * 빛을 두르고 같은 각도로 어긋나려면 그 값을 알아야 하기 때문이다.
 */

/** 손가락을 따라갈 때와 놓았을 때. 놓으면 훨씬 느리게 눕는다 */
const FOLLOW = { mass: 1, damping: 22, stiffness: 140, reduceMotion: motion.spring.follow.reduceMotion }
const SETTLE = { mass: 1, damping: 30, stiffness: 45, reduceMotion: motion.spring.follow.reduceMotion }

/**
 * 카드 둘레에 두는 여백(pt).
 *
 * 위에 얹은 층은 기울일 때 카드 밖으로 밀려 나온다. 안드로이드는 부모 바깥으로 나간
 * 자식을 잘라 버리므로, 자를 것이 없도록 부모를 그만큼 키워 둔다.
 *
 * 필요한 양은 계산으로 나온다. 밀림은 HoloLayer 에서 depth·tan(기울기) 이고, 지금
 * 가장 깊은 층은 사진(depth 26), 기울기 한계는 14° 다.
 *
 *   26 × tan(14°) = 6.5pt
 *
 * 카드 크기와 무관한 절대값이다 — 카드를 줄여도 이 값은 그대로다. 여기에 손가락이
 * 카드를 살짝 벗어나도 문지름이 이어지도록 여유를 조금 더해 잡는다.
 *
 * 전에는 40pt 였는데, 주석에 "밀림 약 26pt" 로 적혀 있었다. depth 값 26 을 밀림으로
 * 착각한 것이고, 실제 필요량의 여섯 배였다. 카드가 작을 때 이 여백이 카드보다 더
 * 눈에 띄는 회색 띠가 됐다.
 */
export const HIT_PAD = 16

export interface HoloSurfaceProps {
  /** 사물 본체. 아직 안 만들어졌으면 null — 그동안은 아무것도 안 그린다 */
  image: SkImage | null
  /** 반짝일 영역의 알파 마스크. 없으면 전체가 대상이다 */
  mask?: SkImage | null
  /** 반짝이 타일. sparkle 효과만 쓴다 */
  sparkle?: SkImage | null
  effect: ShineKey
  /** 표시 폭(pt). 높이는 aspect 로 계산한다 */
  width: number
  /** 가로/세로 비 */
  aspect?: number
  /** 모서리 라운드(pt). 기본은 폭의 4.55% (카드 규격) */
  radius?: number
  /** 효과에 물드는 색 0..1 */
  glow?: [number, number, number]
  /** 기울기 최대 각도(도) */
  tiltLimit?: number
  /** 표면 위에 얹을 것들. HoloLayer 로 감싸면 표면보다 떠 보인다 */
  children?: ReactNode
}

export function HoloSurface({
  image,
  mask,
  sparkle,
  effect,
  width,
  aspect = 0.718,
  radius,
  glow = [1, 1, 1],
  tiltLimit = 14,
  children,
}: HoloSurfaceProps) {
  const W = width
  const H = Math.round(W / aspect)
  const R = radius ?? W * 0.0455

  const source = useMemo(() => Skia.RuntimeEffect.Make(buildShine(effect)), [effect])

  const px = useSharedValue(0.5)
  const py = useSharedValue(0.5)
  const rotX = useSharedValue(0)
  const rotY = useSharedValue(0)
  const engage = useSharedValue(0)

  // 제스처 콜백 안의 로직은 인라인으로 둔다. 별도 함수로 빼서 부르면 UI 스레드에서
  // undefined is not a function 으로 터진다
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(e => {
          engage.value = withSpring(1, FOLLOW)
          const nx = Math.min(Math.max((e.x - HIT_PAD) / W, 0), 1)
          const ny = Math.min(Math.max((e.y - HIT_PAD) / H, 0), 1)
          px.value = withSpring(nx, FOLLOW)
          py.value = withSpring(ny, FOLLOW)
          rotY.value = withSpring(-(nx * 2 - 1) * tiltLimit, FOLLOW)
          rotX.value = withSpring((ny * 2 - 1) * tiltLimit, FOLLOW)
        })
        .onUpdate(e => {
          const nx = Math.min(Math.max((e.x - HIT_PAD) / W, 0), 1)
          const ny = Math.min(Math.max((e.y - HIT_PAD) / H, 0), 1)
          px.value = withSpring(nx, FOLLOW)
          py.value = withSpring(ny, FOLLOW)
          rotY.value = withSpring(-(nx * 2 - 1) * tiltLimit, FOLLOW)
          rotX.value = withSpring((ny * 2 - 1) * tiltLimit, FOLLOW)
        })
        .onFinalize(() => {
          engage.value = withSpring(0, SETTLE)
          rotX.value = withSpring(0, SETTLE)
          rotY.value = withSpring(0, SETTLE)
          px.value = withSpring(0.5, SETTLE)
          py.value = withSpring(0.5, SETTLE)
        }),
    [W, H, tiltLimit, engage, px, py, rotX, rotY],
  )

  const hasMask = Boolean(mask)

  const uniforms = useDerivedValue(() => {
    return {
      res: [W, H],
      pointer: [px.value, py.value],
      engage: engage.value,
      hasMask: hasMask ? 1 : 0,
      glow,
      sparkSize: [sparkle?.width() ?? 1, sparkle?.height() ?? 1],
    }
  })

  const tilt = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateX: `${rotX.value}deg` }, { rotateY: `${rotY.value}deg` }],
  }))

  // 얹히는 것들이 같은 빛과 같은 각도를 쓰도록 함께 내보낸다
  const tiltValue = useMemo(
    () => ({
      rotX,
      rotY,
      limit: tiltLimit,
      source,
      uniforms: uniforms as unknown as HoloTilt['uniforms'],
      sparkle: sparkle ?? null,
      width: W,
      height: H,
    }),
    [rotX, rotY, tiltLimit, source, uniforms, sparkle, W, H],
  )

  return (
    <GestureDetector gesture={pan}>
      {/* 기울지 않는 히트 영역. 카드보다 한 뼘 크다 (HIT_PAD 참고) */}
      <View
        style={{
          width: W + HIT_PAD * 2,
          height: H + HIT_PAD * 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        collapsable={false}
      >
        <Animated.View style={[{ width: W, height: H }, tilt]}>
          {/* Canvas 자체의 borderRadius 는 스키아가 그린 픽셀을 자르지 않는다.
              둥근 모서리는 바깥 View 의 overflow 로 잘라야 한다 */}
          <View style={{ width: W, height: H, borderRadius: R, overflow: 'hidden' }}>
            <Canvas style={{ width: W, height: H }}>
              {image && source && (
                <Fill>
                  <Shader source={source} uniforms={uniforms}>
                    <ImageShader
                      image={image}
                      x={0}
                      y={0}
                      width={W}
                      height={H}
                      fit="fill"
                      tx="clamp"
                      ty="clamp"
                    />
                    {/* 마스크가 없어도 uniform shader 슬롯은 채워야 한다 */}
                    <ImageShader
                      image={mask ?? image}
                      x={0}
                      y={0}
                      width={W}
                      height={H}
                      fit="fill"
                      tx="clamp"
                      ty="clamp"
                    />
                    {/* 반짝이 타일은 원본 크기로 두고 셰이더가 이어 붙인다 */}
                    <ImageShader image={sparkle ?? image} fit="none" tx="repeat" ty="repeat" />
                  </Shader>
                </Fill>
              )}
            </Canvas>
          </View>

          {/* 표면 위에 얹히는 것들 */}
          <TiltProvider value={tiltValue}>{children}</TiltProvider>
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

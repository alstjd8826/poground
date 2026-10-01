/**
 * Reanimated 테스트 스텁 (react-native-reanimated 4.5.1 대상).
 *
 * 왜 직접 두는가:
 *   런타임에서는 reanimated 4.5.1 ↔ RN 0.86.3 조합이 정상이다(Expo SDK 57 이 고정한 짝).
 *   문제는 jest 뿐이다. Reanimated 4 에서 worklets 가 별도 패키지로 빠지면서
 *   테스트 환경에 워클릿 런타임이 없으면 import 시점에 죽는다.
 *     - 스텁 없이            -> `Cannot read properties of undefined (reading 'loadUnpackers')`
 *     - worklets jest resolver -> `[Worklets] createShareable is not supported on web`
 *     - 양쪽 다 web 구현      -> react-native-web 을 요구하는데 React 19 와 peer 충돌
 *   jest-expo 도 reanimated 를 목킹하지 않는다(preset 은 babel 플러그인 예외 처리만 한다).
 *
 * 무엇을 검증할 수 있나:
 *   값은 애니메이션 없이 즉시 목표값이 된다. 따라서 "렌더되는가 / 최종 상태가 맞는가" 까지만 본다.
 *   타이밍·이징 같은 움직임은 단말에서 봐야 한다(GalleryScreen).
 *
 * 주의: 루트 __mocks__/ 는 node_modules 패키지를 자동 목킹한다.
 *       jest.config 의 moduleNameMapper 를 지워도 계속 적용되므로,
 *       스텁이 실제로 빠졌는지 보려면 이 폴더째 옮겨야 한다.
 *
 * 업스트림이 정리되면 이 파일을 지우고 공식 setUpTests() 로 갈아타면 된다.
 */
import React from 'react'
import { FlatList, Image, ScrollView, Text, View } from 'react-native'

type AnyFn = (...args: any[]) => any

/** withTiming/withSpring 류는 목표값을 그대로 돌려준다 */
const toValue = <T,>(v: T) => v

// ─────────────────────────────── 레이아웃 애니메이션
// entering/exiting 빌더는 체이닝만 되면 된다. 어떤 이름(FadeIn, SlideInRight, ZoomOut...)이 와도
// 똑같이 동작하도록 Proxy 로 열어두어, 새 프리셋을 쓸 때 이 파일을 고치지 않게 한다.

const CHAIN_METHODS = [
  'delay',
  'duration',
  'springify',
  'damping',
  'stiffness',
  'mass',
  'overshootClamping',
  'restDisplacementThreshold',
  'restSpeedThreshold',
  'easing',
  'reduceMotion',
  'withInitialValues',
  'withCallback',
  'randomDelay',
  'getDelay',
  'getDuration',
  'build',
]

function makeLayoutBuilder(): Record<string, AnyFn> {
  const builder: Record<string, AnyFn> = {}
  for (const key of CHAIN_METHODS) builder[key] = () => builder
  return builder
}

/** 정적 접근(FadeIn.duration(...))과 인스턴스 생성(new Keyframe({}))을 모두 받아준다 */
const layoutProxy: any = new Proxy(function () {} as any, {
  get: (_t, prop) => (prop === 'prototype' ? undefined : makeLayoutBuilder()),
  construct: () => makeLayoutBuilder(),
  apply: () => makeLayoutBuilder(),
})

export const FadeIn = layoutProxy.FadeIn
export const FadeOut = layoutProxy.FadeOut
export const FadeInUp = layoutProxy.FadeInUp
export const FadeInDown = layoutProxy.FadeInDown
export const FadeOutUp = layoutProxy.FadeOutUp
export const FadeOutDown = layoutProxy.FadeOutDown
export const SlideInLeft = layoutProxy.SlideInLeft
export const SlideInRight = layoutProxy.SlideInRight
export const SlideOutLeft = layoutProxy.SlideOutLeft
export const SlideOutRight = layoutProxy.SlideOutRight
export const ZoomIn = layoutProxy.ZoomIn
export const ZoomOut = layoutProxy.ZoomOut
export const Layout = layoutProxy.Layout
export const LinearTransition = layoutProxy.LinearTransition
export const Keyframe = layoutProxy.Keyframe

// ─────────────────────────────── 값 훅

export const useSharedValue = <T,>(initial: T) => {
  const ref = React.useRef<{ value: T }>({ value: initial })
  return ref.current
}

export const useDerivedValue = <T,>(factory: () => T) => ({ value: factory() })
export const useAnimatedStyle = (factory: () => object) => factory()
export const useAnimatedProps = (factory: () => object) => factory()
export const useAnimatedRef = () => React.useRef(null)
export const useAnimatedScrollHandler = () => () => {}
export const useAnimatedReaction = () => {}
export const useAnimatedKeyboard = () => ({ height: { value: 0 }, state: { value: 0 } })
export const useScrollViewOffset = () => ({ value: 0 })

// ─────────────────────────────── 애니메이션 생성자
// 콜백을 받는 시그니처(withTiming(v, cfg, cb))를 지원해야 한다.
// 실제 코드가 완료 콜백에서 runOnJS 로 다음 단계를 부르는 경우가 많아, 즉시 finished=true 로 호출한다.

function withCallback<T>(value: T, maybeConfig?: unknown, maybeCallback?: unknown): T {
  const cb = typeof maybeConfig === 'function' ? maybeConfig : maybeCallback
  if (typeof cb === 'function') (cb as AnyFn)(true)
  return value
}

export const withTiming = withCallback
export const withSpring = withCallback
export const withDecay = withCallback
export const withDelay = <T,>(_delay: number, animation: T) => animation
export const withSequence = <T,>(...animations: T[]) => animations[animations.length - 1] as T
export const withRepeat = <T,>(animation: T) => animation
export const cancelAnimation = () => {}
export const makeMutable = <T,>(initial: T) => ({ value: initial })

// ─────────────────────────────── 워클릿 유틸

export const runOnJS = (fn: AnyFn) => fn
export const runOnUI = (fn: AnyFn) => fn
export const measure = () => null
export const scrollTo = () => {}

export const interpolate = (value: number, input: number[], output: number[]) => output[0] ?? value
export const interpolateColor = (_v: number, _i: number[], output: string[]) => output[0]
export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const Extrapolation = { IDENTITY: 'identity', CLAMP: 'clamp', EXTEND: 'extend' } as const
export const Extrapolate = Extrapolation

export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' } as const

/** Easing 은 어떤 이름으로 불려도 항등 함수를 돌려주면 된다 */
export const Easing: any = new Proxy(
  {},
  {
    get:
      () =>
      (..._args: unknown[]) =>
        toValue,
  },
)

// ─────────────────────────────── 컴포넌트

const createAnimatedComponent = <P extends object>(Component: React.ComponentType<P>) => Component

/**
 * Animated.Text 를 View 로 바꾸면 getByText 가 글자를 못 찾는다.
 * 각 호스트 컴포넌트는 반드시 같은 종류로 매핑한다.
 */
const HOST: Record<string, unknown> = {
  View,
  Text,
  ScrollView,
  Image,
  FlatList,
}

const Animated: any = new Proxy(
  { createAnimatedComponent },
  {
    get: (target: any, prop: string) => {
      if (prop in target) return target[prop]
      // 목록에 없는 Animated.* 는 View 로 떨어뜨린다 (레이아웃만 필요한 경우)
      return HOST[prop] ?? View
    },
  },
)

export { createAnimatedComponent }
export default Animated

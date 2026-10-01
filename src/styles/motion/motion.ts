import { Easing, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated'

/**
 * 모션 토큰.
 *
 * 화면마다 duration 을 즉흥적으로 적으면 앱 전체 리듬이 깨진다.
 * 여기 있는 프리셋만 쓰고, 새 값이 필요하면 프리셋을 추가한다.
 *
 * ReduceMotion.System 을 붙여 두면 "동작 줄이기" 를 켠 사용자에게 자동으로 애니메이션이 완화된다.
 */
export const duration = {
  /** 눌림 피드백처럼 즉각 반응해야 하는 것 */
  instant: 120,
  fast: 200,
  normal: 300,
  slow: 450,
  /** 스플래시·그라디언트 등 배경에서 천천히 도는 것 */
  ambient: 6000,
} as const

/** 화면 진입은 감속, 이탈은 가속이 자연스럽다 */
export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
  /** 배경 루프용. 양끝이 매끄러워야 이어 붙여도 튀지 않는다 */
  ambient: Easing.inOut(Easing.sin),
} as const

export const timing = {
  instant: { duration: duration.instant, easing: easing.standard, reduceMotion: ReduceMotion.System },
  fast: { duration: duration.fast, easing: easing.standard, reduceMotion: ReduceMotion.System },
  normal: { duration: duration.normal, easing: easing.decelerate, reduceMotion: ReduceMotion.System },
  slow: { duration: duration.slow, easing: easing.decelerate, reduceMotion: ReduceMotion.System },
} satisfies Record<string, WithTimingConfig>

export const spring = {
  /** 카드 눌림. 오버슈트 없이 짧게 */
  press: { damping: 20, stiffness: 320, mass: 0.6, reduceMotion: ReduceMotion.System },
  /** 목록 항목 등장. 살짝 튀는 편이 생동감이 있다 */
  entrance: { damping: 16, stiffness: 180, mass: 0.9, reduceMotion: ReduceMotion.System },
  /** 탭 인디케이터처럼 따라붙는 것 */
  follow: { damping: 24, stiffness: 240, mass: 0.8, reduceMotion: ReduceMotion.System },
} satisfies Record<string, WithSpringConfig>

/** 목록이 한 번에 우르르 뜨지 않게 주는 지연. 너무 길면 느려 보인다. */
export const stagger = (index: number, step = 45, max = 6) => Math.min(index, max) * step

/** 눌렸을 때 카드가 줄어드는 정도 */
export const pressScale = 0.97

const motion = { duration, easing, timing, spring, stagger, pressScale }
export default motion

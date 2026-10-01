import palette from './palette'

/**
 * 앱 테마 = 이번 시즌 유니폼 조합.
 *
 *   home    빨강(메인) / 검정(서브)   -> 어두운 화면
 *   away    흰색(메인) / 빨강(서브)   -> 밝은 화면
 *   keeper  노랑(메인) / 하늘(서브)   -> 어두운 화면
 *
 * 앞의 둘은 다크/라이트로 그대로 떨어져 단말 외관 설정과 맞물린다. 골키퍼는 짝이 없어
 * 직접 골랐을 때만 쓰인다 — 2026 시즌에 실제로 나온 세 번째 유니폼이 골키퍼 킷이다.
 * 화면 코드는 여기 있는 시맨틱 키만 쓴다. palette 를 직접 import 하지 말 것.
 */
export type ThemeKey = 'home' | 'away' | 'keeper'

export interface Theme {
  key: ThemeKey
  /** 유니폼 메인 컬러. 강조·주요 버튼 */
  main: string
  /** 유니폼 서브 컬러. 바탕·보조 */
  sub: string
  /** 상태바 스타일 */
  barStyle: 'light-content' | 'dark-content'

  background: string
  surface: string
  surfaceElevated: string
  /**
   * 바텀시트 바탕.
   *
   * 애플 시트는 화면을 다 덮지 않을 때(중형 디텐트) 바탕을 한 단 눌러서, 뒤에 화면이
   * 남아 있다는 것을 색으로도 알린다. surface 를 그대로 쓰면 원정 테마에서 흰 위에 흰이
   * 얹혀 시트의 경계가 사라진다.
   */
  sheet: string
  /** 스켈레톤 바탕과 하이라이트 */
  skeleton: string
  skeletonHighlight: string

  textPrimary: string
  textSecondary: string
  textMuted: string
  /** 고를 수 없는 항목. textMuted 보다 한 단 더 죽여 "잠겼다" 가 읽히게 한다 */
  textDisabled: string
  /** main 위에 얹는 글자색 */
  textOnMain: string

  border: string
  divider: string

  accent: string
  accentSoft: string
  /** 불꽃 포인트. 라이브 뱃지·강조 그라디언트 */
  flame: string
  point: string

  win: string
  draw: string
  loss: string
  /** 경고 카드 */
  cardYellow: string
  /** 퇴장 카드 */
  cardRed: string
  /** 순위표 자격/강등 띠 */
  rankAcle: string
  rankAcl2: string
  rankRelegation: string

  /** 그림자 색. 라이트에서만 의미가 있어 다크에서는 거의 투명하게 둔다 */
  shadow: string
  shadowOpacity: number
}

export const homeTheme: Theme = {
  key: 'home',
  main: palette.red,
  sub: palette.black,
  barStyle: 'light-content',

  background: palette.gray['100'],
  surface: palette.gray['90'],
  surfaceElevated: palette.gray['85'],
  sheet: palette.gray['85'],
  skeleton: palette.gray['85'],
  skeletonHighlight: palette.gray['70'],

  textPrimary: palette.white,
  textSecondary: palette.gray['30'],
  textMuted: palette.gray['50'],
  textDisabled: palette.gray['70'],
  textOnMain: palette.white,

  border: palette.gray['80'],
  divider: palette.gray['85'],

  accent: palette.red,
  accentSoft: palette.red80,
  flame: palette.sandal,
  point: palette.cyan,

  win: palette.win,
  draw: palette.draw,
  loss: palette.red,
  cardYellow: palette.cardYellow,
  cardRed: palette.cardRed,
  rankAcle: palette.rankAcle,
  rankAcl2: palette.rankAcl2,
  rankRelegation: palette.rankRelegation,

  shadow: palette.black,
  shadowOpacity: 0.4,
}

export const awayTheme: Theme = {
  key: 'away',
  main: palette.white,
  sub: palette.red,
  barStyle: 'dark-content',

  background: palette.gray['5'],
  surface: palette.white,
  surfaceElevated: palette.white,
  sheet: palette.gray['5'],
  skeleton: palette.gray['10'],
  skeletonHighlight: palette.gray['5'],

  textPrimary: palette.gray['100'],
  textSecondary: palette.gray['50'],
  textMuted: palette.gray['40'],
  textDisabled: palette.gray['20'],
  // away 는 main 이 흰색이라 그 위 글자는 검정이어야 한다
  textOnMain: palette.gray['100'],

  border: palette.gray['20'],
  divider: palette.gray['10'],

  // 흰 바탕에서 강조는 서브 컬러인 빨강이 맡는다
  accent: palette.red,
  accentSoft: palette.red10,
  flame: palette.sandal60,
  point: palette.cyan,

  win: palette.win,
  draw: palette.gray['40'],
  loss: palette.red,
  cardYellow: palette.cardYellow,
  cardRed: palette.cardRed,
  rankAcle: palette.rankAcle,
  rankAcl2: palette.rankAcl2,
  rankRelegation: palette.rankRelegation,

  shadow: palette.gray['100'],
  shadowOpacity: 0.08,
}

/**
 * 골키퍼 유니폼 테마.
 *
 * 홈과 같은 어두운 화면이지만 바탕이 무채색이 아니라 하늘색을 머금고 있어 한눈에 갈린다.
 * 강조는 유니폼 주색인 노랑이 맡고, 하늘색은 포인트로 돈다.
 */
export const keeperTheme: Theme = {
  key: 'keeper',
  main: palette.keeper.yellow,
  sub: palette.keeper.sky,
  barStyle: 'light-content',

  background: palette.keeper.background,
  surface: palette.keeper.surface,
  surfaceElevated: palette.keeper.surfaceElevated,
  sheet: palette.keeper.surfaceElevated,
  skeleton: palette.keeper.surfaceElevated,
  skeletonHighlight: palette.keeper.border,

  textPrimary: palette.white,
  textSecondary: palette.keeper.textSecondary,
  textMuted: palette.keeper.textMuted,
  textDisabled: palette.keeper.textDisabled,
  // main 이 밝은 노랑이라 그 위 글자는 검정이어야 읽힌다
  textOnMain: palette.gray['100'],

  border: palette.keeper.border,
  divider: palette.keeper.surfaceElevated,

  accent: palette.keeper.yellow,
  accentSoft: palette.keeper.yellowSoft,
  flame: palette.sandal,
  point: palette.keeper.sky,

  win: palette.win,
  draw: palette.draw,
  // 패배는 어느 유니폼에서든 빨강이다. 결과 색까지 테마를 타면 표가 안 읽힌다
  loss: palette.red,
  cardYellow: palette.cardYellow,
  cardRed: palette.cardRed,
  rankAcle: palette.rankAcle,
  rankAcl2: palette.rankAcl2,
  rankRelegation: palette.rankRelegation,

  shadow: palette.black,
  shadowOpacity: 0.4,
}

export const themes: Record<ThemeKey, Theme> = {
  home: homeTheme,
  away: awayTheme,
  keeper: keeperTheme,
}

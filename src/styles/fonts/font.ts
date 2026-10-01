import { StyleSheet } from 'react-native'

/**
 * Gmarket Sans.
 *
 * K리그 공식 서체를 쓰다가 갈아탔다. 그쪽 라이선스가 **비상업적 용도로만** 이라
 * 앱스토어에 올릴 물건에는 못 쓴다. Gmarket Sans 는 SIL Open Font License 라
 * 상업적 사용도, 앱에 심는 것도, 로고에 쓰는 것도 열려 있다.
 *
 * 문자열은 파일명이 아니라 **PostScript 이름** 이다(iOS 가 그걸로 찾는다).
 * 파일은 GmarketSansTTFMedium.ttf 이고 이름은 GmarketSansTTFMedium 으로, 우연히 같다.
 *
 * 주의: Light/Medium/Bold 중 두 벌만 심었다. fontWeight 로 중간 굵기를 만들면
 * 플랫폼마다 가짜 볼드가 생기므로 굵기는 반드시 fontFamily 로만 고른다.
 */
export const fontFamily = {
  /** 본문용 */
  basic: 'GmarketSansTTFMedium',
  /** 제목·숫자용 */
  dynamic: 'GmarketSansTTFBold',
} as const

const fonts = StyleSheet.create({
  /** 스코어처럼 크게 보여주는 숫자 */
  display: { fontFamily: fontFamily.dynamic, fontSize: 48, lineHeight: 52, letterSpacing: -1 },
  title1: { fontFamily: fontFamily.dynamic, fontSize: 24, lineHeight: 32, letterSpacing: -0.4 },
  title2: { fontFamily: fontFamily.dynamic, fontSize: 20, lineHeight: 28, letterSpacing: -0.3 },
  headline: { fontFamily: fontFamily.dynamic, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  /** 라벨·탭·뱃지 */
  label: { fontFamily: fontFamily.dynamic, fontSize: 13, lineHeight: 18, letterSpacing: 0 },

  body: { fontFamily: fontFamily.basic, fontSize: 15, lineHeight: 24, letterSpacing: -0.2 },
  bodySmall: { fontFamily: fontFamily.basic, fontSize: 13, lineHeight: 20, letterSpacing: -0.1 },
  caption: { fontFamily: fontFamily.basic, fontSize: 12, lineHeight: 16, letterSpacing: 0 },

  /** 표 안의 숫자. 자릿수가 흔들리지 않게 등폭으로 쓴다 */
  numeric: { fontFamily: fontFamily.dynamic, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  numericSmall: {
    fontFamily: fontFamily.dynamic,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },

  /**
   * 입력칸 전용. body 와 같지만 **lineHeight 가 없다.**
   *
   * iOS 의 TextInput 에 lineHeight 를 주면 글자가 칸의 위아래 가운데에 놓이지 않고
   * 한쪽으로 밀린다. Text 에서는 줄 간격이 되는 값이 TextInput 에서는 글자 상자의
   * 기준을 흔든다.
   *
   * 그래서 입력칸에는 fonts.body 를 쓰지 말고 이것을 쓴다. 높이는 패딩으로 잡는다.
   */
  field: { fontFamily: fontFamily.basic, fontSize: 15, letterSpacing: -0.2 },
})

export default fonts

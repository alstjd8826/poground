const cornerRadius = {
  '050': 4,
  '100': 8,
  '150': 12,
  '200': 16,
  '300': 24,
  /** 바텀시트 윗모서리. 애플 시트 도해에서 잰 값(약 32pt)에 맞춘다 */
  '400': 32,
  full: 999,
} as const

export default cornerRadius

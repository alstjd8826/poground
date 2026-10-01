import Svg, { Path, Rect } from 'react-native-svg'

/** 나만 보기 표시. 글자 기호 대신 벡터로 그려 테마 색을 따른다 */
export function LockIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="나만 보기" accessible>
      <Rect x={5} y={10} width={14} height={11} rx={2.5} fill={color} />
      <Path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke={color}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  )
}

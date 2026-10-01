import { StyleSheet, Text } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

/**
 * 좋아요 하트와 수. 피드 카드와 글 상세가 같이 쓴다.
 *
 * 하트는 글자(♡)가 아니라 직접 그린다 — K리그 서체에 그 글자가 없으면 iOS 가 다른 서체로 바꿔
 * 그려 크기와 굵기가 튄다(⋮ 때와 같은 이유). 누른 글은 강조색으로 채운다.
 */
export function LikeButton({
  liked,
  count,
  onPress,
}: {
  liked: boolean
  count: number
  onPress?: () => void
}) {
  const theme = useTheme()
  const color = liked ? theme.accent : theme.textMuted
  return (
    <PressableScale
      scaleTo={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`좋아요 ${count}`}
      accessibilityState={{ selected: liked }}
      style={styles.row}
      hitSlop={8}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path
          d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"
          fill={liked ? color : 'none'}
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={[fonts.caption, { color }]}>{count}</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['050'] },
})

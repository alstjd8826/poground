import { useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import type { MenuAnchor } from '@/components/foundation/DropdownMenu'

/**
 * 세로 점 셋 단추. 누르면 제 자리를 재서 알린다 — 차림표가 그 자리에 붙어 뜬다.
 *
 * 점은 글자(⋮)가 아니라 직접 그린다. K리그 서체 두 벌 모두 그 글자가 없다(댓글 목록과 같은 이유).
 */
export function MoreDots({
  onPress,
  accessibilityLabel = '더보기',
}: {
  onPress: (anchor: MenuAnchor) => void
  accessibilityLabel?: string
}) {
  const theme = useTheme()
  const slot = useRef<View>(null)
  const open = () => slot.current?.measureInWindow((x, y, width, height) => onPress({ x, y, width, height }))
  return (
    <View ref={slot} collapsable={false}>
      <PressableScale scaleTo={0.9} onPress={open} accessibilityLabel={accessibilityLabel} style={styles.hit}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, { backgroundColor: theme.textMuted }]} />
        ))}
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  /** 점이 작아 누를 자리가 좁다. 눌리는 넓이를 따로 준다 */
  hit: { alignItems: 'center', gap: 2, paddingHorizontal: spacing['150'], paddingVertical: spacing['100'] },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
})

import { StyleSheet, Text } from 'react-native'

import { cornerRadius, fonts, palette, spacing } from '@/styles'
import { PressableScale } from '@/components/foundation/PressableScale'

/** 어두운 오버레이 위의 둥근 단추. 팬카드와 선수 카드가 같이 쓴다 */
export function OverlayAction({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string
  tone?: string
  onPress?: () => void
  disabled?: boolean
}) {
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[styles.action, { borderColor: tone ?? palette.gray['60'], opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[fonts.label, { color: tone ?? palette.white }]}>{label}</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  action: {
    paddingHorizontal: spacing['300'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
})

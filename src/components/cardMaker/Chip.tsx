import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

/**
 * 가로 스트립에 놓는 알약 하나.
 *
 * 고르는 것과 여는 것을 같은 모양으로 둔다 — 색을 고르는 일과 색상판을 여는 일이
 * 한 줄에 섞이는데, 둘이 달라 보이면 어디까지가 고를 수 있는 것인지 흐려진다.
 * 고른 것만 테두리와 색으로 드러낸다.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  busy = false,
  swatch,
  accessibilityLabel,
}: {
  label: string
  selected?: boolean
  onPress?: () => void
  busy?: boolean
  /** 색 견본. 글자로는 안 읽히는 값이라 알약 자체를 그 색으로 채운다 */
  swatch?: string
  accessibilityLabel?: string
}) {
  const theme = useTheme()

  /**
   * 색 견본은 고른 표시를 **띠 밖에** 두른다.
   *
   * 알약 자체에 테두리를 주면 견본이 그 테두리와 같은 색일 때 사라진다 — 구단 빨강을
   * 고르면 빨강 위에 빨강 테두리라 골랐는지 알 수가 없었다. 흰 견본도 밝은 테마에서
   * 같은 일이 난다.
   *
   * 그래서 견본과 고리 사이에 **바탕색 틈**을 둔다. 고리와 견본이 같은 색이어도 틈이
   * 둘을 갈라 주므로 어떤 색에서도 표시가 보인다.
   */
  if (swatch) {
    return (
      <PressableScale
        scaleTo={0.94}
        onPress={onPress}
        disabled={!onPress || busy}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected }}
        style={[
          styles.ring,
          { borderColor: 'transparent', backgroundColor: theme.background },
          selected && { borderColor: theme.accent },
        ]}
      >
        <View style={[styles.swatch, { backgroundColor: swatch, borderColor: theme.border }]} />
      </PressableScale>
    )
  }

  return (
    <PressableScale
      scaleTo={0.94}
      onPress={onPress}
      disabled={!onPress || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { backgroundColor: theme.surface, borderColor: theme.border },
        // 고른 것은 바탕·테두리·두께가 한꺼번에 바뀐다. 겹쳐 씌우면 무엇이 달라지는지가
        // 한 덩어리로 읽힌다
        selected && styles.chipOn,
        selected && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
      ]}
    >
      {busy && <ActivityIndicator size="small" color={theme.textSecondary} />}
      {label && (
        <Text style={[fonts.bodySmall, { color: theme.textPrimary }, selected && { color: theme.accent }]}>
          {label}
        </Text>
      )}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  /** 고른 칩은 테두리가 두꺼워진다. 색은 테마에서 오므로 여기서는 두께만 */
  chipOn: { borderWidth: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['100'],
    height: 40,
    paddingHorizontal: spacing['200'],
    borderRadius: cornerRadius.full,
  },
  /**
   * 고른 표시를 두르는 고리. 안쪽 여백이 견본과 고리를 갈라 주는 틈이다 —
   * 이 틈이 없으면 견본과 고리가 같은 색일 때 하나로 보인다.
   */
  ring: {
    width: 40,
    height: 40,
    borderRadius: cornerRadius.full,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 색 견본은 글자가 없으니 동그랗게 둔다 */
  swatch: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: cornerRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
})

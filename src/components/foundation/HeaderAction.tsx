import { ActivityIndicator, StyleSheet, Text } from 'react-native'

import { fonts } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

/** 헤더에 걸 행동. 누를 것과 도는 중인지, 지금 누를 수 있는지만 알려 준다 */
export interface SaveAction {
  onPress: () => void
  busy: boolean
  /** 아직 누를 수 없는 상태. 색만 죽이고 자리는 지킨다 */
  disabled?: boolean
}

/**
 * 헤더 오른쪽에 놓는 글자 단추.
 *
 * 헤더는 높이가 정해져 있어 채운 단추를 넣을 자리가 없다. 그래서 강조 색 글자만 둔다 —
 * iOS 가 헤더 행동을 다루는 방식이기도 하다.
 *
 * 도는 동안에는 스피너로 바꾸되 **자리는 그대로 둔다.** 글자와 스피너의 폭이 다르면
 * 누른 순간 헤더 오른쪽이 들썩인다.
 */
export function HeaderAction({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  /** 눌러서 일하는 중. 안 도는 행동은 안 주면 된다 */
  busy?: boolean
  /**
   * 아직 누를 수 없다. **단추를 숨기지 않고 색만 죽인다** — 조건이 안 맞을 때마다
   * 헤더에서 사라지면 저장할 길이 없어진 것처럼 보이고, 제목도 따라 움직인다.
   */
  disabled?: boolean
}) {
  const theme = useTheme()
  const off = disabled || busy
  return (
    <PressableScale
      scaleTo={0.96}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      style={styles.headerAction}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.textSecondary} />
      ) : (
        <Text style={[fonts.headline, { color: disabled ? theme.textDisabled : theme.accent }]}>{label}</Text>
      )}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  /** 글자가 짧아 누를 자리가 좁다. 최소 폭을 줘서 스피너로 바뀌어도 안 흔들린다 */
  headerAction: { minWidth: 44, alignItems: 'center', justifyContent: 'center' },
})

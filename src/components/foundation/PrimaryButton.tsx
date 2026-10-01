import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { cornerRadius, fonts, motion } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

export interface PrimaryButtonProps {
  label: string
  onPress: () => void
  /** 누를 수 없는 상태. 색이 서서히 죽는다 */
  disabled?: boolean
  /** 눌러서 일하는 중. 글자 대신 스피너가 돈다 */
  busy?: boolean
}

/**
 * 화면의 주된 행동 하나를 맡는 단추.
 *
 * 색은 accent 다. main 을 쓰면 원정 테마에서 흰 단추가 흰 바탕에 얹혀 사라진다
 * (styles/colors/theme.ts 의 away 주석 참고).
 *
 * 잠김/풀림을 색으로 알리는데, 두 색을 즉시 갈아치우면 글자를 한 자 지웠을 때
 * 단추가 툭 꺼진다. 입력에 따라 오가는 상태라 서서히 건너가야 덜 시끄럽다.
 */
export function PrimaryButton({ label, onPress, disabled = false, busy = false }: PrimaryButtonProps) {
  const theme = useTheme()
  const live = useSharedValue(disabled ? 0 : 1)

  useEffect(() => {
    live.value = withTiming(disabled ? 0 : 1, motion.timing.fast)
  }, [disabled, live])

  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(live.value, [0, 1], [theme.surfaceElevated, theme.accent]),
  }))

  const text = useAnimatedStyle(() => ({
    color: interpolateColor(live.value, [0, 1], [theme.textDisabled, theme.textOnMain]),
  }))

  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy }}
      style={styles.press}
    >
      <Animated.View style={[styles.box, box]}>
        {busy ? (
          <ActivityIndicator color={theme.textOnMain} />
        ) : (
          <Animated.Text style={[fonts.body, text]}>{label}</Animated.Text>
        )}
      </Animated.View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  press: { borderRadius: cornerRadius['150'] },
  box: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: cornerRadius['150'],
  },
})

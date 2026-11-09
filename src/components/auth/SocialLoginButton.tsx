import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { cornerRadius } from '@/styles'
import { PressableScale } from '@/components/foundation/PressableScale'

/**
 * 소셜 로그인 버튼의 공통 틀 (2026-11-09).
 *
 * 카카오·애플·구글 버튼이 **같은 높이·글자·모서리·심볼 자리**를 쓰게 한다. 전에는 애플만
 * 애플이 그려 주는 네이티브 버튼이라 글자 크기를 시스템이 정했고, 나란히 서면 셋의 글자가
 * 제각각이었다. 각 회사가 정한 것(바탕색, 글자색, 공식 심볼)은 버튼마다 넘기고, 나머지는
 * 여기서 하나로 맞춘다.
 *
 * - 높이 52, 모서리 cornerRadius 150
 * - 글자 17pt · 600, OS 기본 서체 — 세 회사 지침이 모두 시스템 서체를 쓰라고 한다.
 *   카카오 지침의 "레이블 높이는 컨테이너의 1/3 이하"(52 / 3 = 17.3)도 넘지 않는다
 * - 심볼은 왼쪽 16 에 겹쳐 놓고 글자는 버튼 한가운데. 심볼이 글자를 밀지 않는다
 */
export const SOCIAL_BUTTON_HEIGHT = 52

/** 심볼이 놓이는 왼쪽 여백 */
const SYMBOL_LEFT = 16

export interface SocialLoginButtonProps {
  label: string
  /** 공식 심볼. 버튼 세로 가운데, 왼쪽 16 에 놓인다 */
  symbol: ReactNode
  background: string
  foreground: string
  /** 흰 바탕 버튼처럼 테두리가 있어야 하는 경우 */
  border?: string
  onPress: () => void
  disabled?: boolean
}

export function SocialLoginButton({
  label,
  symbol,
  background,
  foreground,
  border,
  onPress,
  disabled = false,
}: SocialLoginButtonProps) {
  const box: ViewStyle = { backgroundColor: background }
  if (border) {
    box.borderWidth = StyleSheet.hairlineWidth
    box.borderColor = border
  }

  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={styles.press}
    >
      <View style={[styles.box, box, disabled && styles.dim]}>
        <View style={styles.symbol} pointerEvents="none">
          {symbol}
        </View>
        <Text style={[styles.label, { color: foreground }]}>{label}</Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  box: {
    height: SOCIAL_BUTTON_HEIGHT,
    borderRadius: cornerRadius['150'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    position: 'absolute',
    left: SYMBOL_LEFT,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  /** 지침들이 OS 기본 서체를 쓰라고 해서 앱 서체를 지정하지 않는다 */
  label: { fontSize: 17, fontWeight: '600' },
  dim: { opacity: 0.5 },
})

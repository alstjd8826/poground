import * as AppleAuthentication from 'expo-apple-authentication'
import { StyleSheet } from 'react-native'

import { cornerRadius } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'

/**
 * 애플 로그인 버튼.
 *
 * 애플이 그려 주는 것을 그대로 쓴다. 다른 버튼처럼 우리가 그리면 안 된다 — 애플은
 * 모양·글자·여백을 지침으로 묶어 두고, 심사에서 이 버튼을 눈으로 확인한다.
 *
 * 그 대신 색만 배경에 맞춘다. 밝은 테마에서는 검은 버튼, 어두운 테마에서는 흰 버튼이
 * 애플이 말하는 조합이다.
 *
 * 높이는 카카오 버튼과 같은 52 로 맞춘다. 나란히 섰을 때 둘의 키가 다르면 한쪽이 덜
 * 중요한 것처럼 보인다.
 */
const HEIGHT = 52

export function AppleLoginButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const theme = useTheme()
  const dark = theme.barStyle === 'light-content'

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        dark
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={cornerRadius['150']}
      style={[styles.button, disabled && styles.dim]}
      onPress={disabled ? () => {} : onPress}
    />
  )
}

const styles = StyleSheet.create({
  button: { width: '100%', height: HEIGHT },
  dim: { opacity: 0.5 },
})

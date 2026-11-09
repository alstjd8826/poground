import Svg, { G, Path } from 'react-native-svg'

import { useTheme } from '@/hooks/theme/ThemeProvider'

import { SocialLoginButton } from './SocialLoginButton'

/**
 * 애플 로그인 버튼.
 *
 * 애플이 그려 주는 네이티브 버튼(AppleAuthenticationButton)은 글자 크기를 시스템이 정해서
 * 카카오·구글 버튼과 글자가 맞지 않았다. 그래서 HIG 의 "커스텀 Sign in with Apple 버튼"
 * 규칙대로 직접 그린다 (2026-11-09).
 *
 *   - 로고는 Apple Design Resources 의 공식 로고 모양 그대로. 색·비율을 바꾸지 않는다
 *   - 글자는 "Apple로 로그인", 시스템 서체
 *   - 다른 로그인 버튼보다 작지 않게 — 공통 틀(SocialLoginButton)로 높이·글자를 같게 둔다
 *   - 밝은 테마는 검정 바탕·흰 글자, 어두운 테마는 흰 바탕·검정 글자 (애플이 말하는 조합)
 */
const LOGO_SIZE = 20

export function AppleLoginButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const theme = useTheme()
  const dark = theme.barStyle === 'light-content'
  const background = dark ? '#FFFFFF' : '#000000'
  const foreground = dark ? '#000000' : '#FFFFFF'

  return (
    <SocialLoginButton
      label="Apple로 로그인"
      symbol={<AppleLogo color={foreground} />}
      background={background}
      foreground={foreground}
      onPress={onPress}
      disabled={disabled}
    />
  )
}

/** Apple 공식 로고 모양. 원본 viewBox 814×1000 을 24×24 안에 가운데 맞춘다 */
function AppleLogo({ color }: { color: string }) {
  return (
    <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 24 24">
      <G transform="translate(2.23 0) scale(0.024)">
        <Path
          fill={color}
          d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
        />
      </G>
    </Svg>
  )
}

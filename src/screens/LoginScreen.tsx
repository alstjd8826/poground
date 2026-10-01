import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, StyleSheet, Text, View } from 'react-native'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { KakaoLoginButton } from '@/components/auth/KakaoLoginButton'
import { AppleLoginButton } from '@/components/auth/AppleLoginButton'
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'
import { LastUsedBubble } from '@/components/auth/LastUsedBubble'
import { isAppleAvailable, type SignInOptions, useAuth } from '@/hooks/auth/useAuth'
import { PressableScale } from '@/components/foundation/PressableScale'
import { PROVIDER_ORDER, type SocialProvider } from '@/hooks/auth/providers'

export interface LoginScreenProps {
  /** 로그인이 끝난 뒤 할 일. 대개 이 화면을 닫는다 */
  onDone?: () => void
}

/**
 * 로그인.
 *
 * 소셜 버튼을 이 화면에만 둔다. 카카오·애플·구글 모두 버튼의 색·심볼·문구를 지침으로
 * 정해 두고 있어서, 설정 줄이나 얼럿 단추 자리에는 규격대로 넣을 수가 없다 —
 * 시스템 얼럿 단추는 색도 이미지도 못 넣는다.
 *
 * 그래서 그런 자리에는 중립적인 "로그인" 만 두고 여기로 보낸다. 지침이 막는 것은 버튼을
 * 규격에서 벗어나게 만드는 것이지, 로그인 화면으로 가는 길을 두는 것이 아니다.
 *
 * 애플은 iOS 에서만 뜬다. 안드로이드에서는 쓸 수 없고, 애플도 그 경우에는 두지 말라고
 * 한다. 다른 소셜을 두는 앱이 iOS 에서 애플 로그인을 빠뜨리면 심사에서 걸린다(지침 4.8).
 */
export function LoginScreen({ onDone }: LoginScreenProps) {
  const theme = useTheme()
  const { signIn, lastProvider } = useAuth()
  const [busy, setBusy] = useState(false)
  const [appleReady, setAppleReady] = useState(false)

  useEffect(() => {
    void isAppleAvailable().then(setAppleReady)
  }, [])

  const onPress = useCallback(
    async (provider: SocialProvider, options?: SignInOptions) => {
      if (busy) return
      setBusy(true)
      try {
        // 창을 닫았으면 여기 그대로 둔다. 로그인하려다 만 사람을 화면 밖으로 내보내면
        // 다시 들어와야 한다
        const done = await signIn(provider, options)
        if (done) onDone?.()
      } catch (e) {
        Alert.alert('로그인하지 못했습니다', e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [busy, onDone, signIn],
  )

  const shown = PROVIDER_ORDER.filter(p => p !== 'apple' || appleReady)

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* ── 로고 자리 */}
      <View style={styles.logoArea}>
        {/*
          앱 아이콘을 그대로 쓴다.
          흰 마크만 쓰면 밝은 테마에서 바탕에 묻힌다. 붉은 판까지 있는 아이콘을 얹으면
          어느 테마에서도 보이고, 홈 화면에서 누르고 들어온 그림과 같아 "그 앱이 맞다" 가
          한눈에 붙는다.
        */}
        <Image
          source={require('@assets/icon/icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel="포그라운드"
        />
      </View>

      {/* ── 단추 자리 */}
      <View style={styles.buttonArea}>
        {shown.map(provider => (
          <View key={provider} style={styles.slot}>
            {/* 저번에 쓴 것만 짚어 준다. 전부에 붙이면 아무것도 안 붙인 것과 같다 */}
            {lastProvider === provider && <LastUsedBubble />}
            <Button provider={provider} onPress={() => void onPress(provider)} disabled={busy} />
            {/* 기기에 남은 카카오 로그인 말고 다른 계정으로. 카카오 로그인 화면을 다시 띄운다 (2026-09-30) */}
            {provider === 'kakao' && (
              <PressableScale
                scaleTo={0.98}
                onPress={() => void onPress('kakao', { switchAccount: true })}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="다른 카카오 계정으로 로그인"
                style={styles.switch}
              >
                <Text style={[fonts.caption, { color: theme.textMuted }]}>다른 카카오 계정으로 로그인</Text>
              </PressableScale>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}

/** 지침이 저마다 달라 버튼은 서비스마다 따로 있다. 고르는 일만 여기서 한다 */
function Button({
  provider,
  onPress,
  disabled,
}: {
  provider: SocialProvider
  onPress: () => void
  disabled: boolean
}) {
  if (provider === 'kakao') return <KakaoLoginButton onPress={onPress} disabled={disabled} />
  if (provider === 'apple') return <AppleLoginButton onPress={onPress} disabled={disabled} />
  return <GoogleLoginButton onPress={onPress} disabled={disabled} />
}

/** 로고 한 변. 단추보다 눈에 먼저 닿되 화면을 잡아먹지 않는 크기 */
const LOGO = 88

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing['200'] },
  /**
   * 화면을 로고 자리와 단추 자리로 **2:3** 으로 나눈다.
   *
   * 고정 여백으로 밀면 작은 기기에서는 로고가 헤더에 붙고 큰 기기에서는 한참 떠서,
   * 같은 화면이 기기마다 다른 균형이 된다. 비율로 나누면 어디서나 같은 자리다.
   *
   * 로고는 제 자리 가운데에 놓이므로 화면 위에서 1/5쯤에 온다. 단추는 제 자리 위쪽에
   * 붙어 2/5 지점에서 시작하고, 남는 아래가 여백이 된다.
   *
   * 위를 더 작게 잡는 것은 눈이 화면의 기하학적 중앙보다 조금 위를 중앙으로 읽기
   * 때문이다. 반씩 나누면 오히려 아래로 처져 보인다.
   */
  logoArea: { flex: 2, alignItems: 'center', justifyContent: 'center' },
  buttonArea: { flex: 3, gap: spacing['150'], alignItems: 'center', justifyContent: 'center' },
  /** 아이콘은 정사각형이라 모서리를 앱 아이콘만큼 둥글린다 */
  logo: { width: LOGO, height: LOGO, borderRadius: LOGO * 0.22 },
  slot: { width: '100%' },
  /** 단추 아래 옅게. 손이 닿는 높이는 지킨다 */
  switch: { alignSelf: 'center', paddingVertical: spacing['100'], paddingHorizontal: spacing['150'] },
})

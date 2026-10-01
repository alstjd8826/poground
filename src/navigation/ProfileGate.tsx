import { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'

import { motion } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useAuth } from '@/hooks/auth/useAuth'
import { suggestedNickname, useProfile } from '@/hooks/auth/useProfile'
import { NicknameScreen } from '@/screens/NicknameScreen'
import { TermsScreen } from '@/screens/TermsScreen'
import { TERMS_VERSION } from '@/content/terms'

/**
 * 첫 로그인에서 닉네임을 받는 관문.
 *
 * 로그인은 됐는데 프로필 행이 없는 동안만 앱 위에 덮인다. 그냥 닫는 길은 두지 않는다 —
 * 지금 정하지 않으면 커뮤니티에 글을 쓸 때 이름 없는 사람이 되고, 그때 다시 물어보면
 * 글 쓰려던 흐름이 끊긴다.
 *
 * 대신 **로그아웃으로 나가는 길은 둔다.** 세션은 살아 있는데 저장이 계속 실패하면
 * (지워진 계정처럼) 이 면이 앱 전체를 덮은 채 안 걷힌다. 닫을 수도, 다시 로그인할
 * 수도 없어 앱이 통째로 잠긴다 — 계정을 지우고 실제로 한 번 갇혔다.
 *
 * 카카오 닉네임을 미리 채워 두므로 대부분은 단추 한 번으로 지나간다.
 *
 * 프로필을 만든 뒤에는 **약관 동의** 를 받는다(지침 1.2, 2026-09-30). 지금 판에 동의하지 않았으면 같은 자리에
 * 약관을 덮는다 — 이미 가입한 사람도 한 번 거친다. 여기도 로그아웃으로 나가는 길을 둔다.
 *
 * **조회가 끝나기 전에는 띄우지 않는다.** loaded 를 안 보면 앱을 켤 때마다
 * 프로필이 있는 사람에게도 한 프레임씩 번쩍인다.
 */
export function ProfileGate() {
  const theme = useTheme()
  const { session, signOut } = useAuth()
  const { profile, loaded, save, agreeTerms } = useProfile(session)

  const onSubmit = useCallback(
    async (nickname: string) => {
      await save(nickname)
    },
    [save],
  )

  if (!session || !loaded) return null
  if (profile && profile.termsVersion >= TERMS_VERSION) return null

  if (profile) {
    return (
      <Animated.View
        entering={FadeIn.duration(motion.duration.normal).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]}
      >
        <TermsScreen onAgree={agreeTerms} onDecline={() => void signOut()} />
      </Animated.View>
    )
  }

  return (
    // 앱 전체를 덮는 면이라 툭 나타나면 화면이 깨진 것처럼 보인다. 스며들게 한다
    <Animated.View
      entering={FadeIn.duration(motion.duration.normal).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]}
    >
      <NicknameScreen
        initial={suggestedNickname(session)}
        first
        onSubmit={onSubmit}
        onEscape={() => void signOut()}
      />
    </Animated.View>
  )
}

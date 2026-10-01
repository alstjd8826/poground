import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Skeleton } from '@/components/foundation/Skeleton'
import { PROVIDER_LABEL, PROVIDER_ORDER, type SocialProvider } from '@/hooks/auth/providers'
import { useIdentities } from '@/hooks/auth/useIdentities'
import { isAlreadyLinked } from '@/hooks/auth/callbackUrl'
import { useAuth } from '@/hooks/auth/useAuth'

/**
 * 계정에 이어 둔 소셜들.
 *
 * 카카오로 들어온 사람과 애플로 들어온 사람은 서로 다른 계정이다. 메일이 같고 둘 다
 * 확인됐을 때만 알아서 합쳐지는데 카카오가 메일을 안 주는 경우가 있어서, 여기서 손으로
 * 잇는 길을 둔다. 한 번 이어 두면 다음부터는 어느 것으로 들어와도 같은 계정이다.
 */
export function LinkedAccounts({ appleReady }: { appleReady: boolean }) {
  const theme = useTheme()
  const { linked, loading, link, unlink } = useIdentities()
  const { signIn, signOut } = useAuth()
  const [busy, setBusy] = useState<SocialProvider | null>(null)

  /**
   * 그 소셜이 이미 다른 계정에 물려 있을 때 내미는 길.
   *
   * 두 계정을 합치지는 않는다. 합치려면 프로필·댓글·카드·신고·차단·관리자까지 여섯 표를
   * 한 트랜잭션에서 옮기고, 아이디 중복 같은 충돌을 하나하나 정해야 하며, 무엇보다
   * **되돌릴 수 없다.** 겪는 사람은 소수인데 잘못 합치면 복구가 없다.
   *
   * 대신 방향을 뒤집는다 — 저쪽 계정으로 들어가면 거기 쓰던 기록을 그대로 본다.
   * 거기서 지금 소셜을 이으면 결국 하나로 모인다.
   */
  const switchTo = useCallback(
    async (provider: SocialProvider) => {
      try {
        await signOut()
        await signIn(provider)
      } catch (e) {
        Alert.alert('로그인하지 못했습니다', e instanceof Error ? e.message : String(e))
      }
    },
    [signIn, signOut],
  )

  /** 잇기. 동의 화면을 열고 돌아온다 */
  const linkNow = useCallback(
    async (provider: SocialProvider) => {
      setBusy(provider)
      try {
        await link(provider)
      } catch (e) {
        if (isAlreadyLinked(e)) {
          const label = PROVIDER_LABEL[provider]
          Alert.alert(
            '이미 가입된 계정이에요',
            `이 ${label} 계정은 다른 계정에 이어져 있어요. 그 계정으로 들어가면 거기서 쓰던 댓글과 카드를 그대로 볼 수 있어요.`,
            [
              { text: '취소', style: 'cancel' },
              { text: '그 계정으로 로그인', onPress: () => void switchTo(provider) },
            ],
          )
          return
        }
        Alert.alert('연결하지 못했습니다', e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(null)
      }
    },
    [link, switchTo],
  )

  const unlinkNow = useCallback(
    async (provider: SocialProvider) => {
      setBusy(provider)
      try {
        await unlink(provider)
      } catch (e) {
        Alert.alert('연결을 끊지 못했습니다', e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(null)
      }
    },
    [unlink],
  )

  /**
   * 끊기는 한 번 더 묻는다.
   *
   * 줄 전체가 눌리는 자리라 스치듯 눌릴 수 있는데, 끊기면 그 소셜로는 더 들어올 수
   * 없다. 되돌리려면 동의 화면을 다시 거쳐야 하니 누르기 전에 확인한다.
   *
   * 무엇이 **안 사라지는지**를 같이 적는다. "연결을 끊는다" 는 말은 계정이나 써 둔
   * 글까지 지워지는 것으로 읽히기 쉽다.
   */
  const confirmUnlink = useCallback(
    (provider: SocialProvider) => {
      const label = PROVIDER_LABEL[provider]
      Alert.alert(
        `${label} 연결을 끊을까요?`,
        `다음부터 ${label}(으)로는 로그인할 수 없어요. 계정과 지금까지 쓴 댓글·카드는 그대로 남습니다.`,
        [
          { text: '취소', style: 'cancel' },
          { text: '끊기', style: 'destructive', onPress: () => void unlinkNow(provider) },
        ],
      )
    },
    [unlinkNow],
  )

  const toggle = useCallback(
    (provider: SocialProvider, on: boolean) => {
      if (busy) return
      if (on) confirmUnlink(provider)
      else void linkNow(provider)
    },
    [busy, confirmUnlink, linkNow],
  )

  // 애플은 iOS 에서만 다룰 수 있다. 안드로이드에서는 목록에서 뺀다
  const shown = PROVIDER_ORDER.filter(p => p !== 'apple' || appleReady)

  if (loading) {
    return (
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <Skeleton width={120} height={16} radius={4} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {shown.map((provider, i) => {
        const on = linked.includes(provider)
        return (
          <PressableScale
            key={provider}
            scaleTo={0.99}
            onPress={() => toggle(provider, on)}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={`${PROVIDER_LABEL[provider]} ${on ? '연결 끊기' : '연결하기'}`}
            style={[
              styles.row,
              i > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text style={[fonts.body, { color: theme.textPrimary }]}>{PROVIDER_LABEL[provider]}</Text>
            <Action on={on} busy={busy === provider} />
          </PressableScale>
        )
      })}
    </View>
  )
}

/** 오른쪽에 붙는 상태 글자. 진행 중에는 돌아가는 표시로 바뀐다 */
function Action({ on, busy }: { on: boolean; busy: boolean }) {
  const theme = useTheme()
  if (busy) return <ActivityIndicator size="small" color={theme.accent} />
  if (on) return <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>연결됨 · 끊기</Text>
  return <Text style={[fonts.bodySmall, { color: theme.accent }]}>연결하기</Text>
}

const styles = StyleSheet.create({
  group: { borderRadius: cornerRadius['150'], borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['200'],
  },
})

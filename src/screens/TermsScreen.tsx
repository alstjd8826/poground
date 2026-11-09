import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { PrimaryButton } from '@/components/foundation/PrimaryButton'
import { PressableScale } from '@/components/foundation/PressableScale'
import { TERMS, TERMS_EFFECTIVE } from '@/content/terms'

/** supabase 의 오류는 Error 가 아닌 { message } 객체로 온다. String() 으로 바꾸면 '[object Object]' 가 된다 */
function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return String(e)
}

export interface TermsScreenProps {
  /** 관문으로 띄울 때. 있으면 아래에 동의 단추를 둔다. 없으면 읽기만 (마이 → 이용약관) */
  onAgree?: () => Promise<void>
  /** 동의하지 않고 나가는 길. 관문이 앱을 덮으므로 빠져나갈 곳이 있어야 한다 */
  onDecline?: () => void
}

/**
 * 이용약관 (2026-09-30). 관문과 마이의 읽기 화면이 같이 쓴다.
 *
 * 관문으로 뜰 때는 헤더가 없어 노치를 직접 피한다.
 */
export function TermsScreen({ onAgree, onDecline }: TermsScreenProps) {
  const theme = useTheme()
  // 들어간 화면에는 탭바가 없다. 하단 바·홈 인디케이터 뒤에 끝이 깔리지 않게 (useBottomSafeGap)
  const bottomGap = useBottomSafeGap()
  const insets = useSafeAreaInsets()
  const [busy, setBusy] = useState(false)
  /** 만 14세 이상 확인. 체크해야 동의 단추가 살아난다 */
  const [adult, setAdult] = useState(false)
  const gate = onAgree !== undefined

  const agree = useCallback(async () => {
    if (!onAgree || busy || !adult) return
    setBusy(true)
    try {
      await onAgree()
    } catch (e) {
      Alert.alert('동의를 저장하지 못했습니다', messageOf(e))
    } finally {
      setBusy(false)
    }
  }, [adult, busy, onAgree])

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, gate && { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, !gate && { paddingBottom: spacing['200'] + bottomGap }]}
      >
        {gate && (
          <>
            <Text style={[fonts.title1, { color: theme.textPrimary }]}>이용약관</Text>
            <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>
              글과 댓글을 쓰기 전에 읽고 동의해 주세요.
            </Text>
          </>
        )}
        <Text style={[fonts.caption, { color: theme.textMuted }]}>{`시행일 ${TERMS_EFFECTIVE}`}</Text>
        {TERMS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[fonts.label, { color: theme.textPrimary }]}>{section.title}</Text>
            {section.body.map(line => (
              <Text key={line} style={[fonts.bodySmall, { color: theme.textSecondary }]}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>

      {gate && (
        <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['200'] }]}>
          {/*
            만 14세 미만은 법정대리인 동의가 필요해(개인정보보호법) 글·댓글은 만 14세 이상만 받는다.
            읽는 것은 로그인 없이 누구나 된다 (2026-11-09, Flash 와 같은 방식)
          */}
          <PressableScale
            scaleTo={0.98}
            onPress={() => setAdult(v => !v)}
            accessibilityRole="checkbox"
            accessibilityLabel="[필수] 만 14세 이상입니다"
            accessibilityState={{ checked: adult }}
            style={styles.check}
          >
            <View
              style={[
                styles.box,
                { borderColor: adult ? theme.main : theme.border },
                adult && { backgroundColor: theme.main },
              ]}
            >
              {adult && (
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={theme.textOnMain} strokeWidth={3} fill="none" />
                </Svg>
              )}
            </View>
            <Text style={[fonts.bodySmall, { color: theme.textPrimary }]}>[필수] 만 14세 이상입니다</Text>
          </PressableScale>
          <PrimaryButton
            label="동의하고 계속하기"
            onPress={() => void agree()}
            busy={busy}
            disabled={!adult}
          />
          {onDecline && (
            <PressableScale
              scaleTo={0.98}
              onPress={onDecline}
              accessibilityRole="button"
              accessibilityLabel="동의하지 않고 로그아웃"
              style={styles.escape}
            >
              <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>동의하지 않고 로그아웃</Text>
            </PressableScale>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing['200'], gap: spacing['200'] },
  section: { gap: spacing['075'] },
  foot: { paddingHorizontal: spacing['200'], paddingTop: spacing['100'] },
  escape: { alignItems: 'center', paddingVertical: spacing['200'] },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing['100'], paddingVertical: spacing['150'] },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

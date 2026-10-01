import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { canStartManually } from '@/models/liveActivityPlan'
import { useNotificationPrefs } from '@/notifications/prefs'
import type { Match } from '@/models/kleague'
import { liveActivitySupported, startKickoff } from './kickoff'

/**
 * 경기 상세의 [잠금 화면에 띄우기] (2026-09-30). 직관을 안 가도 중계를 보려는 사람을 위해, 킥오프 24시간 안의
 * 예정 경기를 직접 띄운다. 직접 띄운 것은 직관 체크와 상관없이 킥오프 3시간 뒤까지 둔다.
 * iOS 에서만, 설정에서 카운트다운을 켜 두었을 때만 보인다 — 꺼 두면 앱을 열 때 곧바로 내려간다.
 */
export function KickoffCountdownButton({ match }: { match: Match }) {
  const theme = useTheme()
  const { prefs } = useNotificationPrefs()
  const [busy, setBusy] = useState(false)

  const start = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await startKickoff(match, true)
    } catch (e) {
      Alert.alert('잠금 화면에 띄우지 못했습니다', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [busy, match])

  if (!liveActivitySupported() || !prefs.liveActivity || !canStartManually(match, Date.now())) return null
  return (
    <PressableScale
      scaleTo={0.97}
      onPress={() => void start()}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="잠금 화면에 띄우기"
      style={styles.button}
    >
      <Text style={[fonts.bodySmall, { color: theme.textPrimary }]}>잠금 화면에 띄우기</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  button: { paddingVertical: spacing['050'] },
})

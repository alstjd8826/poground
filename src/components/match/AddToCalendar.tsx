import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'
import { createEventInCalendarAsync } from 'expo-calendar/legacy'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { calendarEventOf } from '@/models/calendarEvent'
import type { Match } from '@/models/kleague'

/**
 * 예정 경기를 폰 캘린더에 넣는 작은 단추 (2026-09-30).
 *
 * 앱이 캘린더를 직접 쓰지 않는다. 운영체제의 "일정 추가" 화면을 내용을 채워 열고, 저장은 사용자가 한다 — 그래서
 * 캘린더 권한을 묻지 않는다(expo-calendar 문서). 새 API(addEventWithForm)는 쓰기 권한을 요구해서 legacy 의
 * createEventInCalendarAsync 를 쓴다. 끝난 경기에는 두지 않는다.
 */
export function AddToCalendar({ match }: { match: Match }) {
  const theme = useTheme()
  const [busy, setBusy] = useState(false)

  const add = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await createEventInCalendarAsync(calendarEventOf(match))
    } catch (e) {
      Alert.alert('캘린더를 열지 못했습니다', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [busy, match])

  if (match.status !== 'scheduled') return null
  return (
    <PressableScale
      scaleTo={0.97}
      onPress={() => void add()}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="캘린더에 추가"
      style={styles.button}
    >
      <Text style={[fonts.bodySmall, { color: theme.textPrimary }]}>캘린더에 추가</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  button: { paddingVertical: spacing['050'] },
})

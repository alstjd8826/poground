import { useCallback, useEffect, useState } from 'react'
import { AppState, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import * as Linking from 'expo-linking'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { PressableScale } from '@/components/foundation/PressableScale'
import { useNotificationPrefs } from '@/notifications/prefs'
import { ensurePermission, permissionGranted } from '@/notifications/scheduler'
import { resyncNotifications } from '@/notifications/useNotificationSync'
import { liveActivitySupported } from '@/liveActivity/kickoff'
import type { NotificationPrefs } from '@/models/notificationPlan'

/**
 * 알림 설정 (2026-09-30). 기기가 스스로 울리는 알림 두 가지를 따로 켜고 끈다.
 *
 * 허락은 켤 때 묻는다. 이미 거절해 다시 물을 수 없으면 설정 앱으로 가는 길을 둔다 — 스위치만 켜져 있고 알림이
 * 안 오면 왜 안 오는지 알 길이 없다.
 */
export function NotificationSettingsScreen() {
  const theme = useTheme()
  const bottomGap = useBottomSafeGap()
  const { prefs, setPrefs } = useNotificationPrefs()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  // 설정 앱에서 허락을 켜고 돌아오면 안내를 걷는다
  useEffect(() => {
    const check = () => void permissionGranted().then(setAllowed)
    check()
    const sub = AppState.addEventListener('change', s => s === 'active' && check())
    return () => sub.remove()
  }, [])

  const change = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      const turningOn = Object.values(patch).some(Boolean)
      await setPrefs(patch)
      if (!turningOn) return
      const ok = await ensurePermission()
      setAllowed(ok)
      if (ok) resyncNotifications()
    },
    [setPrefs],
  )

  // 카운트다운은 알림 허락과 상관없다. 알림 둘 중 하나가 켜져 있을 때만 허락 안내를 띄운다
  const anyOn = prefs.attended || prefs.allKickoffs
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing['200'] + bottomGap }]}
    >
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row
          title="직관 경기 알림"
          detail="직관 가요를 체크한 경기에 전날 저녁 8시와 킥오프 1시간 전"
          value={prefs.attended}
          onChange={v => void change({ attended: v })}
        />
        <View style={[styles.divider, { backgroundColor: theme.divider }]} />
        <Row
          title="모든 경기 킥오프 알림"
          detail="포항의 모든 경기에 킥오프 1시간 전"
          value={prefs.allKickoffs}
          onChange={v => void change({ allKickoffs: v })}
        />
      </View>

      {/* 잠금 화면 카운트다운은 iOS 에만 있다. 알림이 아니라 허락을 묻지 않는다 */}
      {liveActivitySupported() && (
        <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row
            title="잠금 화면 카운트다운"
            detail="직관 경기 당일, 앱을 열면 잠금 화면과 다이내믹 아일랜드에 킥오프까지 남은 시간"
            value={prefs.liveActivity}
            onChange={v => void setPrefs({ liveActivity: v })}
          />
        </View>
      )}

      {anyOn && allowed === false && (
        <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[fonts.bodySmall, { color: theme.textSecondary }]}>
            알림이 꺼져 있어 울리지 않습니다. 설정에서 포그라운드 알림을 켜 주세요.
          </Text>
          <PressableScale
            scaleTo={0.97}
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="설정 열기"
          >
            <Text style={[fonts.label, { color: theme.accent }]}>설정 열기</Text>
          </PressableScale>
        </View>
      )}

      <Text style={[fonts.caption, styles.note, { color: theme.textMuted }]}>
        알림은 이 기기가 스스로 울립니다. 경기 시간이 바뀌면 앱을 열 때 맞춰 다시 잡습니다.
      </Text>
    </ScrollView>
  )
}

function Row({
  title,
  detail,
  value,
  onChange,
}: {
  title: string
  detail: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[fonts.body, { color: theme.textPrimary }]}>{title}</Text>
        <Text style={[fonts.caption, { color: theme.textMuted }]}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ true: theme.accent, false: theme.border }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['200'] },
  group: { borderRadius: cornerRadius['150'], borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['150'],
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
  },
  rowText: { flex: 1, gap: spacing['025'] },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing['200'] },
  notice: {
    gap: spacing['100'],
    padding: spacing['200'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: { paddingHorizontal: spacing['050'] },
})

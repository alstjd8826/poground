import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { useAttendances } from '@/hooks/attendance/useAttendances'
import { attendanceKeyOf, sameKey } from '@/models/attendance'
import { type Match, outcomeOf } from '@/models/kleague'
import { useNotificationPrefs } from '@/notifications/prefs'
import { ensurePermission } from '@/notifications/scheduler'
import { resyncNotifications } from '@/notifications/useNotificationSync'

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export interface AttendanceBlockProps {
  match: Match
  onRequireLogin?: () => void
  /**
   * 체크 칸 위에 설 것. 경기 상세는 예매할 수 있으면 [티켓 예매] 를 넘긴다 — 예매는 할 일이고
   * 직관 표시는 표시라 모양부터 다르게 둔다 (2026-09-29)
   */
  beside?: ReactNode
  /** [직관 글 쓰기]. 그 경기로 커뮤니티 글쓰기를 연다 — 태그는 글쓰기 화면이 채운다 */
  onWritePost?: (match: Match) => void
  /** 직관 인증 카드. 끝난 경기를 직관 표시했을 때만 보인다 */
  onShareProof?: (match: Match) => void
  /** 체크 줄 오른쪽에 더 둘 것. 예정 경기의 [캘린더에 추가] 가 여기 선다 */
  extra?: ReactNode
}

/**
 * 경기 상세의 직관 표시. 끝난 경기든 예정 경기든 체크 칸 한 줄이다 — 강조 단추와 큰 상자는 한 번
 * 누르는 표시에 비해 자리를 너무 먹었다 (2026-09-29).
 *
 * 스스로 표시한다 — 내 기록이라 거짓을 막을 이유가 없고, 랭킹이 없으니 속일 이유도 없다.
 * 끝나지 않은 경기에도 미리 표시할 수 있다. 끝나면 승률에 저절로 들어간다.
 *
 * 사진은 여기서 올리지 않고 커뮤니티 글로 남긴다. [직관 글 쓰기] 가 그 경기의 #직관·경기
 * 태그를 채운 글쓰기를 연다 (2026-09-29). 옛 직관 사진은 0장이라 옮기지 않고 걷어냈다(0027).
 */
export function AttendanceBlock({
  match,
  onRequireLogin,
  beside,
  onWritePost,
  onShareProof,
  extra,
}: AttendanceBlockProps) {
  const theme = useTheme()
  const { rows, signedIn, toggle } = useAttendances()
  const { prefs: notificationPrefs } = useNotificationPrefs()
  const key = attendanceKeyOf(match)
  const row = rows.find(r => sameKey(r, key))
  /**
   * 표시·취소가 끝날 때까지 모든 단추를 잠근다. 끝나기 전에 또 누르면 표시와 취소가 함께
   * 날아가 서버가 거꾸로 처리할 수 있다.
   */
  const [toggling, setToggling] = useState(false)
  const locked = toggling

  // 화면을 떠난 뒤 늦게 끝난 일이 알림을 띄우거나 상태를 건드리지 않게 한다
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  // 누르는 즉시 잠근다. 상태 갱신은 다음 렌더에야 보이므로 같은 틱의 두 번째 누름은 ref 로 막는다
  const togglingRef = useRef(false)
  const onToggle = useCallback(async () => {
    if (!signedIn) {
      onRequireLogin?.()
      return
    }
    if (togglingRef.current) return
    togglingRef.current = true
    setToggling(true)
    const wasOn = rows.some(r => sameKey(r, key))
    try {
      await toggle(match)
      // 직관 가요를 처음 체크하는 순간이 알림이 쓸모 있어지는 때다. 앱을 켜자마자 묻지 않고 여기서 묻는다
      if (!wasOn && match.status === 'scheduled' && notificationPrefs.attended) {
        void ensurePermission().then(ok => ok && resyncNotifications())
      }
    } catch (e) {
      if (alive.current) Alert.alert('저장하지 못했습니다', messageOf(e))
    } finally {
      togglingRef.current = false
      if (alive.current) setToggling(false)
    }
  }, [key, match, notificationPrefs.attended, onRequireLogin, rows, signedIn, toggle])

  // 표시를 풀 때 물을 것이 없다. 사진은 글로 옮겨 갔고, 글은 풀어도 남는다(4단계)
  const cancel = useCallback(() => void onToggle(), [onToggle])

  const on = row !== undefined
  // 아직 안 한 경기는 갈 거라는 표시, 시작한 경기는 다녀왔다는 표시다
  const label = match.status === 'scheduled' ? '이 경기 직관 가요' : '이 경기 직관했어요'
  return (
    <View style={[styles.gutter, styles.stack]}>
      {beside}
      <View style={styles.checkRow}>
        <PressableScale
          scaleTo={0.97}
          onPress={on ? cancel : () => void onToggle()}
          disabled={locked}
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={{ checked: on, busy: locked }}
          style={styles.check}
        >
          {locked ? <ActivityIndicator /> : <CheckBox on={on} />}
          <Text style={[fonts.bodySmall, { color: theme.textPrimary }]}>{label}</Text>
        </PressableScale>
        <View style={styles.spacer} />
        {extra}
        {/* 표시한 뒤에만. 안 간 경기의 직관 글은 없다 */}
        {/* 결과가 난 경기만. 아직 안 한 경기를 인증할 수는 없다 */}
        {on && onShareProof && outcomeOf(match) !== null ? (
          <Action label="인증 카드" onPress={() => onShareProof(match)} disabled={locked} />
        ) : null}
        {on && onWritePost ? (
          <Action label="직관 글 쓰기" onPress={() => onWritePost(match)} disabled={locked} />
        ) : null}
      </View>
    </View>
  )
}

function Action({
  label,
  onPress,
  disabled,
  muted,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  muted?: boolean
}) {
  const theme = useTheme()
  return (
    <PressableScale onPress={disabled ? undefined : onPress} accessibilityRole="button">
      <Text
        style={[
          fonts.bodySmall,
          { color: muted ? theme.textMuted : theme.textPrimary, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  gutter: { marginHorizontal: spacing['200'] },
  spacer: { flex: 1 },
  stack: { gap: spacing['150'] },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['200'] },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing['100'], paddingVertical: spacing['050'] },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

/**
 * 체크 칸. 표시는 글자(✓)가 아니라 직접 그린다 — K리그 서체에 그 글자가 없으면 iOS 가 다른 서체로
 * 바꿔 그려 모양이 튄다(⋮ 때와 같은 이유).
 */
function CheckBox({ on }: { on: boolean }) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.box,
        {
          borderColor: on ? theme.accent : theme.textMuted,
          backgroundColor: on ? theme.accent : 'transparent',
        },
      ]}
    >
      {on && (
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path
            d="M3 7.5 L6 10.5 L11 4"
            stroke={theme.textOnMain}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </View>
  )
}

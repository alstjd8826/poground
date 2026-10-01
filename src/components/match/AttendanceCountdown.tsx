import { StyleSheet, Text, View } from 'react-native'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useAttendances } from '@/hooks/attendance/useAttendances'
import { attendanceCountdown, attendanceKeyOf, sameKey } from '@/models/attendance'
import type { Match } from '@/models/kleague'

/**
 * 직관 예정으로 표시해 둔 경기의 D-day. 홈의 다음 경기 카드 오른쪽 위에 붙인다.
 *
 * 직관 예정은 표시만 하면 경기 전에는 달라지는 것이 없었다 (2026-09-29). 누른 만큼 눈에 보이는
 * 것이 생기게 한다. 끝난 경기에는 띄우지 않는다 — 그때는 직관한 경기다.
 *
 * 카드 아래 한 줄은 어수선해서 모서리에 걸친 테이프로 바꿨다 (2026-09-30). 카드 밖으로 삐져나오므로 카드
 * (overflow hidden) 안이 아니라 카드를 감싼 자리에 형제로 둔다.
 */
export function AttendanceCountdown({ match, now }: { match: Match; now?: number }) {
  const theme = useTheme()
  const { rows } = useAttendances()
  const key = attendanceKeyOf(match)
  if (match.status === 'finished' || !rows.some(r => sameKey(r, key))) return null
  const text = attendanceCountdown(match.kickoffAtMs, now)
  return (
    <View
      style={[styles.tape, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
      pointerEvents="none"
      accessible
      accessibilityLabel={`직관 가요 ${text}`}
    >
      <Text style={[fonts.label, styles.text, { color: theme.textPrimary }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tape: {
    position: 'absolute',
    top: -spacing['100'],
    right: spacing['150'],
    paddingHorizontal: spacing['100'],
    paddingVertical: spacing['025'],
    // 붙인 테이프처럼 살짝 비스듬하고, 끝이 반쯤 비친다
    transform: [{ rotate: '6deg' }],
    opacity: 0.94,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  text: { fontWeight: '700', letterSpacing: 0.5 },
})

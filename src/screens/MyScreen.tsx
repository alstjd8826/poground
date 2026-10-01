import { useCallback } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme, useThemeControl } from '@/hooks/theme/ThemeProvider'
import { useTabScrollTop } from '@/hooks/useTabScrollTop'
import { PressableScale } from '@/components/foundation/PressableScale'
import { themeChoiceLabel } from '@/screens/ThemeScreen'
import { useFanCards } from '@/hooks/fanCard/useFanCards'
import { useAuth } from '@/hooks/auth/useAuth'
import { useProfile } from '@/hooks/auth/useProfile'
import { useIsAdmin } from '@/hooks/comment/useIsAdmin'
import { useAttendances } from '@/hooks/attendance/useAttendances'
import { useMatches } from '@/hooks/query/useKleague'
import { attendanceSummary } from '@/models/attendance'

export interface MyScreenProps {
  onOpenTheme?: () => void
  onOpenCardMaker?: () => void
  onOpenAccount?: () => void
  onOpenLogin?: () => void
  onOpenReports?: () => void
  onOpenAttendance?: () => void
  /** 이용약관. 로그인 전에도 읽을 수 있다 */
  onOpenTerms?: () => void
  /** 알림 설정. 기기가 울리는 경기 알림 */
  onOpenNotifications?: () => void
  /** 개인정보 처리방침. 로그인 전에도 읽을 수 있다 */
  onOpenPrivacy?: () => void
}

/**
 * 마이 탭.
 *
 * 애플 설정 앱처럼 줄 목록이다. 줄을 누르면 그 설정만 다루는 화면으로 들어간다.
 * 값을 줄 오른쪽에 미리 보여 주므로 들어가 보지 않아도 지금 무엇으로 돼 있는지 읽힌다.
 */
/** 계정 줄 오른쪽에 적을 값. 아직 모르는 동안에는 비워 둔다 */
function accountLabel(ready: boolean, signedIn: boolean, nickname?: string) {
  if (!ready) return undefined
  if (!signedIn) return '로그인 안 됨'
  return nickname || '로그인됨'
}

export function MyScreen({
  onOpenTheme,
  onOpenCardMaker,
  onOpenAccount,
  onOpenLogin,
  onOpenReports,
  onOpenAttendance,
  onOpenTerms,
  onOpenPrivacy,
  onOpenNotifications,
}: MyScreenProps) {
  // 하단 탭을 다시 누르면 맨 위로
  const scrollRef = useTabScrollTop<ScrollView>()
  const theme = useTheme()
  const { preference } = useThemeControl()
  const { cards } = useFanCards()
  const { session, ready } = useAuth()
  const { profile } = useProfile(session)
  const isAdmin = useIsAdmin()

  /**
   * 로그인 전에는 로그인 화면으로 보낸다.
   *
   * 여기서 바로 카카오 로그인을 부르지 않는 이유는 규격 때문이다. 카카오 로그인
   * 디자인 가이드는 버튼의 색·심볼·문구를 정해 두는데, 설정 줄 모양으로는 그것을
   * 담을 수 없다. 규격대로 된 버튼은 로그인 화면에만 둔다.
   */
  const onAccount = useCallback(() => {
    if (session) onOpenAccount?.()
    else onOpenLogin?.()
  }, [onOpenAccount, onOpenLogin, session])

  // 아직 모르는 동안에는 아무 말도 하지 않는다. "로그인 안 됨" 이 잠깐 스쳤다 바뀌면
  // 로그아웃된 것처럼 보인다
  const accountValue = accountLabel(ready, session !== null, profile?.nickname)

  const { rows: attendances } = useAttendances()
  const { data: seasonMatches } = useMatches()
  const attendanceValue = attendanceSummary(attendances, seasonMatches ?? [])

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row label={session ? '내 계정' : '로그인'} value={accountValue} onPress={onAccount} />
      </View>

      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row
          label="나만의 카드 만들기"
          value={cards.length > 0 ? `${cards.length}장` : undefined}
          onPress={onOpenCardMaker}
        />
        <Row label="직관 기록" value={attendanceValue} onPress={onOpenAttendance} />
      </View>

      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row label="테마" value={themeChoiceLabel(preference)} onPress={onOpenTheme} />
        <Row label="알림" onPress={onOpenNotifications} />
      </View>

      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row label="이용약관" onPress={onOpenTerms} />
        <Row label="개인정보 처리방침" onPress={onOpenPrivacy} />
      </View>

      {/* 관리자에게만 보인다. 서버도 막지만, 눌러 봐야 빈 목록인 줄을 띄울 이유가 없다 */}
      {isAdmin && (
        <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Row label="신고함" onPress={onOpenReports} />
        </View>
      )}

      {/*
        비공식임을 앱 안에서도 밝힌다.
        상표는 상업·비상업보다 **출처를 헷갈리게 하는가** 를 본다. 공식 앱처럼 보이면
        무료여도 문제가 되고, 비공식임이 또렷하면 그만큼 다툼거리가 줄어든다. 앱스토어
        설명에만 적어 두면 앱을 받은 뒤에는 볼 길이 없으므로 여기에도 둔다.

        자료 출처도 밝힌다. 연맹에 데이터 이용 허락을 청하면서 앱 안에 출처를 표시하겠다고
        약속했다(2026-09-28). 허락 조건에 따라 문구나 자리가 바뀔 수 있다.
      */}
      <Text style={[fonts.caption, styles.note, { color: theme.textMuted }]}>
        팬이 만든 비공식 앱입니다. 포항 스틸러스 구단·한국프로축구연맹과 관련이 없습니다.
        {'\n'}
        자료 제공: 한국프로축구연맹 (kleague.com)
      </Text>
    </ScrollView>
  )
}

function Row({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  const theme = useTheme()
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, 현재 ${value}` : label}
      style={styles.row}
    >
      <Text style={[fonts.body, { color: theme.textPrimary }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>{value}</Text> : null}
        {/* 애플 설정의 꺾쇠. 이 줄이 더 들어가는 줄이라는 표시다 */}
        <Text style={[fonts.body, { color: theme.textDisabled }]}>›</Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['200'] },
  group: {
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['200'],
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing['100'] },
  note: { textAlign: 'center', lineHeight: 18 },
})

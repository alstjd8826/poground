import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { InlineState } from '@/components/feedback/States'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Avatar } from '@/components/profile/Avatar'
import { useBlockedUsers } from '@/hooks/comment/useBlockedUsers'

/**
 * 차단한 사용자. 내 계정에서 들어온다 (2026-09-29).
 *
 * 전에는 가려진 댓글의 ⋮ 에서만 풀 수 있었다. 게시글로 차단하면 그 사람 글이 피드에서 다 빠져, 풀 길을 찾을
 * 수 없었다. 차단은 나에게만 보이는 일이라 여기 목록도 나만 본다.
 */
export function BlockedUsersScreen() {
  const theme = useTheme()
  // 들어간 화면에는 탭바가 없다. 하단 바·홈 인디케이터 뒤에 끝이 깔리지 않게 (useBottomSafeGap)
  const bottomGap = useBottomSafeGap()
  const { people, isPending, unblock } = useBlockedUsers()

  if (isPending) return <InlineState message="불러오는 중입니다" />
  if (people.length === 0) return <InlineState message="차단한 사용자가 없습니다" />

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing['200'] + bottomGap }]}
    >
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {people.map(p => {
          const name = p.handle ? `@${p.handle}` : '포항 팬'
          return (
            <View key={p.id} style={styles.row}>
              <Avatar url={p.avatarUrl} size={32} />
              <Text style={[fonts.body, styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                {name}
              </Text>
              <PressableScale
                scaleTo={0.96}
                onPress={() => unblock.mutate(p.id)}
                disabled={unblock.isPending}
                accessibilityRole="button"
                accessibilityLabel={`${name} 차단 풀기`}
              >
                <Text style={[fonts.label, { color: theme.accent }]}>차단 풀기</Text>
              </PressableScale>
            </View>
          )
        })}
      </View>
      <Text style={[fonts.caption, styles.note, { color: theme.textMuted }]}>
        차단을 풀면 그 사람의 글과 댓글이 다시 보입니다. 상대는 차단했다는 사실을 알 수 없습니다.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['150'] },
  group: {
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing['150'],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'], paddingVertical: spacing['150'] },
  name: { flex: 1 },
  note: { paddingHorizontal: spacing['050'] },
})

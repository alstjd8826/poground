import { useMemo } from 'react'
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { InlineState } from '@/components/feedback/States'
import { AttendanceTile } from '@/components/community/AttendanceTile'
import { PressableScale } from '@/components/foundation/PressableScale'
import { useAttendances } from '@/hooks/attendance/useAttendances'
import { useMyAttendancePosts } from '@/hooks/community/useCommunity'
import { useMatches } from '@/hooks/query/useKleague'
import {
  attendanceEntries,
  attendanceStats,
  attendanceTimeline,
  ratePercent,
  type TimelineItem,
} from '@/models/attendance'
import type { Post } from '@/models/community'
import type { Match } from '@/models/kleague'

/** 격자. 인스타그램 프로필처럼 칸 사이는 얇게 */
const COLUMNS = 3
const GAP = 2
const PAD = spacing['200']

export interface AttendanceScreenProps {
  /** 글 칸을 누르면 그 글로. 좋아요·수정은 상세에서 한다 */
  onOpenPost?: (post: Post) => void
  /** 글 없이 체크만 한 경기 칸(+). 그 경기 태그가 채워진 글쓰기를 연다 */
  onWritePost?: (match: Match) => void
  /** 승리요정 카드 공유. 끝난 직관 경기가 있을 때만 단추가 보인다 */
  onShareFairy?: () => void
}

/**
 * 직관 기록.
 *
 * 위에 승리요정 승률, 아래는 내 직관 글을 3열 격자로 모아 본다 (4단계, 2026-09-29 — 인스타그램 프로필처럼).
 * 체크한 경기와 내 #직관 글을 한 줄로 섞는다 — 글이 붙은 경기는 글 칸으로, 글 없이 체크만 한 경기는 + 칸
 * 으로. 나만 보기 글도 똑같이 보이고 자물쇠만 붙는다 — 커뮤니티 피드에 없는 나만 보기 글을 다시 찾아 들어갈
 * 곳이 여기다. 좋아요·수정은 글 상세에서 한다.
 *
 * 승률은 저장하지 않고 경기 목록에서 매번 센다 — 결과가 정정되거나 예정 경기가 끝나면 저절로 따라간다.
 */
export function AttendanceScreen({ onOpenPost, onWritePost, onShareFairy }: AttendanceScreenProps) {
  const theme = useTheme()
  // 들어간 화면에는 탭바가 없다. 하단 바·홈 인디케이터 뒤에 끝이 깔리지 않게 (useBottomSafeGap)
  const bottomGap = useBottomSafeGap()
  const { rows, signedIn } = useAttendances()
  const { data: matches } = useMatches()
  const { posts, query: postsQuery } = useMyAttendancePosts()
  // 3열 격자. 칸 폭은 화면 폭에서 좌우 여백과 칸 사이를 뺀 셋째 (2026-09-29)
  const { width } = useWindowDimensions()
  const tile = Math.floor((width - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS)
  const entries = useMemo(() => attendanceEntries(rows, matches ?? []), [rows, matches])
  const stats = useMemo(() => attendanceStats(entries), [entries])
  // 끝난 직관 경기가 있어야 카드가 생긴다 (fairyCardData 와 같은 기준)
  const canShare = stats.wins + stats.draws + stats.losses > 0
  const items = useMemo(() => attendanceTimeline(entries, posts, matches ?? []), [entries, posts, matches])

  if (!signedIn) return <InlineState message="로그인하면 직관 기록을 남길 수 있습니다" />
  // 내 직관 글은 따로 받는다. 받는 중이거나 실패했는데 "글을 써 보세요" 라고 하면 틀린 말이 된다
  if (items.length === 0 && postsQuery.isPending) return <InlineState message="불러오는 중입니다" />
  if (items.length === 0 && postsQuery.isError) {
    return (
      <InlineState
        tone="error"
        message="직관 글을 불러오지 못했습니다"
        onRetry={() => void postsQuery.refetch()}
      />
    )
  }
  if (items.length === 0) {
    return <InlineState message="경기 상세에서 '이 경기 직관했어요' 를 체크하거나 #직관 글을 써 보세요" />
  }

  const rate = ratePercent(stats.rate)
  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: PAD + bottomGap }]}
      columnWrapperStyle={styles.gridRow}
      numColumns={COLUMNS}
      data={items}
      keyExtractor={keyOf}
      ListHeaderComponent={
        <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {rate && <Text style={[fonts.display, { color: theme.accent }]}>{`승리요정 ${rate}`}</Text>}
          {/* 체크한 경기가 없으면 '직관 0경기' 대신 글 수만 적고 체크를 권한다 (2026-09-29) */}
          {entries.length > 0 && (
            <Text style={[fonts.body, { color: theme.textPrimary }]}>
              {`직관 ${stats.total}경기 · ${stats.wins}승 ${stats.draws}무 ${stats.losses}패`}
            </Text>
          )}
          {posts.length > 0 && (
            <Text style={[fonts.body, { color: theme.textPrimary }]}>{`직관 글 ${posts.length}개`}</Text>
          )}
          {stats.upcoming > 0 && (
            <Text style={[fonts.caption, { color: theme.textMuted }]}>{`예정 ${stats.upcoming}경기`}</Text>
          )}
          {canShare && onShareFairy && (
            <PressableScale
              scaleTo={0.97}
              onPress={onShareFairy}
              accessibilityRole="button"
              accessibilityLabel="승리요정 카드 공유"
              style={[styles.share, { borderColor: theme.accent }]}
            >
              <Text style={[fonts.label, { color: theme.accent }]}>승리요정 카드 공유</Text>
            </PressableScale>
          )}
          {entries.length === 0 && (
            <Text style={[fonts.caption, { color: theme.textMuted }]}>
              경기 상세에서 직관을 체크하면 승률이 쌓여요
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <AttendanceTile item={item} size={tile} onOpenPost={onOpenPost} onWritePost={onWritePost} />
      )}
    />
  )
}

function keyOf(item: TimelineItem): string {
  return item.kind === 'post' ? `post-${item.post.id}` : `match-${item.entry.match.id}`
}

const styles = StyleSheet.create({
  content: { padding: PAD, gap: GAP },
  gridRow: { gap: GAP },
  summary: {
    alignItems: 'center',
    gap: spacing['075'],
    padding: spacing['250'],
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing['050'],
  },
  share: {
    marginTop: spacing['050'],
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['075'],
    borderRadius: cornerRadius['200'],
    borderWidth: 1,
  },
})

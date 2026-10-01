import { useCallback, useMemo, useState } from 'react'
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native'

import { spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { InlineState } from '@/components/feedback/States'
import { PostCard } from '@/components/community/PostCard'
import { useCommunityFeed, usePostLike } from '@/hooks/community/useCommunity'
import { usePostMenu } from '@/components/community/usePostMenu'
import { useMatches } from '@/hooks/query/useKleague'
import { matchLookup } from '@/models/attendance'
import type { FeedFilter, Post } from '@/models/community'
import type { Match } from '@/models/kleague'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'attendance', label: '직관' },
  { key: 'free', label: '자유' },
]

export interface CommunityScreenProps {
  onOpenPost?: (post: Post) => void
  onOpenMatch?: (match: Match) => void
  onEditPost?: (post: Post) => void
  /** 좋아요를 누르려는데 로그인 전이다 */
  onRequireLogin?: () => void
}

/**
 * 커뮤니티 피드. 공개 글만, 최신순, 20개씩 이어 받는다.
 *
 * 직관 글의 경기는 이미 받는 포항 경기 목록에서 찾는다 — 따로 묻지 않는다.
 */
export function CommunityScreen({
  onOpenPost,
  onOpenMatch,
  onEditPost,
  onRequireLogin,
}: CommunityScreenProps) {
  const theme = useTheme()
  const { toggle, signedIn } = usePostLike()
  // PostCard 는 memo 다. 렌더마다 새 함수를 넘기면 피드의 모든 카드가 다시 그려진다
  const toggleLike = useCallback(
    (post: Post) => {
      if (!signedIn) {
        onRequireLogin?.()
        return
      }
      toggle(post).catch(e =>
        Alert.alert('좋아요를 남기지 못했습니다', e instanceof Error ? e.message : String(e)),
      )
    },
    [onRequireLogin, signedIn, toggle],
  )
  const { menuFor, sheet } = usePostMenu({ onEdit: onEditPost, onRequireLogin })
  const [filter, setFilter] = useState<FeedFilter>('all')
  const { posts, query } = useCommunityFeed(filter)
  const { data: matches } = useMatches()
  const matchOf = useMemo(() => matchLookup(matches ?? []), [matches])

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <CategoryTabs tabs={FILTERS} value={filter} onChange={key => setFilter(key as FeedFilter)} />
      {query.isError ? (
        <InlineState tone="error" message="불러오지 못했습니다" onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={post => post.id}
          contentContainerStyle={styles.content}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              match={matchOf(item.match)}
              onOpen={onOpenPost}
              onOpenMatch={onOpenMatch}
              menu={menuFor(item)}
              onToggleLike={toggleLike}
            />
          )}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
          }
          ListEmptyComponent={
            query.isPending ? null : <InlineState message="아직 글이 없습니다. 첫 글을 남겨 보세요" />
          }
        />
      )}
      {sheet}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing['200'], gap: spacing['150'] },
  // 탭바 위 여백은 탭 화면을 감싼 TabRoot 가 이미 줬다. 여기서 탭바 높이를 또 더하지 않는다
})

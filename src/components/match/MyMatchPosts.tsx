import { useCallback, useMemo } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { spacing } from '@/styles'
import { PostCard } from '@/components/community/PostCard'
import { usePostMenu } from '@/components/community/usePostMenu'
import { useMyAttendancePosts, usePostLike } from '@/hooks/community/useCommunity'
import { attendanceKeyOf, sameKey } from '@/models/attendance'
import type { Post } from '@/models/community'
import type { Match } from '@/models/kleague'

/**
 * 경기 상세에 그 경기의 내 직관 글 (4단계, 2026-09-29). 나만 보기 글도 자물쇠와 함께 보인다.
 * 경기는 글의 경기 키(경기 태그로 찾은 것)로 가른다. 글이 없으면 아무것도 그리지 않는다.
 */
export function MyMatchPosts({
  match,
  onOpenPost,
  onEditPost,
  onRequireLogin,
}: {
  match: Match
  onOpenPost?: (post: Post) => void
  onEditPost?: (post: Post) => void
  onRequireLogin?: () => void
}) {
  const { posts } = useMyAttendancePosts()
  const like = usePostLike()
  const { menuFor, sheet } = usePostMenu({ onEdit: onEditPost, onRequireLogin })
  const key = attendanceKeyOf(match)
  const mine = useMemo(() => posts.filter(p => p.match !== null && sameKey(p.match, key)), [key, posts])

  const toggleLike = useCallback(
    (post: Post) => {
      if (!like.signedIn) {
        onRequireLogin?.()
        return
      }
      like
        .toggle(post)
        .catch(e => Alert.alert('좋아요를 남기지 못했습니다', e instanceof Error ? e.message : String(e)))
    },
    [like, onRequireLogin],
  )

  if (mine.length === 0) return null
  return (
    <View style={styles.stack}>
      {mine.map(post => (
        <PostCard
          key={post.id}
          post={post}
          match={match}
          onOpen={onOpenPost}
          menu={menuFor(post)}
          onToggleLike={toggleLike}
        />
      ))}
      {sheet}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: spacing['150'], paddingHorizontal: spacing['200'] },
})

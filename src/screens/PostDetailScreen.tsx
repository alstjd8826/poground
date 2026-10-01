import { useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { InlineState } from '@/components/feedback/States'
import { LockIcon } from '@/components/community/LockIcon'
import { PostPhotoPager } from '@/components/community/PostPhotoPager'
import { CommentList } from '@/components/comment/CommentList'
import { CommentComposer } from '@/components/comment/CommentComposer'
import { usePost, usePostLike } from '@/hooks/community/useCommunity'
import { useAuth } from '@/hooks/auth/useAuth'
import { LikeButton } from '@/components/community/LikeButton'
import { PostMenu } from '@/components/community/PostMenu'
import { usePostMenu } from '@/components/community/usePostMenu'
import { authorNameOf, type Post } from '@/models/community'
import type { Comment, CommentSubject } from '@/repositories/comment/remote'
import { relativeTime } from '@/utils/relativeTime'
import { MentionText } from '@/components/foundation/MentionText'

export interface PostDetailScreenProps {
  postId: string
  onRequireLogin?: () => void
  onEdit?: (post: Post) => void
  /** 내 글을 지웠다. 보던 자리로 돌아간다 */
  onDeleted?: () => void
}

/**
 * 글 상세. 사진을 옆으로 넘기고, 본문 전체와 댓글.
 *
 * 볼 수 없는 글(나만 보기로 바뀌었거나 지워짐)은 RLS 가 가려 null 로 온다.
 */
export function PostDetailScreen({ postId, onRequireLogin, onEdit, onDeleted }: PostDetailScreenProps) {
  const theme = useTheme()
  const like = usePostLike()
  const { session } = useAuth()
  const me = session?.user.id ?? null
  // 지우기·차단·관리자 삭제로 글이 사라지면 보던 자리로 돌아간다
  const { menuFor, sheet } = usePostMenu({ onEdit, onRequireLogin, onGone: () => onDeleted?.() })
  const { post, blocked, query } = usePost(postId)
  const subject = useMemo<CommentSubject>(() => ({ type: 'post', id: postId }), [postId])
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  // 입력 바가 제 높이를 알린다. 그만큼 아래를 비워야 댓글 끝이 바에 가리지 않는다
  const [dock, setDock] = useState(0)

  if (query.isPending) return <InlineState message="글을 불러오는 중입니다" />
  if (query.isError) return <InlineState message="불러오지 못했습니다" onRetry={() => void query.refetch()} />
  if (!post) return <InlineState message="볼 수 없는 글입니다" />
  if (blocked) return <InlineState message="차단한 사용자의 글입니다" />

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: dock + spacing['400'] }]}>
        {post.photos.length > 0 && <PostPhotoPager post={post} indicator="dots" />}
        <View style={styles.meta}>
          <Text style={[fonts.label, { color: theme.textPrimary }]}>{authorNameOf(post)}</Text>
          <Text style={[fonts.caption, { color: theme.textMuted }]}>{relativeTime(post.createdAt)}</Text>
          {post.visibility === 'private' && (
            <>
              <LockIcon color={theme.textMuted} />
              <Text style={[fonts.caption, { color: theme.textMuted }]}>나만 보기</Text>
            </>
          )}
          <View style={styles.menuSlot}>
            <PostMenu post={post} {...menuFor(post)} />
          </View>
        </View>
        <MentionText style={[fonts.body, styles.gutter, { color: theme.textPrimary }]}>
          {post.body}
        </MentionText>
        <View style={styles.gutter}>
          <LikeButton
            liked={post.likedByMe}
            count={post.likeCount}
            onPress={() => {
              if (!like.signedIn) {
                onRequireLogin?.()
                return
              }
              like
                .toggle(post)
                .catch(e =>
                  Alert.alert('좋아요를 남기지 못했습니다', e instanceof Error ? e.message : String(e)),
                )
            }}
          />
        </View>
        <View style={styles.gutter}>
          <CommentList subject={subject} onReply={setReplyTo} onRequireLogin={onRequireLogin} />
        </View>
      </ScrollView>
      {/* 공개 글과 내 나만 보기 글에 쓴다. 내 나만 보기 글은 나만 보는 메모가 된다 (2026-09-29) */}
      {(post.visibility === 'public' || post.authorId === me) && (
        <CommentComposer
          subject={subject}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onRequireLogin={onRequireLogin}
          onHeight={setDock}
        />
      )}
      {sheet}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spacing['150'] },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['100'],
    paddingHorizontal: spacing['200'],
  },
  gutter: { paddingHorizontal: spacing['200'] },
  menuSlot: { marginLeft: 'auto' },
})

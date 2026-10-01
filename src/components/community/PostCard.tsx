import { memo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Avatar } from '@/components/profile/Avatar'
import { LockIcon } from '@/components/community/LockIcon'
import { PostMenu, type PostMenuProps } from '@/components/community/PostMenu'
import { PostPhotoPager } from '@/components/community/PostPhotoPager'
import { LikeButton } from '@/components/community/LikeButton'
import { authorNameOf, type Post } from '@/models/community'
import { type Match, opponentOf, outcomeOf, ourTeam } from '@/models/kleague'
import { relativeTime } from '@/utils/relativeTime'
import { MentionText } from '@/components/foundation/MentionText'

const OUTCOME = { win: '승', draw: '무', loss: '패' } as const

export interface PostCardProps {
  post: Post
  /** 직관 글이면 그 경기. 목록에서 찾아 넘긴다 */
  match?: Match
  onOpen?: (post: Post) => void
  onOpenMatch?: (match: Match) => void
  /** ⋮ 에 걸 일. 내 글은 수정·삭제, 남의 글은 신고·차단 — 항목은 PostMenu 가 정한다 */
  menu?: Omit<PostMenuProps, 'post'>
  /** 하트. 로그인 여부는 부르는 쪽이 본다 */
  onToggleLike?: (post: Post) => void
}

/**
 * 게시글 카드. 커뮤니티 피드와 직관 기록이 같이 쓴다.
 *
 * 사진은 1:1 로 채워 옆으로 넘긴다(2026-09-29). 사진이 없으면 직관 글이든 자유 글이든 본문만 둔다 —
 * 직관 글은 본문 위 경기 줄로 경기를 알린다(큰 스코어 카드는 뺐다, 2026-09-29). 나만 보기 글은 자물쇠만 붙이고 나머지는 똑같다.
 */
export const PostCard = memo(function PostCard({
  post,
  match,
  onOpen,
  onOpenMatch,
  menu,
  onToggleLike,
}: PostCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const name = authorNameOf(post)

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.head}>
        <Avatar url={post.avatarUrl} size={32} />
        <View style={styles.who}>
          <Text style={[fonts.label, { color: theme.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[fonts.caption, { color: theme.textMuted }]}>{relativeTime(post.createdAt)}</Text>
        </View>
        {post.visibility === 'private' && <LockIcon color={theme.textMuted} />}
        {menu && <PostMenu post={post} {...menu} />}
      </View>

      {/* 사진은 누르기 틀 밖에 둔다. 안에 두면 옆으로 넘기는 손짓과 누르기가 서로 가로챈다 */}
      {post.photos.length > 0 && (
        <PostPhotoPager
          post={post}
          indicator="count"
          onPressPhoto={onOpen ? () => onOpen(post) : undefined}
        />
      )}
      <PressableScale onPress={onOpen ? () => onOpen(post) : undefined} scaleTo={0.99}>
        <View style={styles.body}>
          {match && (
            <PressableScale onPress={onOpenMatch ? () => onOpenMatch(match) : undefined}>
              <Text style={[fonts.caption, { color: theme.accent }]}>{matchLine(match)}</Text>
            </PressableScale>
          )}
          <View>
            <MentionText
              style={[fonts.body, { color: theme.textPrimary }]}
              numberOfLines={expanded ? undefined : BODY_LINES}
            >
              {post.body}
            </MentionText>
            {/*
              더 보기는 그려진 줄 수로 정한다. 줄바꿈으로 세면 줄바꿈 없이 긴 문단은 잘리고도 더 보기가
              없었다. 잘린 글의 onTextLayout 은 잘린 줄 수만 알려 주므로, 줄 제한 없는 사본을 뒤에 숨겨 잰다
            */}
            {!expanded && (
              <MentionText
                testID="post-body-measure"
                style={[fonts.body, styles.measure]}
                onTextLayout={e => setOverflows(e.nativeEvent.lines.length > BODY_LINES)}
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {post.body}
              </MentionText>
            )}
          </View>
          {!expanded && overflows && (
            <PressableScale onPress={() => setExpanded(true)}>
              <Text style={[fonts.caption, { color: theme.textMuted }]}>더 보기</Text>
            </PressableScale>
          )}
        </View>
      </PressableScale>

      <View style={styles.foot}>
        <LikeButton
          liked={post.likedByMe}
          count={post.likeCount}
          onPress={onToggleLike ? () => onToggleLike(post) : undefined}
        />
        <Text
          style={[fonts.caption, { color: theme.textMuted }]}
          accessibilityLabel={`댓글 ${post.commentCount}`}
        >
          {`댓글 ${post.commentCount}`}
        </Text>
      </View>
    </View>
  )
})

/** 경기 한 줄. 카드와 글쓰기의 경기 고르기가 같이 쓴다 */
export function matchLine(match: Match): string {
  const d = new Date(match.kickoffAtMs)
  const theirs = opponentOf(match)
  const outcome = outcomeOf(match)
  const score = outcome ? ` ${ourTeam(match).goal}:${theirs.goal} ${OUTCOME[outcome]}` : ''
  return `${d.getMonth() + 1}/${d.getDate()} vs ${theirs.name}${score}`
}

/** 피드 카드에서 본문을 몇 줄까지 보이는지 */
const BODY_LINES = 3

const styles = StyleSheet.create({
  card: { borderRadius: cornerRadius['200'], borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing['100'], padding: spacing['150'] },
  who: { flex: 1 },
  body: { gap: spacing['075'], padding: spacing['150'] },
  /** 잴 때만 쓰는 사본. 같은 폭에 겹쳐 두고 보이지 않게 한다 */
  measure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0, pointerEvents: 'none' },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['200'],
    paddingHorizontal: spacing['150'],
    paddingBottom: spacing['150'],
  },
})

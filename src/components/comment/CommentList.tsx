import React, { useCallback, useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { relativeTime } from '@/utils/relativeTime'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Avatar } from '@/components/profile/Avatar'
import { InlineState } from '@/components/feedback/States'
import { Skeleton } from '@/components/foundation/Skeleton'
import { DropdownMenu, type MenuAnchor, type MenuItem } from '@/components/foundation/DropdownMenu'
import { ReportSheet } from '@/components/comment/ReportSheet'
import { nameOf } from '@/components/comment/name'
import type { Comment, CommentSubject } from '@/repositories/comment/remote'
import { type CommentThread, useCommentLike, useComments } from '@/hooks/comment/useComments'
import { LikeButton } from '@/components/community/LikeButton'
import { MentionText } from '@/components/foundation/MentionText'

/**
 * 한 번에 보여 주는 댓글 수.
 *
 * 전부 그리면 댓글이 쌓일수록 페이지가 통째로 무거워진다. 이 목록은 경기 상세의 페이지
 * 스크롤 안에 있어서 가상화가 되지 않는다 — 그린 만큼 그대로 메모리에 남는다.
 *
 * 스크롤 안에 스크롤을 넣지 않고 "더 보기" 로 끊는 이유가 그것이다. 두 스크롤이 겹치면
 * 어느 쪽이 손가락을 가져갈지가 매번 달라진다.
 *
 * "더 보기" 는 이제 **서버에서 다음 쪽을 받아 온다.** 전부 받아 놓고 잘라 보여 주던
 * 시절에는 댓글이 쌓일수록 첫 화면이 무거워졌다.
 */
export interface CommentListProps {
  /** 어디에 달린 댓글인지. 경기와 선수가 같은 표를 쓴다 */
  subject: CommentSubject
  /** 답글 대상을 바깥(쓰는 자리)에 알린다 */
  onReply: (comment: Comment) => void
  /** 로그인이 필요할 때. 신고와 차단은 누가 했는지가 남아야 해서 로그인이 있어야 한다 */
  onRequireLogin?: () => void
}

/**
 * 경기 댓글.
 *
 * 읽는 것은 로그인이 없어도 된다 — 서버 정책도 그렇게 열려 있다. 쓰려고 할 때만
 * 로그인을 청한다. 팬카드 저장과 같은 규칙이다.
 *
 * 답글은 한 단까지만 받는다. 답글에 또 답글을 받으면 화면에서 들여쓰기가 끝없이
 * 깊어지고, 좁은 폭에서 글자가 세로로 눕는다.
 */
export function CommentList({ subject, onReply, onRequireLogin }: CommentListProps) {
  const theme = useTheme()
  const { threads, rest, blockedIds, comments, me, isAdmin, remove, report, block, unblock } =
    useComments(subject)
  const like = useCommentLike(subject)
  // 좋아요는 누가 눌렀는지 남아야 해서 로그인이 있어야 한다
  const onLike = useCallback(
    (c: Comment) => {
      if (!like.signedIn) {
        onRequireLogin?.()
        return
      }
      like
        .toggle(c)
        .catch(e => Alert.alert('좋아요를 남기지 못했습니다', e instanceof Error ? e.message : String(e)))
    },
    [like, onRequireLogin],
  )

  /**
   * 어느 댓글의 차림표가 열려 있는지.
   *
   * 차림표는 한 번에 하나다. 누른 단추의 화면 위 자리를 같이 들고 있어야 그 옆에 붙여
   * 띄울 수 있다.
   */
  const [menu, setMenu] = useState<{ comment: Comment; anchor: MenuAnchor } | null>(null)
  const openMenu = useCallback((comment: Comment, anchor: MenuAnchor) => setMenu({ comment, anchor }), [])

  /** 신고할 글. 사유를 고르는 동안 들고 있는다 — 차림표는 그전에 닫힌다 */
  const [reporting, setReporting] = useState<Comment | null>(null)

  /*
    보내고 나서 알린다.

    전에는 mutate 를 쏘자마자 "신고했습니다" 를 띄웠다. 서버가 거절해도 화면은 잘 된
    것처럼 말하고, 신고함에는 아무것도 안 뜬다 — 무엇이 잘못됐는지 알 길이 없었다.
  */
  const sendReport = useCallback(
    async (reason: string) => {
      if (!reporting) return
      setReporting(null)
      try {
        await report.mutateAsync({ id: reporting.id, reason })
        Alert.alert('신고했습니다', '확인 후 조치하겠습니다.')
      } catch (e) {
        Alert.alert('신고하지 못했습니다', e instanceof Error ? e.message : String(e))
      }
    },
    [report, reporting],
  )

  /**
   * 남의 글에 할 수 있는 일.
   *
   * 앱스토어 심사 지침 1.2 가 사용자 글을 싣는 앱에 신고와 차단을 요구한다.
   *
   * 지우기는 내 글이거나 내가 관리자일 때만 띄운다. 서버가 막아 주기는 하지만, 누를 수
   * 없는 것을 띄워 놓고 누른 뒤에 안 된다고 말하는 것은 차림표가 할 일이 아니다.
   */
  const items = useMemo<MenuItem[]>(() => {
    const c = menu?.comment
    // 탈퇴한 사람의 댓글은 이미 지워진 자리다. 신고·차단할 사람이 없다
    if (!c || c.authorId === null) return []
    const author = c.authorId
    const mine = author === me
    const hidden = blockedIds.has(author)

    // 남의 글에만 두는 것들. 이미 가려 둔 글에는 다시 보는 길만 둔다 — 신고는 안 보이는
    // 글에 할 일이 아니다
    const forOthers = () => {
      if (mine) return []
      if (hidden) return [{ label: '차단 풀기', onPress: () => unblock.mutate(author) }]
      /*
        로그인하지 않았으면 로그인부터 청한다.

        신고는 **누가 했는지가 남아야** 한다(같은 글을 한 사람이 여러 번 신고해도 한
        건으로 세고, 장난 신고를 가려내려면 그렇다). 차단은 애초에 "나한테만 안 보이게"
        라 내가 누구인지 모르면 어디에도 적을 수 없다. 표 둘 다 auth.uid() 로 주인을
        가리므로, 로그인 없이 누르면 서버까지 갔다가 거절당한다 — 그전에 묻는다.
      */
      if (!me) {
        return [
          { label: '신고', onPress: () => onRequireLogin?.() },
          { label: '이 사용자 차단', onPress: () => onRequireLogin?.() },
        ]
      }
      return [
        // 사유를 묻고 나서 보낸다. 사유 없이 오면 무엇이 문제인지 글을 처음부터 읽어야 한다
        { label: '신고', onPress: () => setReporting(c) },
        { label: '이 사용자 차단', onPress: () => block.mutate(author) },
      ]
    }

    const list: MenuItem[] = [...forOthers()]
    // 지우기는 내 글이거나 관리자일 때만. 서버도 막지만, 누를 수 없는 것을 띄워 놓고
    // 누른 뒤에 안 된다고 말하는 것은 차림표가 할 일이 아니다
    if (mine || isAdmin) {
      list.push({ label: '삭제', destructive: true, onPress: () => remove.mutate(c.id) })
    }
    return list
  }, [block, blockedIds, isAdmin, me, menu, onRequireLogin, remove, unblock])

  if (comments.isPending) {
    return (
      <View style={styles.stack}>
        <Skeleton width="100%" height={56} radius={cornerRadius['150']} />
        <Skeleton width="100%" height={56} radius={cornerRadius['150']} />
      </View>
    )
  }
  if (comments.isError) {
    return <InlineState tone="error" message="불러오지 못했습니다" onRetry={() => comments.refetch()} />
  }

  return (
    <View style={styles.stack}>
      {threads.length === 0 ? (
        <InlineState message="아직 댓글이 없습니다" />
      ) : (
        threads.map(t => (
          <Thread
            key={t.root.id}
            thread={t}
            me={me}
            blockedIds={blockedIds}
            onReply={onReply}
            onMenu={openMenu}
            onLike={onLike}
          />
        ))
      )}

      {rest > 0 && (
        <PressableScale
          scaleTo={0.99}
          onPress={() => comments.fetchNextPage()}
          disabled={comments.isFetchingNextPage}
          accessibilityRole="button"
          style={[styles.more, { borderColor: theme.border }]}
        >
          <Text style={[fonts.label, { color: theme.textSecondary }]}>
            {comments.isFetchingNextPage ? '불러오는 중' : `댓글 ${rest}개 더 보기`}
          </Text>
        </PressableScale>
      )}

      <DropdownMenu anchor={menu?.anchor ?? null} items={items} onClose={() => setMenu(null)} />

      <ReportSheet
        open={reporting !== null}
        onClose={() => setReporting(null)}
        onSubmit={reason => void sendReport(reason)}
      />
    </View>
  )
}

function Thread({
  thread,
  me,
  blockedIds,
  onReply,
  onMenu,
  onLike,
}: {
  thread: CommentThread
  me: string | null
  blockedIds: Set<string>
  onReply: (c: Comment) => void
  onMenu: (c: Comment, anchor: MenuAnchor) => void
  onLike: (c: Comment) => void
}) {
  return (
    <View style={styles.thread}>
      <Row
        comment={thread.root}
        me={me}
        blocked={isBlocked(blockedIds, thread.root)}
        onReply={onReply}
        onMenu={onMenu}
        onLike={onLike}
      />
      {thread.replies.map(r => (
        <View key={r.id} style={styles.reply}>
          {/* 답글에는 답글 단추를 두지 않는다. 한 단까지만 받는다 */}
          <Row comment={r} me={me} blocked={isBlocked(blockedIds, r)} onMenu={onMenu} onLike={onLike} />
        </View>
      ))}
    </View>
  )
}

/**
 * 댓글 자리에 적히는 것.
 *
 * 갈래가 셋이다 — 차단해서 덮은 것, 지워진 것, 그냥 글. 부르는 쪽에 늘어놓으면 조건이
 * 겹쳐 무엇이 무엇에 딸린 것인지 안 읽혀서 조각으로 뗀다.
 */
/** 탈퇴한 사람(글쓴이 없음)은 차단 목록에 있을 수 없다 */
const isBlocked = (blockedIds: Set<string>, c: Comment) => c.authorId !== null && blockedIds.has(c.authorId)

function Body({ comment, blocked }: { comment: Comment; blocked: boolean }) {
  const theme = useTheme()

  // 내가 차단한 사람의 글. 왜 안 보이는지 알아야 빈자리로 읽히지 않는다
  if (blocked) {
    return <Text style={[fonts.bodySmall, { color: theme.textDisabled }]}>차단한 사용자의 댓글입니다</Text>
  }
  // 관리자가 걷어낸 것과 글쓴이가 스스로 내린 것을 가려 적는다. 둘은 다른 일이다
  // 탈퇴한 사람의 댓글은 글쓴이 칸이 비어 온다 (0029)
  if (comment.deleted) {
    const said = comment.deletedByAdmin
      ? '관리자가 지운 댓글입니다'
      : comment.authorId === null
        ? '탈퇴한 사용자의 댓글입니다'
        : '지워진 댓글입니다'
    return <Text style={[fonts.bodySmall, { color: theme.textDisabled }]}>{said}</Text>
  }
  return <MentionText style={[fonts.bodySmall, { color: theme.textPrimary }]}>{comment.body}</MentionText>
}

function Row({
  comment,
  me,
  blocked,
  onReply,
  onMenu,
  onLike,
}: {
  comment: Comment
  me: string | null
  /** 내가 차단한 사람의 글. 내용은 덮고 자리만 남긴다 */
  blocked: boolean
  onReply?: (c: Comment) => void
  onMenu: (c: Comment, anchor: MenuAnchor) => void
  onLike: (c: Comment) => void
}) {
  const theme = useTheme()
  /*
    누른 자리를 재서 차림표를 그 옆에 붙인다.
    PressableScale 은 ref 를 넘겨받지 않으므로 잴 수 있는 뷰로 한 번 감싼다.
    collapsable 을 꺼야 안드로이드가 이 뷰를 지워 버리지 않는다.
  */
  const dots = React.useRef<View>(null)
  const openMenu = () =>
    dots.current?.measureInWindow((x, y, width, height) => onMenu(comment, { x, y, width, height }))

  return (
    <View style={styles.row}>
      {/* 차단한 사람은 사진도 덮는다. 글만 가리고 얼굴이 남으면 가린 보람이 없다 */}
      <Avatar url={blocked ? null : comment.avatarUrl} size={32} />
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[fonts.label, { color: theme.textSecondary }]} numberOfLines={1}>
            {blocked ? '차단한 사용자' : nameOf(comment)}
            {comment.authorId === me ? ' (나)' : ''}
          </Text>
          <Text style={[fonts.caption, { color: theme.textMuted }]}>{relativeTime(comment.createdAt)}</Text>

          {/* 이 댓글을 두고 할 수 있는 일. 오른쪽 끝에 붙여 어느 글의 것인지 또렷하게 */}
          {(!comment.deleted || blocked) && (
            <View ref={dots} collapsable={false} style={styles.dotsSlot}>
              <PressableScale
                scaleTo={0.9}
                onPress={openMenu}
                accessibilityLabel="더보기"
                style={styles.dots}
              >
                {/*
                  세로 점 셋을 글자(⋮, U+22EE)로 넣지 않고 직접 그린다.
                  K리그 서체 두 벌 모두 그 글자가 없어서, iOS 는 다른 서체로 대체해 그리고
                  안드로이드는 빈 네모가 뜬다. 점 셋은 그리는 편이 크기도 우리 손에 있다.
                */}
                {[0, 1, 2].map(i => (
                  <View key={i} style={[styles.dot, { backgroundColor: theme.textMuted }]} />
                ))}
              </PressableScale>
            </View>
          )}
        </View>

        <Body comment={comment} blocked={blocked} />

        {/* 지운 글과 차단한 사람의 글에는 누를 것이 없다. 답글에는 답글 단추를 두지 않는다(한 단까지) */}
        {!comment.deleted && !blocked && (
          <View style={styles.tools}>
            <LikeButton liked={comment.likedByMe} count={comment.likeCount} onPress={() => onLike(comment)} />
            {onReply && (
              <PressableScale scaleTo={0.94} onPress={() => onReply(comment)} accessibilityLabel="답글">
                <Text style={[fonts.caption, { color: theme.textMuted }]}>답글</Text>
              </PressableScale>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: spacing['250'] },
  thread: { gap: spacing['150'] },
  /** 답글은 한 단 들여 쓴다. 아바타 폭 + 사이 간격만큼이라 글이 부모 글과 나란히 선다 */
  reply: { paddingLeft: spacing['400'] },
  /** 댓글 한 줄. 아바타는 글 첫 줄에 맞춘다 — 가운데로 두면 긴 글에서 아래로 내려온다 */
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['150'] },
  body: { flex: 1, gap: spacing['050'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing['100'] },
  /** 이름·시각을 왼쪽으로 밀고 오른쪽 끝을 잡는다 */
  dotsSlot: { marginLeft: 'auto' },
  /** 점이 작아 누를 자리가 좁다. 눌리는 넓이를 따로 준다 */
  dots: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['100'],
  },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: spacing['200'], paddingTop: spacing['025'] },
  /** 끊어 보여 주는 목록의 끝. 남은 수를 적어 얼마나 더 있는지 알린다 */
  more: {
    alignItems: 'center',
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
})

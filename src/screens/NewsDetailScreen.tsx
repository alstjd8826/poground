import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { Skeleton } from '@/components/foundation/Skeleton'
import { ErrorState, SectionHeader } from '@/components/feedback/States'
import { useNewsDetail } from '@/hooks/query/useKleague'
import { PrimaryButton } from '@/components/foundation/PrimaryButton'
import { CommentList } from '@/components/comment/CommentList'
import { CommentComposer } from '@/components/comment/CommentComposer'
import type { Comment, CommentSubject } from '@/repositories/comment/remote'
import { newsUrlOf } from '@/models/kleague'

const CATEGORY_LABEL: Record<string, string> = {
  club: '구단',
  league: '리그',
  notice: '공지',
  fan: '팬',
  youth: '유스',
}

export interface NewsDetailScreenProps {
  seq: number
  /** 원문을 띄운다. 화면을 미는 일이라 라우트가 맡는다 */
  onOpenOriginal?: (url: string, title: string) => void
  /** 목록에서 이미 아는 값. 본문이 도착하기 전에도 제목을 보여줘 화면이 비지 않게 한다. */
  fallbackTitle?: string
  /** 댓글을 쓰려는데 로그인이 안 됐을 때 */
  onRequireLogin?: () => void
}

export function NewsDetailScreen({
  seq,
  fallbackTitle,
  onRequireLogin,
  onOpenOriginal,
}: NewsDetailScreenProps) {
  const theme = useTheme()
  const query = useNewsDetail(seq)

  /**
   * 댓글 쓰는 자리는 화면 아래 고정이라 스크롤 **밖**에 있고, 답글 단추는 목록 안에 있다.
   * 둘이 서로 남이므로 "누구에게 답글인지" 는 둘을 모두 품은 여기가 들고 있는다.
   */
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [dock, setDock] = useState(0)

  // 질의 열쇠가 되므로 렌더마다 새로 만들지 않는다. 새 객체면 목록을 매번 다시 받는다
  const subject = useMemo<CommentSubject>(() => ({ type: 'news', id: String(seq) }), [seq])

  const article = query.data
  const title = article?.title ?? fallbackTitle
  const onOpen = useCallback(
    () => onOpenOriginal?.(newsUrlOf(seq), title ?? '소식'),
    [onOpenOriginal, seq, title],
  )

  /*
    일찍 돌아가는 것은 **훅을 다 부른 뒤**에 한다.
    위에 두면 기사를 못 받아 온 렌더에서만 useCallback 이 빠져 훅 개수가 달라진다.
    React 는 부른 순서로 상태를 짝지으므로, 한 번 어긋나면 그 뒤가 통째로 밀린다.
  */
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} message={(query.error as Error)?.message} />
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        // 아래에 쓰는 바가 떠 있다. 그만큼 비워야 마지막 줄이 가리지 않는다
        contentContainerStyle={[styles.content, { paddingBottom: dock + spacing['200'] }]}
        showsVerticalScrollIndicator={false}
      >
        {title ? (
          <Text style={[fonts.title1, { color: theme.textPrimary }]}>{title}</Text>
        ) : (
          <View style={styles.titleSkeleton}>
            <Skeleton height={26} radius={6} />
            <Skeleton width="70%" height={26} radius={6} />
          </View>
        )}

        {article ? (
          <Text style={[fonts.caption, { color: theme.textMuted }]}>
            {[CATEGORY_LABEL[article.category ?? ''] ?? article.category, article.publishedOn]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : (
          <Skeleton width={140} height={12} radius={4} />
        )}

        <View style={[styles.divider, { backgroundColor: theme.divider }]} />

        {/*
          본문은 우리가 그리지 않는다.
          기사를 우리 서버에 담아 우리 화면에 띄우면 그건 인용이 아니라 복제·전송이다.
          제목과 분류까지만 두고 읽는 것은 원문에서 하게 한다 — 오래 버틴 비공식 팬앱들이
          전부 이 방식이고, 애플 심사 지침도 남의 콘텐츠를 앱에 실으려면 권한을 내놓으라고
          한다(5.2.2).
        */}
        <PrimaryButton label="원문 보기" onPress={onOpen} />

        {/*
        읽고 나서 할 말이 생긴다. 기사는 한 번에 읽는 글이라 탭으로 가르지 않고 본문
        아래에 잇는다 — 신문 앱들이 다 그렇게 한다.
      */}
        <View style={styles.comments}>
          <SectionHeader title="댓글" />
          <CommentList subject={subject} onReply={setReplyTo} onRequireLogin={onRequireLogin} />
        </View>
      </ScrollView>

      {/* 목록 길이와 무관하게 늘 같은 자리에 둔다 */}
      <CommentComposer
        subject={subject}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onRequireLogin={onRequireLogin}
        onHeight={setDock}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  comments: { gap: spacing['150'], marginTop: spacing['300'] },
  content: { padding: spacing['200'], gap: spacing['150'], paddingBottom: spacing['800'] },
  titleSkeleton: { gap: spacing['100'] },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing['100'] },
  body: { gap: spacing['200'] },
  image: { width: '100%', height: 200, borderRadius: cornerRadius['150'] },
})

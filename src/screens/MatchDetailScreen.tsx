import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { MatchCard, MatchCardSkeleton } from '@/components/match/MatchCard'
import { AttendanceBlock } from '@/components/match/AttendanceBlock'
import { AddToCalendar } from '@/components/match/AddToCalendar'
import { KickoffCountdownButton } from '@/liveActivity/KickoffCountdownButton'
import { MyMatchPosts } from '@/components/match/MyMatchPosts'
import type { Post } from '@/models/community'
import { VideoCard, VideoCardSkeleton } from '@/components/video/VideoCard'
import { InlineState } from '@/components/feedback/States'
import { QueryState } from '@/components/feedback/QueryState'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { LineupList, LineupListSkeleton } from '@/components/match/LineupList'
import { CommentList } from '@/components/comment/CommentList'
import { CommentComposer } from '@/components/comment/CommentComposer'
import { PrimaryButton } from '@/components/foundation/PrimaryButton'
import { useMatchLineup, useMatchVideos } from '@/hooks/query/useKleague'
import type { Comment, CommentSubject } from '@/repositories/comment/remote'
import {
  hasLineup,
  type MatchLineup,
  type Match,
  type MatchSide,
  sideOf,
  ticketUrlOf,
  type VideoClip,
} from '@/models/kleague'

/** 고른 쪽의 명단 */
function sideOfLineup(lineup: MatchLineup, side: MatchSide) {
  if (side === 'home') return lineup.home
  return lineup.away
}

type DetailTab = 'lineup' | 'videos' | 'comments' | 'info'

/**
 * 정보는 맨 끝에 둔다.
 *
 * 앞 셋의 차례는 이미 쓰던 그대로다 — 나중에 생긴 것을 사이에 끼우면 손에 익은 자리가
 * 통째로 밀린다. 관중·중계는 경기가 끝나야 채워지는 것이라 자주 볼 자리도 아니다.
 */
const TABS = [
  { key: 'lineup', label: '라인업' },
  { key: 'videos', label: '영상' },
  { key: 'comments', label: '댓글' },
  { key: 'info', label: '정보' },
]

export interface MatchDetailScreenProps {
  /** 캐시에서 찾은 경기. 아직 목록이 안 왔으면 없다 */
  match?: Match
  round: number | null
  onOpenVideo?: (video: VideoClip) => void
  /** 예매 페이지로. 앱을 떠나는 일이라 화면이 직접 열지 않고 라우트에 맡긴다 */
  onOpenTicket?: (match: Match) => void
  /** 직관 블록의 [직관 글 쓰기]. 그 경기 태그가 채워진 글쓰기를 연다 */
  onWritePost?: (match: Match) => void
  /** 직관 블록의 [인증 카드]. 끝난 경기를 직관 표시했을 때만 */
  onShareProof?: (match: Match) => void
  /** 그 경기의 내 직관 글을 열고 고친다 */
  onOpenPost?: (post: Post) => void
  onEditPost?: (post: Post) => void
  /** 댓글을 쓰려는데 로그인이 안 됐을 때 */
  onRequireLogin?: () => void
}

/**
 * 경기 상세.
 *
 * 맨 위를 MatchCard 그대로 쓴다. 목록에서 누른 카드와 **같은 컴포넌트·같은 크기**라야
 * 엠블럼이 이어질 때 주변까지 자연스럽게 읽힌다. 헤더를 따로 만들어 크기를 바꾸면
 * 엠블럼만 날아가고 나머지가 뚝 바뀌어 효과가 반감된다.
 *
 * 경기 카드를 누르면 예정이든 종료든 **여기로 온다.** 전에는 누르는 쪽에서 갈라 예정
 * 경기는 예매 페이지로 앱을 떠났는데, 같은 카드를 눌러도 어디로 갈지 알 수 없었다.
 * 예매는 아직 안 치른 경기에만 있으므로 여기서 그때만 단추를 띄운다.
 */
export function MatchDetailScreen({
  match,
  round,
  onOpenVideo,
  onOpenTicket,
  onWritePost,
  onShareProof,
  onOpenPost,
  onEditPost,
  onRequireLogin,
}: MatchDetailScreenProps) {
  const theme = useTheme()
  const videos = useMatchVideos(round ?? -1)
  const lineup = useMatchLineup(match)
  const onPress = useCallback((v: VideoClip) => onOpenVideo?.(v), [onOpenVideo])

  /**
   * 팬앱이므로 우리 팀 라인업을 먼저 보여준다.
   *
   * 경기가 캐시에 없는 첫 렌더에는 어느 쪽이 포항인지 모른다. 그래서 초기값을 박아 두지 않고
   * "고른 적 없으면 우리 팀" 으로 계산한다 — 경기가 도착하면 알아서 포항 쪽으로 맞춰진다.
   */
  const [picked, setPicked] = useState<MatchSide | null>(null)
  const side = picked ?? (match ? sideOf(match) : 'home')
  const sideTabs = useMemo(
    () => [
      { key: 'home', label: match?.home.name ?? '홈' },
      { key: 'away', label: match?.away.name ?? '원정' },
    ],
    [match],
  )

  /**
   * 라인업과 영상을 한 줄로 이으면 40명 명단을 지나야 영상이 나온다.
   * 둘은 같이 보는 것이 아니라 번갈아 보는 것이므로 탭으로 가른다.
   */
  const [tab, setTab] = useState<DetailTab>('lineup')

  /**
   * 댓글 쓰는 자리는 화면 아래에 고정이라 스크롤 **밖**에 있고, 답글 단추는 목록 안에
   * 있다. 둘이 서로 남이므로 "누구에게 답글인지" 는 둘을 모두 품은 여기가 들고 있는다.
   */
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [dock, setDock] = useState(0)
  const writing = tab === 'comments' && match != null

  // 질의 열쇠가 되므로 렌더마다 새로 만들지 않는다. 새 객체면 목록을 매번 다시 받는다
  const subject = useMemo<CommentSubject>(() => ({ type: 'match', id: String(match?.id ?? '') }), [match?.id])

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        // 댓글 탭에서는 아래에 쓰는 바가 떠 있다. 그만큼 비워야 마지막 줄이 가리지 않는다
        contentContainerStyle={[styles.content, writing && { paddingBottom: dock + spacing['200'] }]}
        showsVerticalScrollIndicator={false}
        /*
        댓글 바의 단추가 눌리려면 이게 있어야 한다.

        RN 의 터치 임자 정하기는 화면에 그려진 순서가 아니라 **리액트 트리**를 따라간다.
        댓글 입력 바는 Modal 이라 화면에서는 맨 앞에 뜨지만, 트리에서는 여전히 이 스크롤의
        자식이다. 기본값('never')이면 키보드가 올라와 있는 동안 스크롤이 첫 탭을 가로채
        키보드를 내리는 데 써 버린다 — 바의 "올리기" 는 눌리지도 못한다.

        'handled' 는 그 가로채기를 자식이 처리하지 않은 탭에만 쓴다.
      */
        keyboardShouldPersistTaps="handled"
      >
        {/* 카드만 화면 폭을 꽉 채운다. 목록에서 날아온 카드가 화면에 자리 잡는 느낌을 준다 */}
        {match ? <MatchCard match={match} shared flush /> : <MatchCardSkeleton flush />}

        {/*
          예매는 아직 안 치른 경기에만 뜬다. 끝난 경기에는 살 표가 없다.
          예매할 수 있으면 직관 예정은 그 옆 작은 토글로 선다 — 예매는 할 일이고 직관 예정은
          표시라, 강조 단추 둘을 위아래로 쌓으면 무엇을 먼저 할지 흐려진다 (2026-09-29).
          직관 기록은 수집 범위가 포항 경기뿐이라 모든 경기에 둔다. 경기가 바뀌면 새로 세운다 —
          앞 경기의 미리보기나 잠김이 넘어오지 않게
        */}
        {match && (
          <AttendanceBlock
            key={match.id}
            match={match}
            onRequireLogin={onRequireLogin}
            onWritePost={onWritePost}
            onShareProof={onShareProof}
            extra={
              <>
                <KickoffCountdownButton match={match} />
                <AddToCalendar match={match} />
              </>
            }
            beside={
              ticketUrlOf(match) ? (
                <PrimaryButton label="티켓 예매" onPress={() => onOpenTicket?.(match)} />
              ) : undefined
            }
          />
        )}

        {/* 그 경기에 쓴 내 직관 글. 나만 보기 글도 자물쇠와 함께 */}
        {match && (
          <MyMatchPosts
            match={match}
            onOpenPost={onOpenPost}
            onEditPost={onEditPost}
            onRequireLogin={onRequireLogin}
          />
        )}

        {/* 탭과 그 내용은 한 덩어리다. 사이에 content 의 넓은 간격이 끼면 서로 남처럼 보인다.
          CategoryTabs 가 좌우·위아래 여백을 스스로 갖고 있으므로 gutter 로 감싸지 않는다 */}
        <View style={styles.tabbed}>
          <CategoryTabs tabs={TABS} value={tab} onChange={key => setTab(key as DetailTab)} />

          <View style={[styles.gutter, styles.section, tab !== 'lineup' && styles.hidden]}>
            {/* 팀 선택은 경기에 딸린 것이지 라인업에 딸린 게 아니다. 받아오는 중에도 띄워 둬야
              데이터가 들어올 때 목록이 탭 줄 높이만큼 아래로 밀리지 않는다.
              이미 gutter 안이라 탭 줄의 좌우 여백은 끈다 — 안 그러면 두 번 들어간다 */}
            <CategoryTabs
              tabs={sideTabs}
              value={side}
              onChange={key => setPicked(key as MatchSide)}
              variant="subtle"
              flush
            />
            <QueryState
              query={lineup}
              skeleton={<LineupListSkeleton />}
              empty={data => !hasLineup(data)}
              emptyMessage="라인업이 아직 올라오지 않았습니다"
            >
              {data => <LineupList team={sideOfLineup(data, side)} />}
            </QueryState>
          </View>

          <View style={[styles.gutter, styles.section, tab !== 'videos' && styles.hidden]}>
            <QueryState
              query={videos}
              skeleton={
                <View style={styles.stack}>
                  <VideoCardSkeleton />
                </View>
              }
              empty={data => data.length === 0}
              emptyMessage="이 경기 영상이 아직 없습니다"
            >
              {data => (
                <View style={styles.stack}>
                  {data.map((v, i) => (
                    <VideoCard key={v.id} video={v} index={i} onPress={onPress} />
                  ))}
                </View>
              )}
            </QueryState>
          </View>
          {/*
          댓글은 경기마다 따로 쌓인다. 라인업·영상과 달리 사람들이 방금 쓴 것이라
          들어올 때마다 다시 읽는다 (useComments).
        */}
          <View style={[styles.gutter, styles.section, tab !== 'comments' && styles.hidden]}>
            {match ? (
              <CommentList subject={subject} onReply={setReplyTo} onRequireLogin={onRequireLogin} />
            ) : (
              <InlineState message="경기를 불러오는 중입니다" />
            )}
          </View>

          {/* 경기장은 카드가 이미 보여주므로 여기 또 적지 않는다 */}
          <View style={[styles.gutter, styles.section, styles.meta, tab !== 'info' && styles.hidden]}>
            <MatchMeta match={match} />
          </View>
        </View>
      </ScrollView>

      {/* 목록 길이와 무관하게 늘 같은 자리에 둔다. 댓글 탭을 볼 때만 뜬다 */}
      {writing && (
        <CommentComposer
          subject={subject}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onRequireLogin={onRequireLogin}
          onHeight={setDock}
        />
      )}
    </View>
  )
}

/**
 * 경기에 딸린 부가 정보.
 *
 * 관중은 경기가 끝나야 채워지고 중계는 편성이 나와야 붙는다. 둘 다 없는 동안과 경기가
 * 아직 안 온 동안을 갈라 말해 준다.
 */
function MatchMeta({ match }: { match?: Match }) {
  if (!match) return <InlineState message="경기를 불러오는 중입니다" />
  if (match.attendance == null && !match.broadcast) {
    return <InlineState message="아직 올라온 정보가 없습니다" />
  }
  return (
    <>
      {match.attendance != null && <MetaRow label="관중" value={`${match.attendance.toLocaleString()}명`} />}
      {match.broadcast && <MetaRow label="중계" value={match.broadcast.replace(/\/\//g, ' · ')} />}
    </>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme()
  return (
    <View style={styles.metaRow}>
      <Text style={[fonts.caption, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[fonts.bodySmall, { color: theme.textSecondary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 좌우 여백은 단락마다 준다. 카드가 화면 끝까지 닿아야 하므로 스크롤 컨테이너에는 두지 않는다
  content: { paddingVertical: spacing['200'], gap: spacing['100'], paddingBottom: spacing['800'] },
  gutter: { paddingHorizontal: spacing['200'] },
  meta: { gap: spacing['100'] },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // 탭 줄과 그 내용 사이에는 content 의 넓은 간격을 쓰지 않는다. 한 덩어리로 붙여 둔다
  tabbed: { gap: 0 },
  section: { gap: spacing['150'] },
  // 안 보이는 탭은 언마운트하지 않는다. 다시 눌렀을 때 스켈레톤이 한 번 더 번쩍이지 않게
  hidden: { display: 'none' },
  stack: { gap: spacing['150'] },
})

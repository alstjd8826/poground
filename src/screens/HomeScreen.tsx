import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { UseQueryResult } from '@tanstack/react-query'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useTabScrollTop } from '@/hooks/useTabScrollTop'
import { MatchCard, MatchCardSkeleton } from '@/components/match/MatchCard'
import { AttendanceCountdown } from '@/components/match/AttendanceCountdown'
import { NewsCard, NewsCardSkeleton } from '@/components/news/NewsCard'
import { VideoCard, VideoCardSkeleton } from '@/components/video/VideoCard'
import { FormPills, StandingRow } from '@/components/standings/StandingsTable'
import { Skeleton } from '@/components/foundation/Skeleton'
import { PressableScale } from '@/components/foundation/PressableScale'
import { InlineState, SectionHeader } from '@/components/feedback/States'
import { useHomeMatches, useNews, useStandings, useVideos } from '@/hooks/query/useKleague'
import { hasVideosFor, type Match, type NewsArticle, type VideoClip } from '@/models/kleague'

export interface HomeScreenProps {
  onOpenArticle?: (article: NewsArticle) => void
  onOpenVideo?: (video: VideoClip) => void
  /** 경기 카드 탭. 예정이면 예매, 끝났으면 그 경기 영상으로 간다 */
  onOpenMatch?: (match: Match) => void
  onSeeAll?: (tab: 'matches' | 'standings' | 'news' | 'videos') => void
}

/**
 * 섹션 하나를 그리는 규칙.
 *
 * 홈은 서로 다른 쿼리 다섯 개가 한 화면에 쌓여서, 섹션마다 분기를 손으로 쓰면
 * 어디는 문구가 뜨고 어디는 빈 카드가 남고 어디는 통째로 사라진다(실제로 그랬다).
 * 로딩 / 에러 / 빈 / 내용 네 갈래를 여기 한 곳에서만 판단한다.
 */
function Section<T>({
  query,
  skeleton,
  isEmpty,
  emptyMessage,
  onRetry,
  retrying,
  children,
}: {
  query: UseQueryResult<T>
  skeleton: React.ReactNode
  /** 데이터는 왔지만 보여줄 게 없는 경우 */
  isEmpty: (data: T) => boolean
  emptyMessage: string
  /**
   * 홈은 섹션이 다섯이라 각자 자기 쿼리만 다시 부르면 버튼을 다섯 번 눌러야 한다.
   * 어느 버튼을 눌러도 화면 전체를 갱신하도록 바깥에서 하나를 내려준다.
   */
  onRetry: () => void
  retrying: boolean
  children: (data: T) => React.ReactNode
}) {
  if (query.isPending) return <>{skeleton}</>
  if (query.isError) {
    return <InlineState tone="error" message="불러오지 못했습니다" onRetry={onRetry} busy={retrying} />
  }
  if (query.data === undefined || isEmpty(query.data)) return <InlineState message={emptyMessage} />
  return <>{children(query.data)}</>
}

export function HomeScreen({ onOpenArticle, onOpenVideo, onOpenMatch, onSeeAll }: HomeScreenProps) {
  // 하단 탭을 다시 누르면 맨 위로
  const scrollRef = useTabScrollTop<ScrollView>()
  const theme = useTheme()
  const matches = useHomeMatches()
  const standings = useStandings()
  const news = useNews(3)
  const videos = useVideos()
  const [reloading, setReloading] = useState(false)

  /**
   * 홈의 유일한 갱신 경로.
   * 당겨서 새로고침과 섹션의 "다시 시도" 가 같은 함수를 쓰므로, 어느 쪽을 눌러도 결과가 같다.
   * 네 쿼리를 한꺼번에 부르고, 끝날 때까지 모든 재시도 버튼이 진행 중 표시로 바뀐다.
   */
  const reloadAll = useCallback(async () => {
    if (reloading) return
    setReloading(true)
    try {
      await Promise.all([matches.refetch(), standings.refetch(), news.refetch(), videos.refetch()])
    } finally {
      setReloading(false)
    }
  }, [reloading, matches, standings, news, videos])

  const openVideo = useCallback((v: VideoClip) => onOpenVideo?.(v), [onOpenVideo])

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={reloading}
          onRefresh={reloadAll}
          tintColor={theme.accent}
          colors={[theme.accent]}
        />
      }
    >
      {/* ── 순위
           맨 위에 둔다. 다음 경기 카드는 누르면 예매 페이지로 앱을 떠나는 동작이라
           홈을 열자마자 눈에 닿는 자리에 두기엔 맞지 않는다 */}
      <View style={styles.section}>
        {/* 카드를 통째로 누르면 순위로 간다. 옆에 "전체 순위" 링크를 또 두면 같은 곳으로
            가는 길이 둘이 되고, 카드가 눌린다는 것도 오히려 가려진다 */}
        <SectionHeader title="우리 순위" />
        <Section
          query={standings}
          skeleton={
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Skeleton width={120} height={24} radius={6} />
              <Skeleton width="100%" height={18} radius={4} />
              <Skeleton width={140} height={20} radius={10} />
            </View>
          }
          isEmpty={data => !data.ours}
          emptyMessage="순위 정보가 아직 없습니다"
          onRetry={reloadAll}
          retrying={reloading}
        >
          {data => {
            const mine = data.ours!
            return (
              <PressableScale
                scaleTo={0.98}
                onPress={() => onSeeAll?.('standings')}
                accessibilityRole="button"
                // 누를 수 있다는 것이 모양으로는 안 보이므로 말로 알린다
                accessibilityLabel={`우리 순위 ${mine.rank}위. 전체 순위 보기`}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.rankHeadline}>
                  <Text style={[fonts.display, { color: theme.accent }]}>{mine.rank}</Text>
                  <View style={styles.rankMeta}>
                    <Text style={[fonts.title2, { color: theme.textPrimary }]}>위</Text>
                    <Text style={[fonts.bodySmall, { color: theme.textSecondary }]}>
                      승점 {mine.points} · {mine.win}승 {mine.draw}무 {mine.loss}패
                    </Text>
                  </View>
                </View>
                {mine.recentForm.length > 0 && <FormPills form={mine.recentForm} />}
                <View style={styles.miniTable}>
                  {data.around.map((s, i) => (
                    <StandingRow key={s.teamId} standing={s} index={i} />
                  ))}
                </View>
              </PressableScale>
            )
          }}
        </Section>
      </View>

      {/* 다음 경기와 최근 경기를 한 줄에 반반으로. 둘 다 같은 경기 카드라 나란히 두면
          "곧 있을 것" 과 "방금 끝난 것" 이 한눈에 비교된다 */}
      <View style={styles.matchRow}>
        {/* ── 다음 경기 */}
        <View style={[styles.section, styles.half]}>
          {/* 반반으로 좁아지면 "일정 전체" 링크가 옆 칸 제목과 붙는다. 경기 탭이 바로 밑에 있으니 뺀다 */}
          <SectionHeader title="다음 경기" />
          <Section
            query={matches}
            skeleton={<MatchCardSkeleton />}
            isEmpty={data => !data.next}
            emptyMessage="예정된 경기가 없습니다"
            onRetry={reloadAll}
            retrying={reloading}
          >
            {/* 좁은 칸에서 안내 문구가 두세 줄로 접힌다. 카드가 눌린다는 건 눌러 보면 안다 */}
            {data => (
              <View>
                <MatchCard match={data.next!} shared onPress={onOpenMatch} />
                {/* 직관 예정으로 표시해 둔 경기면 D-day 테이프. 카드 모서리에 걸쳐 카드 뒤가 아니라 위에 둔다 */}
                <AttendanceCountdown match={data.next!} />
              </View>
            )}
          </Section>
        </View>

        {/* ── 최근 경기 */}
        <View style={[styles.section, styles.half]}>
          <SectionHeader title="최근 경기" />
          <Section
            query={matches}
            skeleton={<MatchCardSkeleton />}
            isEmpty={data => !data.last}
            emptyMessage="아직 치른 경기가 없습니다"
            onRetry={reloadAll}
            retrying={reloading}
          >
            {data => (
              <MatchCard
                match={data.last!}
                shared
                onPress={hasVideosFor(data.last!) ? onOpenMatch : undefined}
              />
            )}
          </Section>
        </View>
      </View>

      {/* ── 소식 */}
      <View style={styles.section}>
        <SectionHeader title="소식" actionLabel="더 보기" onAction={() => onSeeAll?.('news')} />
        <Section
          query={news}
          skeleton={
            <View style={styles.stack}>
              {Array.from({ length: 3 }, (_, i) => (
                <NewsCardSkeleton key={i} />
              ))}
            </View>
          }
          isEmpty={data => data.length === 0}
          emptyMessage="등록된 소식이 없습니다"
          onRetry={reloadAll}
          retrying={reloading}
        >
          {data => (
            <View style={styles.stack}>
              {data.map((a, i) => (
                <NewsCard key={a.id} article={a} index={i} onPress={onOpenArticle} />
              ))}
            </View>
          )}
        </Section>
      </View>

      {/* ── 영상 */}
      <View style={styles.section}>
        <SectionHeader title="영상" actionLabel="더 보기" onAction={() => onSeeAll?.('videos')} />
        <Section
          query={videos}
          skeleton={<VideoCardSkeleton />}
          isEmpty={data => data.length === 0}
          emptyMessage="등록된 영상이 없습니다"
          onRetry={reloadAll}
          retrying={reloading}
        >
          {data => (
            <View style={styles.stack}>
              {data.slice(0, 2).map((v, i) => (
                <VideoCard key={v.id} video={v} index={i} onPress={openVideo} />
              ))}
            </View>
          )}
        </Section>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['400'], paddingBottom: spacing['800'] },
  matchRow: { flexDirection: 'row', gap: spacing['150'], alignItems: 'flex-start' },
  // minWidth: 0 이 없으면 안의 내용이 칸보다 커질 때 반반이 깨진다
  half: { flex: 1, minWidth: 0 },
  section: { gap: spacing['150'] },
  stack: { gap: spacing['150'] },
  /**
   * 우리 순위 카드. 이 카드에만 쓰인다.
   *
   * 가로 패딩은 순위 탭의 표와 같은 값이어야 한다. 안에 든 것이 그 표의 줄과 같은
   * 컴포넌트라, 값이 다르면 탭을 오갈 때 같은 표가 옆으로 밀린다.
   */
  card: {
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['200'],
    gap: spacing['200'],
  },
  rankHeadline: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['150'] },
  /**
   * "위" 와 큰 숫자의 **윗선**을 맞춘다.
   *
   * flex-start 는 글자 상자의 위를 맞추지, 글자 자체의 위를 맞추지 않는다. 줄 높이가
   * 글꼴 크기보다 크면 남는 만큼 위아래로 나뉘어 들어가는데, 그 여백이 48/52 인 숫자와
   * 20/28 인 "위" 에서 다르다((52-capHeight)/2 대 (28-capHeight)/2). 그래서 상자만
   * 맞추면 "위" 가 2px쯤 떠 보인다. 그 차이를 여기서 되돌린다.
   *
   * 글꼴을 바꾸거나 display·title2 의 크기를 손대면 이 값도 다시 봐야 한다.
   */
  rankMeta: { paddingTop: 2, gap: spacing['025'] },
  miniTable: { marginTop: spacing['050'] },
})

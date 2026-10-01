import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme, useThemeControl } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Skeleton, SkeletonText } from '@/components/foundation/Skeleton'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { MatchCard, MatchCardSkeleton } from '@/components/match/MatchCard'
import { NewsCard, NewsCardSkeleton } from '@/components/news/NewsCard'
import { VideoCard, VideoCardSkeleton } from '@/components/video/VideoCard'
import { FormPills, StandingsTable, StandingsTableSkeleton } from '@/components/standings/StandingsTable'
import { EmptyState, ErrorState, InlineState, SectionHeader } from '@/components/feedback/States'
import { AnimatedGradientBackground } from '@/components/splash/AnimatedGradientBackground'
import { VideoPlayerScreen } from '@/screens/VideoPlayerScreen'
import {
  mockMatchFinished,
  mockMatchLive,
  mockMatchScheduled,
  mockNews,
  mockStandings,
  mockVideos,
} from '@/utils/fixtures'

/**
 * 컴포넌트 갤러리.
 *
 * 서버 없이 모든 UI 를 한 화면에서 본다. 테마 전환과 스켈레톤 전환을 토글로 붙여
 * "홈/원정 두 테마 x 로딩/완료 두 상태" 네 조합을 손으로 바로 확인할 수 있게 했다.
 * App.tsx 의 RootNavigator 자리에 이 화면을 끼우면 바로 뜬다.
 */
export function GalleryScreen() {
  const theme = useTheme()
  const { themeKey, toggle } = useThemeControl()
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('all')
  const [busy, setBusy] = useState(false)

  const Row = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={styles.stack}>{children}</View>
    </View>
  )

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.toolbar}>
        <PressableScale style={[styles.toggle, { backgroundColor: theme.accent }]} onPress={toggle}>
          <Text style={[fonts.label, { color: '#FFFFFF' }]}>
            테마: {themeKey === 'home' ? '홈(빨강/검정)' : '원정(흰색/빨강)'}
          </Text>
        </PressableScale>
        <PressableScale
          style={[
            styles.toggle,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
            loading && { backgroundColor: theme.flame },
          ]}
          onPress={() => setLoading(v => !v)}
        >
          <Text style={[fonts.label, { color: theme.textPrimary }, loading && styles.onFlame]}>
            {loading ? '스켈레톤 ON' : '스켈레톤 OFF'}
          </Text>
        </PressableScale>
      </View>

      <Row title="경기 카드">
        {loading ? (
          <>
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </>
        ) : (
          <>
            <MatchCard match={mockMatchScheduled} />
            <MatchCard match={mockMatchLive} index={1} />
            <MatchCard match={mockMatchFinished} index={2} />
          </>
        )}
      </Row>

      <Row title="순위표">
        {loading ? <StandingsTableSkeleton rows={4} /> : <StandingsTable standings={mockStandings} />}
      </Row>

      <Row title="최근 폼">
        <FormPills form={['승', '무', '패', '승', '승', '무']} />
      </Row>

      <Row title="필터 탭">
        <CategoryTabs
          tabs={[
            { key: 'all', label: '전체' },
            { key: 'highlight', label: '하이라이트' },
            { key: 'goal', label: '골' },
            { key: 'club', label: '구단' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Row>

      <Row title="뉴스 카드">
        {loading ? (
          <>
            <NewsCardSkeleton />
            <NewsCardSkeleton />
          </>
        ) : (
          mockNews.map((a, i) => <NewsCard key={a.id} article={a} index={i} />)
        )}
      </Row>

      <Row title="영상 카드">
        {loading ? (
          <VideoCardSkeleton />
        ) : (
          mockVideos.map((v, i) => <VideoCard key={v.id} video={v} index={i} />)
        )}
      </Row>

      <Row title="스켈레톤 기본형">
        <Skeleton width="100%" height={20} />
        <Skeleton width={160} height={20} radius={cornerRadius.full} />
        <SkeletonText lines={3} />
      </Row>

      <Row title="섹션 인라인 상태 (홈 화면용)">
        <InlineState message="예정된 경기가 없습니다" />
        <InlineState
          tone="error"
          message="불러오지 못했습니다"
          onRetry={() => setBusy(v => !v)}
          busy={busy}
        />
        <Text style={[fonts.caption, { color: theme.textMuted }]}>
          위 박스를 누르면 진행 중 상태로 바뀝니다. 홈에서는 하나만 눌러도 다섯 섹션이 모두 이 상태가 됩니다.
        </Text>
      </Row>

      <Row title="전체 화면 상태">
        <View style={styles.statePreview}>
          <EmptyState title="아직 표시할 내용이 없습니다" description="수집이 돌면 여기에 채워집니다." />
        </View>
        <View style={styles.statePreview}>
          <ErrorState onRetry={() => {}} />
        </View>
      </Row>

      <Row title="인앱 영상 플레이어">
        {/* 실제 K리그 영상. 퍼가기가 막힌 영상이면 플레이어가 대체 안내로 바뀐다 */}
        <View style={styles.playerPreview}>
          <VideoPlayerScreen
            youtubeId={mockVideos[0]!.youtubeId!}
            title={mockVideos[0]!.title}
            category={mockVideos[0]!.category}
            publishedOn={mockVideos[0]!.publishedOn}
          />
        </View>
      </Row>

      <Row title="스플래시 그라디언트">
        <View style={styles.splashPreview}>
          <AnimatedGradientBackground />
        </View>
      </Row>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  /** 주황 바탕 위에서는 검은 글자라야 읽힌다 */
  onFlame: { color: '#000000' },
  content: { padding: spacing['200'], gap: spacing['400'], paddingBottom: spacing['800'] },
  toolbar: { flexDirection: 'row', gap: spacing['100'], flexWrap: 'wrap' },
  toggle: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius.full,
  },
  section: { gap: spacing['150'] },
  stack: { gap: spacing['150'] },
  splashPreview: { height: 320, borderRadius: cornerRadius['200'], overflow: 'hidden' },
  // EmptyState/ErrorState 는 flex:1 이라 높이를 가진 상자 안에서 봐야 한다
  statePreview: { height: 220 },
  // 플레이어는 flex:1 이라 높이를 가진 상자 안에서 본다
  playerPreview: { height: 380, borderRadius: cornerRadius['200'], overflow: 'hidden' },
})

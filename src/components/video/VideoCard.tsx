import { memo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { cornerRadius, fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '../foundation/PressableScale'
import { Skeleton } from '../foundation/Skeleton'
import type { VideoClip } from '@/models/kleague'

/** RN 0.87 타입에서 StyleSheet.absoluteFillObject 가 빠져 같은 값을 직접 둔다 */
const absoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const

const CATEGORY_LABEL: Record<string, string> = {
  goal: '골',
  highlight: '하이라이트',
  club: '구단',
  etc: '기타',
}

/** 유튜브 썸네일은 목록 응답에 이미 들어 있지만, 없을 때를 대비해 id 로 조립한다. */
const thumbOf = (v: VideoClip) =>
  v.thumbnailUrl ?? (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : null)

/** 재생 표시를 감싼 원. 삼각형은 원래 크기를 지키고 원만 줄인다 */
const PLAY_CIRCLE = 40

function PlayIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M8 5v14l11-7z" fill={color} />
    </Svg>
  )
}

export interface VideoCardProps {
  video: VideoClip
  index?: number
  onPress?: (video: VideoClip) => void
}

export const VideoCard = memo(function VideoCard({ video, index = 0, onPress }: VideoCardProps) {
  const theme = useTheme()
  const [loaded, setLoaded] = useState(false)
  const thumb = thumbOf(video)

  return (
    <Animated.View
      entering={FadeIn.delay(motion.stagger(index))
        .duration(motion.duration.normal)
        .reduceMotion(ReduceMotion.System)}
    >
      <PressableScale
        scaleTo={0.98}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={onPress ? () => onPress(video) : undefined}
        accessibilityLabel={`${video.title} 영상 재생`}
      >
        <View style={[styles.thumbBox, { backgroundColor: theme.skeleton }]}>
          {thumb && (
            <Image
              source={{ uri: thumb }}
              // 다 받아오면 스며든다. 받는 동안은 아래 스켈레톤이 비친다
              style={[StyleSheet.absoluteFill, styles.hidden, loaded && styles.shown]}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoadEnd={() => setLoaded(true)}
            />
          )}
          {!loaded && <Skeleton width="100%" height={168} radius={0} />}

          {/* 재생 버튼은 항상 같은 자리에 둔다. 썸네일 로딩과 무관하게 무엇을 누를지 보이게 */}
          <View style={styles.playOverlay} pointerEvents="none">
            <View style={[styles.playButton, { backgroundColor: theme.accent }]}>
              <PlayIcon color="#FFFFFF" />
            </View>
          </View>

          {/*
            분류 뱃지는 테마를 따라가지 않는다. 썸네일(사진) 위에 얹히므로 배경이
            무슨 색일지 알 수 없고, 반투명 검정 스크림이 어느 사진에서든 글자를
            읽히게 한다 — 바로 위 재생 버튼의 흰 아이콘과 같은 이유다.

            전에는 theme.sub === theme.main 일 때 accent 를 쓰게 돼 있었는데, 세
            테마 모두에서 그 비교가 거짓이라 한 번도 타지 않는 분기였다.
          */}
          {video.category && (
            <View style={[styles.categoryBadge, styles.badgeScrim]}>
              <Text style={[fonts.caption, styles.badgeText]}>
                {CATEGORY_LABEL[video.category] ?? video.category}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={[fonts.bodySmall, { color: theme.textPrimary }]} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={[fonts.caption, { color: theme.textMuted }]}>
            {video.publishedOn ?? ''}
            {video.viewCount != null ? ` · 조회 ${video.viewCount.toLocaleString()}` : ''}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  )
})

export function VideoCardSkeleton() {
  const theme = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Skeleton width="100%" height={168} radius={0} />
      <View style={styles.content}>
        <Skeleton width="100%" height={13} radius={4} />
        <Skeleton width="55%" height={13} radius={4} />
        <Skeleton width={110} height={12} radius={4} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  shown: { opacity: 1 },
  card: {
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  thumbBox: { width: '100%', height: 168 },
  playOverlay: { ...absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playButton: {
    width: PLAY_CIRCLE,
    height: PLAY_CIRCLE,
    borderRadius: PLAY_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // 삼각형은 무게가 왼쪽에 쏠려 있어 한가운데 두면 왼쪽으로 치우쳐 보인다
    paddingLeft: 2,
  },
  categoryBadge: {
    position: 'absolute',
    left: spacing['150'],
    top: spacing['150'],
    paddingHorizontal: spacing['100'],
    paddingVertical: 3,
    borderRadius: cornerRadius.full,
  },
  badgeScrim: { backgroundColor: 'rgba(0,0,0,0.65)' },
  badgeText: { color: '#FFFFFF' },
  content: { padding: spacing['150'], gap: spacing['050'] },
})

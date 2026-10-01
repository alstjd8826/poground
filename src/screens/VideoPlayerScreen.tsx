import { useCallback, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'
import YoutubePlayer from 'react-native-youtube-iframe'

import { openExternal } from '@/utils/openExternal'
import { cornerRadius, fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

/** RN 0.86 타입에서 StyleSheet.absoluteFillObject 가 빠져 같은 값을 직접 둔다 */
const absoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const

const CATEGORY_LABEL: Record<string, string> = {
  goal: '골',
  highlight: '하이라이트',
  club: '구단',
  etc: '기타',
}

export interface VideoPlayerScreenProps {
  youtubeId: string
  title?: string
  category?: string | null
  publishedOn?: string | null
}

/**
 * 유튜브 인앱 재생.
 *
 * 유튜브는 직접 URL 재생이 막혀 있어 iframe 플레이어(WebView)를 쓴다.
 * 구단·리그 영상 중에는 퍼가기가 막힌 것이 섞여 있는데, 그럴 때 플레이어는 검은 화면만 남는다.
 * 그래서 재생 실패를 잡아 유튜브 앱으로 보내는 길을 항상 열어 둔다.
 */
export function VideoPlayerScreen({ youtubeId, title, category, publishedOn }: VideoPlayerScreenProps) {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // 16:9. 화면 폭을 꽉 채워야 작은 기기에서도 볼 만하다
  const playerHeight = Math.round(width * (9 / 16))

  const openInYoutube = useCallback(() => {
    openExternal(`https://www.youtube.com/watch?v=${youtubeId}`, '유튜브')
  }, [youtubeId])

  const meta = [category ? (CATEGORY_LABEL[category] ?? category) : null, publishedOn]
    .filter(Boolean)
    .join(' · ')

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.stage, { height: playerHeight, backgroundColor: '#000000' }]}>
        {!failed && (
          <YoutubePlayer
            height={playerHeight}
            width={width}
            videoId={youtubeId}
            play
            onReady={() => setReady(true)}
            onError={() => setFailed(true)}
            initialPlayerParams={{ modestbranding: true, rel: false, controls: true }}
            webViewProps={{
              // iOS 는 이게 없으면 전체화면으로 강제 전환된다
              allowsInlineMediaPlayback: true,
              allowsFullscreenVideo: true,
            }}
          />
        )}

        {!ready && !failed && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color="#FFFFFF" />
          </View>
        )}

        {failed && (
          <View style={styles.overlay}>
            <Text style={[fonts.bodySmall, styles.center, styles.onDark]}>
              이 영상은 앱 안에서 재생할 수 없습니다
            </Text>
            <PressableScale style={[styles.cta, { backgroundColor: theme.accent }]} onPress={openInYoutube}>
              <Text style={[fonts.label, styles.onDark]}>유튜브에서 보기</Text>
            </PressableScale>
          </View>
        )}
      </View>

      <Animated.View
        entering={FadeIn.duration(motion.duration.normal).reduceMotion(ReduceMotion.System)}
        style={styles.info}
      >
        {title && (
          <Text style={[fonts.title2, { color: theme.textPrimary }]} numberOfLines={3}>
            {title}
          </Text>
        )}
        {meta.length > 0 && <Text style={[fonts.caption, { color: theme.textMuted }]}>{meta}</Text>}

        <PressableScale
          scaleTo={0.98}
          style={[styles.linkRow, { borderColor: theme.border, backgroundColor: theme.surface }]}
          onPress={openInYoutube}
        >
          <Text style={[fonts.label, { color: theme.accent }]}>유튜브에서 열기</Text>
        </PressableScale>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { width: '100%', justifyContent: 'center' },
  overlay: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['200'],
    paddingHorizontal: spacing['300'],
  },
  center: { textAlign: 'center' },
  onDark: { color: '#FFFFFF' },
  cta: {
    paddingHorizontal: spacing['300'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius.full,
  },
  info: { padding: spacing['200'], gap: spacing['100'] },
  linkRow: {
    marginTop: spacing['150'],
    paddingVertical: spacing['200'],
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
})

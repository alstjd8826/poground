import { useCallback, useDeferredValue, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { FlashListRef } from '@shopify/flash-list'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'

import { motion } from '@/styles'
import { QueryList } from '@/components/foundation/QueryList'
import { useTabScrollTop } from '@/hooks/useTabScrollTop'
import { VideoCard, VideoCardSkeleton } from '@/components/video/VideoCard'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { useVideos } from '@/hooks/query/useKleague'
import type { VideoClip } from '@/models/kleague'

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'highlight', label: '하이라이트' },
  { key: 'goal', label: '골' },
  { key: 'club', label: '구단' },
]

export interface VideosScreenProps {
  onOpenVideo?: (video: VideoClip) => void
}

export function VideosScreen({ onOpenVideo }: VideosScreenProps) {
  // 하단 탭을 다시 누르면 맨 위로
  const listRef = useTabScrollTop<FlashListRef<VideoClip>>()
  const [tab, setTab] = useState('all')

  /**
   * 탭 UI 는 즉시, 목록 교체는 한 박자 뒤에.
   *
   * tab 은 누르는 즉시 바뀌어 인디케이터와 글자색이 따라오고,
   * deferredTab 은 React 가 여유 있을 때 갱신되어 무거운 목록 렌더가 탭 반응을 막지 않는다.
   * (RN 의 UI/JS 스레드 분리와는 별개다. React 렌더는 어차피 JS 스레드에서 돈다)
   */
  const deferredTab = useDeferredValue(tab)
  const switching = tab !== deferredTab

  const query = useVideos(deferredTab === 'all' ? undefined : deferredTab)
  const onPress = useCallback((v: VideoClip) => onOpenVideo?.(v), [onOpenVideo])

  // 목록이 아직 이전 카테고리 것일 때 살짝 흐리게 해서, 멈춘 게 아니라 바뀌는 중임을 알린다
  const stale = switching || query.isPlaceholderData
  const listStyle = useAnimatedStyle(() => ({
    opacity: withTiming(stale ? 0.55 : 1, motion.timing.fast),
  }))

  return (
    <View style={styles.root}>
      <CategoryTabs tabs={TABS} value={tab} onChange={setTab} variant="subtle" />
      <Animated.View style={[styles.fill, listStyle]}>
        <QueryList
          listRef={listRef}
          query={query}
          keyExtractor={v => String(v.id)}
          renderItem={({ item, index }) => <VideoCard video={item} index={index} onPress={onPress} />}
          skeleton={<VideoCardSkeleton />}
          skeletonCount={3}
          emptyTitle={
            deferredTab === 'all'
              ? '등록된 영상이 없습니다'
              : `${TABS.find(x => x.key === deferredTab)?.label} 영상이 없습니다`
          }
          emptyDescription={
            deferredTab === 'all' ? '새 영상이 올라오면 여기에 표시됩니다.' : '다른 분류를 눌러보세요.'
          }
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
})

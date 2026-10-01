import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'

import { cornerRadius, fonts, palette, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { usePostPhoto } from '@/hooks/community/useCommunity'
import type { Post } from '@/models/community'

export interface PostPhotoPagerProps {
  post: Post
  /** 몇 번째인지 알리는 방식. 피드는 오른쪽 위 1/4, 상세는 아래 점 */
  indicator: 'count' | 'dots'
  /** 사진을 눌렀을 때. 피드는 글을 연다 */
  onPressPhoto?: () => void
}

/**
 * 글의 사진을 옆으로 넘긴다. 피드 카드와 글 상세가 같이 쓴다.
 *
 * 사진은 1:1 칸을 채운다 — 자르지 않고 올리므로 세로(3:4)·가로(4:3)가 섞여 오는데, 정사각형이면
 * 어느 쪽이든 4분의 1만 잘린다. 피드와 상세가 같은 비율이다 (2026-09-29).
 *
 * 폭은 놓인 자리를 재서 쓴다. 재기 전(첫 그림)에는 화면 폭으로 그려 두어 칸이 비지 않는다.
 */
export function PostPhotoPager({ post, indicator, onPressPhoto }: PostPhotoPagerProps) {
  const theme = useTheme()
  const window = useWindowDimensions()
  const [measured, setMeasured] = useState<number | null>(null)
  const [index, setIndex] = useState(0)
  const width = measured ?? window.width
  const count = post.photos.length

  return (
    <View onLayout={e => setMeasured(e.nativeEvent.layout.width)}>
      <FlatList
        testID="post-photo-pager"
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        data={post.photos}
        keyExtractor={p => p.path}
        onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <PagerPhoto
            post={post}
            position={item.position}
            width={width}
            label={`사진 ${i + 1}/${count}`}
            onPress={onPressPhoto}
          />
        )}
      />
      {count > 1 && indicator === 'count' && (
        <View style={styles.count} pointerEvents="none">
          <Text style={[fonts.label, { color: palette.white }]}>{`${index + 1}/${count}`}</Text>
        </View>
      )}
      {count > 1 && indicator === 'dots' && (
        <View style={styles.dots}>
          {post.photos.map((p, i) => (
            <View
              key={p.path}
              style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.border }]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

function PagerPhoto({
  post,
  position,
  width,
  label,
  onPress,
}: {
  post: Post
  position: number
  width: number
  label: string
  onPress?: () => void
}) {
  const theme = useTheme()
  const uri = usePostPhoto(post, position)
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityLabel={label}>
      <View style={{ width, aspectRatio: 1, backgroundColor: theme.skeleton }}>
        {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  count: {
    position: 'absolute',
    right: spacing['100'],
    top: spacing['100'],
    paddingHorizontal: spacing['100'],
    paddingVertical: 2,
    borderRadius: cornerRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing['075'], marginTop: spacing['100'] },
  dot: { width: 6, height: 6, borderRadius: 3 },
})

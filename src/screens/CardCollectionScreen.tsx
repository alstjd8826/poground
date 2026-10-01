import { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { PressableScale } from '@/components/foundation/PressableScale'
import { EmptyState } from '@/components/feedback/States'
import { PlayerSilhouette } from '@/components/club/PlayerPhoto'
import { CARD_ASPECT } from '@/components/club/PlayerCard'
import { usePlayerCardArt } from '@/components/club/playerCardArt'
import { type FanCard, useFanCards } from '@/hooks/fanCard/useFanCards'
import { FanCardOverlay } from '@/components/club/FanCardOverlay'

export interface CardCollectionScreenProps {
  /**
   * 고치러 간다.
   *
   * 새로 만드는 길은 헤더 오른쪽에 있다 — 그건 라우트가 건다. 여기서는 목록의
   * 한 장을 고르는 일만 다룬다.
   */
  onEdit?: (id: string) => void
}

/**
 * 내가 만든 카드들.
 *
 * 한 장을 누르면 크게 떠서 문질러 볼 수 있다. 목록에서는 문지를 수 없게 두었다 — 카드
 * 여러 장이 저마다 손가락을 기다리면 스크롤과 싸우고, 빛을 계산하는 캔버스가 장수만큼
 * 돌아 느려진다. 목록은 무늬와 얼굴만 보여주고 빛은 크게 열었을 때 낸다.
 */
export function CardCollectionScreen({ onEdit }: CardCollectionScreenProps) {
  const theme = useTheme()
  // 들어간 화면에는 탭바가 없다. 하단 바·홈 인디케이터 뒤에 끝이 깔리지 않게 (useBottomSafeGap)
  const bottomGap = useBottomSafeGap()
  const { width } = useWindowDimensions()
  const { cards, loaded, remove } = useFanCards()
  const [opened, setOpened] = useState<FanCard | null>(null)

  // 두 줄로 세운다. 가장자리 여백과 사이 간격을 뺀 나머지를 반씩 나눈다
  const thumbWidth = (width - spacing['200'] * 2 - spacing['150']) / 2

  const confirmRemove = (card: FanCard) => {
    Alert.alert('이 카드를 지울까요?', card.name || '이름 없는 카드', [
      { text: '취소', style: 'cancel' },
      {
        text: '지우기',
        style: 'destructive',
        onPress: () => {
          setOpened(null)
          // 서버에 올라간 카드는 지우기가 실패할 수 있다. 조용히 삼키면 목록에
          // 그대로 남아 "안 지워졌다" 로만 보인다
          remove(card.id).catch(e => {
            Alert.alert('지우지 못했습니다', e instanceof Error ? e.message : String(e))
          })
        },
      },
    ])
  }

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.background }} />

  return (
    <>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: spacing['800'] + bottomGap }]}
        showsVerticalScrollIndicator={false}
      >
        {cards.length === 0 ? (
          <EmptyState
            title="아직 만든 카드가 없습니다"
            description="오른쪽 위 새로 만들기를 눌러 첫 카드를 만들어 보세요."
          />
        ) : (
          <View style={styles.grid}>
            {cards.map(card => (
              <Thumb
                key={card.id}
                card={card}
                width={thumbWidth}
                onPress={() => setOpened(card)}
                onLongPress={() => confirmRemove(card)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FanCardOverlay
        card={opened}
        onClose={() => setOpened(null)}
        onEdit={() => {
          const id = opened?.id
          setOpened(null)
          if (id) onEdit?.(id)
        }}
        onRemove={() => opened && confirmRemove(opened)}
      />
    </>
  )
}

/**
 * 목록에 놓는 작은 카드.
 *
 * 빛을 내지 않으므로 셰이더를 걸지 않고 바탕 그림만 그린다. 그래야 여러 장을 깔아도
 * 스크롤이 무겁지 않다.
 */
function Thumb({
  card,
  width,
  onPress,
  onLongPress,
}: {
  card: FanCard
  width: number
  onPress: () => void
  onLongPress: () => void
}) {
  const theme = useTheme()
  const height = Math.round(width / CARD_ASPECT)
  const { art } = usePlayerCardArt(CARD_ASPECT, card.tint, card.pattern)
  const photo = useImage(card.photoUri)

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`${card.name || '이름 없는 카드'} 카드`}
      style={[styles.thumb, { width, height, borderColor: theme.border }]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {art && <SkiaImage image={art} x={0} y={0} width={width} height={height} fit="fill" />}
      </Canvas>

      {photo && card.photoUri ? (
        <Image
          source={{ uri: card.photoUri }}
          style={styles.thumbPhoto}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <PlayerSilhouette style={styles.thumbPhoto} />
      )}

      <View style={styles.thumbName}>
        <Text style={[fonts.label, styles.thumbTagline, { color: card.tint }]} numberOfLines={1}>
          {card.tagline}
        </Text>
        <Text style={[fonts.bodySmall, styles.thumbText]} numberOfLines={1}>
          {card.name || '이름 없음'}
        </Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['200'], paddingBottom: spacing['800'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['150'] },
  thumb: {
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  thumbPhoto: { position: 'absolute', left: '7%', top: '3%', width: '86%', height: '80%' },
  thumbName: { position: 'absolute', left: '8%', right: '8%', bottom: '6%' },
  thumbTagline: { textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  thumbText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
})

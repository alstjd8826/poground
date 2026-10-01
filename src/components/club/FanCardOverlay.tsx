import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { palette, spacing } from '@/styles'
import { CARD_ASPECT, PlayerCard } from '@/components/club/PlayerCard'
import { OverlayAction } from '@/components/club/OverlayAction'
import { HIT_PAD } from '@/components/holo/HoloSurface'
import { type FanCard, lookOfFanCard } from '@/hooks/fanCard/useFanCards'
import type { Player } from '@/models/kleague'

/** 카드는 선수 카드와 같은 부품을 쓴다. 기록이 없는 선수로 꾸며 넘긴다 */
export function playerOfFanCard(card: FanCard): Player {
  return {
    playerId: null,
    // 비어 있으면 그대로 비워 둔다. 예전에는 '내 이름' 을 대신 넣었는데, 그것이
    // 카드에 글자로 찍혀서 안 지운 자리처럼 보였다
    name: card.name.trim(),
    backNo: card.backNo.trim() ? Number(card.backNo) : null,
    position: card.tagline.trim() || null,
    appearances: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    photoUrl: card.photoUri,
  }
}

export interface FanCardOverlayProps {
  /** null 이면 닫혀 있다 */
  card: FanCard | null
  onClose: () => void
  onEdit?: () => void
  onRemove?: () => void
}

/**
 * 만든 카드를 크게 띄운다.
 *
 * 보관함에서는 문지를 수 없게 두었으므로, 빛은 여기서 낸다. 화면을 덮는 이유는 선수
 * 카드 때와 같다 — 카드가 손가락을 따라다녀서 목록 위에 놓으면 스크롤과 싸운다.
 */
export function FanCardOverlay({ card, onClose, onEdit, onRemove }: FanCardOverlayProps) {
  const { width, height } = useWindowDimensions()

  // 카드 둘레의 여백까지 화면 안에 들어와야 튀어나온 누끼가 안 잘린다
  const room = { w: width - HIT_PAD * 2, h: height - HIT_PAD * 2 }
  const cardWidth = Math.min(room.w * 0.92, room.h * 0.62 * CARD_ASPECT)

  return (
    <Modal
      visible={card !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* 배경을 누르면 닫힌다. 카드 자체는 끌어야 하므로 여기에 얹지 않는다 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="카드 닫기" />

        {card && (
          <View style={styles.center} pointerEvents="box-none">
            <PlayerCard
              player={playerOfFanCard(card)}
              width={cardWidth}
              look={lookOfFanCard(card)}
              showStats={false}
            />

            <View style={styles.actions}>
              <OverlayAction label="고치기" onPress={onEdit} />
              <OverlayAction label="지우기" tone={palette.red} onPress={onRemove} />
            </View>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing['150'], marginTop: spacing['250'] },
})

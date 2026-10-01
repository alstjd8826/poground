import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { CARD_ASPECT, PlayerCard, tierLabelOf } from '@/components/club/PlayerCard'
import { HIT_PAD } from '@/components/holo/HoloSurface'
import { fonts, palette, spacing } from '@/styles'
import { PlayerPhotoEditor } from '@/components/club/PlayerPhotoEditor'
import type { Player } from '@/models/kleague'

export interface PlayerCardOverlayProps {
  /** null 이면 닫혀 있다 */
  player: Player | null
  onClose: () => void
  /** 로그인 전에 사진을 넣으려 할 때 */
  onRequireLogin?: () => void
}

/**
 * 홀로 카드를 띄우는 오버레이.
 *
 * 프로필 안에 끼워 넣지 않고 덮는 이유는 카드가 손가락을 따라다니기 때문이다. 목록이나
 * 스크롤 위에 놓으면 끌었을 때 어느 쪽이 먹을지 매번 헷갈린다. 화면을 덮어 두면
 * 그 동안은 카드 말고 잡을 것이 없다.
 */
export function PlayerCardOverlay({ player, onClose, onRequireLogin }: PlayerCardOverlayProps) {
  const { width, height } = useWindowDimensions()
  /**
   * 올라가는 동안 카드에 보여 줄 파일. undefined 면 넘겨받은 사진을 그대로 쓴다.
   * 닫히면 거둔다 — 다음에 여는 선수에게 남으면 안 된다.
   */
  const [preview, setPreview] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (player === null) setPreview(undefined)
  }, [player])

  // 폭이든 높이든 먼저 막히는 쪽에 맞춘다. 가로로 눕혀도 카드가 잘리지 않는다.
  // 카드 둘레의 여백까지 화면 안에 들어와야 튀어나온 누끼가 안 잘린다
  const room = { w: width - HIT_PAD * 2, h: height - HIT_PAD * 2 }
  const cardWidth = Math.min(room.w * 0.92, room.h * 0.72 * CARD_ASPECT)
  const shown = player && preview !== undefined ? { ...player, photoUrl: preview } : player

  return (
    <Modal
      visible={player !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* 배경을 누르면 닫힌다. 카드 자체는 끌어야 하므로 여기에 얹지 않는다 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="카드 닫기" />

        {shown && (
          <View style={styles.center} pointerEvents="box-none">
            <PlayerCard player={shown} width={cardWidth} />

            <View style={styles.caption} pointerEvents="none">
              <Text style={[fonts.label, styles.tier]}>{tierLabelOf(shown)}</Text>
              <Text style={[fonts.caption, styles.hint]}>카드를 문지르면 빛이 따라옵니다</Text>
            </View>

            {/* 선수 id 가 없으면 사진을 둘 자리를 만들 수 없다. 선수가 바뀌면 key 로 새로 세워
                앞 선수에서 고른 사진이 남지 않게 한다 */}
            {shown.playerId && (
              <PlayerPhotoEditor
                key={shown.playerId}
                playerId={shown.playerId}
                hasPhoto={shown.photoUrl !== null}
                onPreview={setPreview}
                onRequireLogin={() => onRequireLogin?.()}
              />
            )}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)' },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    alignItems: 'center',
    gap: spacing['050'],
    marginTop: spacing['300'],
  },
  tier: { color: palette.white, letterSpacing: 2 },
  hint: { color: palette.gray['50'] },
})

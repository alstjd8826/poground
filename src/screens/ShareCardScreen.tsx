import { type ReactNode, type RefObject, useCallback, useRef, useState } from 'react'
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'

import { spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { PrimaryButton } from '@/components/foundation/PrimaryButton'
import { CARD_HEIGHT, CARD_WIDTH } from '@/components/share/FairyCard'

/** 찍을 때 크기. 인스타그램 스토리 한 장 */
const OUTPUT = { width: 1080, height: 1920 }

export interface ShareCardScreenProps {
  /** 공유 창 제목 */
  title: string
  /** 찍을 카드. 받은 ref 를 카드 겉 View 에 건다 (승리요정·직관 인증이 같은 틀을 쓴다) */
  renderCard: (ref: RefObject<View | null>) => ReactNode
}

/**
 * 공유 카드 미리보기 (2026-09-30). 보이는 그대로 찍어 시스템 공유 창에 넘긴다 — 인스타 스토리·카톡·사진 저장은
 * 공유 창에서 고른다. 인스타 스토리로 바로 보내는 길은 페이스북 앱 등록이 필요해 쓰지 않는다.
 *
 * 카드는 360×640 한 크기로만 그린다. 화면이 좁으면 바깥에서 줄여 보여 줄 뿐이라, 기기마다 카드 배치가 달라지지
 * 않는다. 찍는 것은 카드 자신이라 바깥의 줄임은 이미지에 들어가지 않는다.
 */
export function ShareCardScreen({ title, renderCard }: ShareCardScreenProps) {
  const theme = useTheme()
  const bottomGap = useBottomSafeGap()
  const { width, height } = useWindowDimensions()
  const card = useRef<View>(null)
  const [busy, setBusy] = useState(false)

  // 버튼 자리를 뺀 공간에 들어가게 줄인다. 키우지는 않는다 — 크게 보여도 찍는 크기는 같다
  const room = { w: width - spacing['400'], h: height - 260 - bottomGap }
  const scale = Math.min(1, room.w / CARD_WIDTH, room.h / CARD_HEIGHT)

  const share = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('공유할 수 없습니다', '이 기기에서는 공유 창을 열 수 없습니다.')
        return
      }
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile', ...OUTPUT })
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: title,
      })
    } catch (e) {
      Alert.alert('카드를 만들지 못했습니다', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [busy, title])

  return (
    <View
      style={[styles.root, { backgroundColor: theme.background, paddingBottom: spacing['200'] + bottomGap }]}
    >
      <View style={styles.stage}>
        <View
          style={{
            width: CARD_WIDTH * scale,
            height: CARD_HEIGHT * scale,
            borderRadius: 16 * scale,
            overflow: 'hidden',
          }}
        >
          <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>{renderCard(card)}</View>
        </View>
      </View>
      <PrimaryButton label="공유하기" onPress={() => void share()} busy={busy} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing['200'], paddingTop: spacing['200'], gap: spacing['200'] },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})

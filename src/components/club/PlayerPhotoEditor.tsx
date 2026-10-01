import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'

import { palette, spacing } from '@/styles'
import { OverlayAction } from '@/components/club/OverlayAction'
import { usePlayerPhotoActions } from '@/hooks/playerPhoto/usePlayerPhotos'
import { cutOut, pickFromLibrary } from '@/utils/pickPhoto'

export interface PlayerPhotoEditorProps {
  playerId: string
  /** 지금 카드에 사진이 있는지. 미리보기까지 친 값이다 */
  hasPhoto: boolean
  /** 카드에 잠깐 보여 줄 파일. null 은 "비움", undefined 는 "미리보기를 거두고 서버 사진을" */
  onPreview: (uri: string | null | undefined) => void
  onRequireLogin: () => void
}

interface Picked {
  raw: string
  cut: string | null
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * 선수 카드에 내 사진을 넣는다.
 *
 * 앨범에서 고르는 것까지만 한다. 앱이 사진을 대신 가져오는 순간 우리가 복제 도구를
 * 내미는 셈이 된다.
 *
 * 올라가기를 기다리지 않고 고른 파일로 카드를 곧바로 그린다. 실패하면 알리고 되돌린다 —
 * 넣은 줄 알았는데 다음에 보니 없는 것이 제일 나쁘다.
 *
 * 원본/누끼 전환은 방금 고른 동안에만 된다. 서버에는 늘 한 장만 두므로, 다시 열면 그
 * 한 장만 남는다 (팬카드와 같은 제약).
 */
export function PlayerPhotoEditor({ playerId, hasPhoto, onPreview, onRequireLogin }: PlayerPhotoEditorProps) {
  const { signedIn, put, remove } = usePlayerPhotoActions(playerId)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [showingCut, setShowingCut] = useState(false)
  const [busy, setBusy] = useState(false)

  // 닫힌 뒤에 끝난 업로드가 다른 선수 카드의 미리보기를 건드리지 않게 한다
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  const upload = useCallback(
    async (uri: string, rollback: () => void) => {
      onPreview(uri)
      setBusy(true)
      try {
        await put(uri)
      } catch (e) {
        if (!alive.current) return
        rollback()
        onPreview(undefined)
        Alert.alert('사진을 올리지 못했습니다', messageOf(e))
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [onPreview, put],
  )

  const choose = useCallback(async () => {
    if (!signedIn) {
      onRequireLogin()
      return
    }
    const raw = await pickFromLibrary()
    if (raw === 'denied') {
      Alert.alert('사진 접근이 필요합니다', '설정에서 사진 접근을 켜면 카드에 넣을 수 있습니다.')
      return
    }
    if (!raw || !alive.current) return

    setBusy(true)
    const cut = await cutOut(raw)
    if (!alive.current) return
    const before = { picked, showingCut }
    setPicked({ raw, cut })
    setShowingCut(cut !== null)
    await upload(cut ?? raw, () => {
      setPicked(before.picked)
      setShowingCut(before.showingCut)
    })
  }, [onRequireLogin, picked, showingCut, signedIn, upload])

  const toggle = useCallback(async () => {
    if (!picked?.cut) return
    const next = !showingCut
    setShowingCut(next)
    await upload(next ? picked.cut : picked.raw, () => setShowingCut(!next))
  }, [picked, showingCut, upload])

  const clear = useCallback(() => {
    Alert.alert('사진을 치울까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '치우기',
        style: 'destructive',
        onPress: () => {
          setBusy(true)
          remove()
            .then(() => {
              if (!alive.current) return
              setPicked(null)
              onPreview(null)
            })
            .catch(e => Alert.alert('치우지 못했습니다', messageOf(e)))
            .finally(() => {
              if (alive.current) setBusy(false)
            })
        },
      },
    ])
  }, [onPreview, remove])

  const filled = hasPhoto || picked !== null

  return (
    <View style={styles.row}>
      {filled ? (
        <>
          <OverlayAction label="바꾸기" onPress={() => void choose()} disabled={busy} />
          {picked?.cut && (
            <OverlayAction
              label={showingCut ? '원본으로' : '누끼로'}
              onPress={() => void toggle()}
              disabled={busy}
            />
          )}
          <OverlayAction label="치우기" tone={palette.red} onPress={clear} disabled={busy} />
        </>
      ) : (
        <OverlayAction label="사진 넣기" onPress={() => void choose()} disabled={busy} />
      )}
      {busy && <ActivityIndicator color={palette.white} />}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'], marginTop: spacing['250'] },
})

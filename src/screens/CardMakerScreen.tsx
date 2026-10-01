import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { cutOut, pickFromLibrary } from '@/utils/pickPhoto'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { Chip } from '@/components/cardMaker/Chip'
import { INFO_FIELDS, InfoBar, type InfoKey } from '@/components/cardMaker/InfoBar'
import { PaletteSheet, SWATCHES } from '@/components/cardMaker/PaletteSheet'
import { HexBar } from '@/components/cardMaker/HexBar'
import { CARD_ASPECT, CARD_EFFECTS, CARD_PATTERNS, PlayerCard } from '@/components/club/PlayerCard'
import { HIT_PAD } from '@/components/holo/HoloSurface'
import {
  emptyFanCard,
  type FanCard,
  keepPhoto,
  lookOfFanCard,
  useFanCards,
} from '@/hooks/fanCard/useFanCards'
import { playerOfFanCard } from '@/components/club/FanCardOverlay'
import type { SaveAction } from '@/components/foundation/HeaderAction'

/**
 * 고를 것의 갈래.
 *
 * 통상적인 꾸미기 화면의 구조를 따른다 — 미리보기는 위에 고정하고, 아래에서 갈래를
 * 고르면 그 갈래의 항목이 **가로로** 깔린다. 세로로 쌓으면 화면이 길어져 카드가
 * 밀려나고, 고르면서 결과를 견주는 일이 끊긴다.
 */
const TABS = [
  { key: 'photo', label: '사진' },
  { key: 'info', label: '정보' },
  { key: 'tint', label: '색' },
  { key: 'pattern', label: '무늬' },
  { key: 'effect', label: '홀로' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** 안내 문구가 카드 아래에서 가져가는 높이. 카드 크기를 잴 때 빼 둔다 */
const HINT_ROOM = 24

/** iOS 가 Modal 을 걷는 데 걸리는 시간. 다음 것을 띄우기 전에 이만큼 기다린다 */
const MODAL_LEAVE_MS = 350

/**
 * 나만의 카드 만들기.
 *
 * 위에 지금 만들고 있는 카드가 그대로 떠 있고 아래에서 고친다 — 고칠 때마다 바로 보이므로
 * "저장하고 확인" 을 오갈 일이 없다. 카드는 선수 카드와 같은 부품이라 문지르면 똑같이 빛난다.
 */
export interface CardMakerScreenProps {
  /** 고칠 카드. 없으면 새로 만든다 */
  id?: string
  /** 저장하고 나면 보관함으로 돌아간다 */
  onSaved?: () => void
  /** 로그인이 필요할 때. 규격대로 된 카카오 버튼이 있는 화면으로 보낸다 */
  onRequireLogin?: () => void
  /**
   * 저장을 헤더 오른쪽에 걸고 싶을 때 쓴다.
   *
   * 저장에 필요한 것(고치는 중인 카드·로그인 청하기)은 전부 이 화면이 쥐고 있는데,
   * 헤더는 내비게이터가 그린다. 그래서 **누를 것만** 위로 넘기고 그리는 일은 라우트에
   * 맡긴다 — 이 화면은 제가 어느 헤더 밑에 놓였는지 끝까지 모른다.
   */
  onSaveAction?: (action: SaveAction) => void
}

export function CardMakerScreen({ id, onSaved, onRequireLogin, onSaveAction }: CardMakerScreenProps) {
  const theme = useTheme()
  const { width, height } = useWindowDimensions()
  const { cards, loaded, save } = useFanCards()
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<FanCard | null>(null)

  // 고칠 카드가 있으면 그것을, 없으면 빈 카드를 바탕으로 삼는다
  const base = useMemo(() => cards.find(c => c.id === id) ?? emptyFanCard(), [cards, id])
  const value = draft ?? base
  const set = useCallback(
    (patch: Partial<FanCard>) => setDraft(prev => ({ ...(prev ?? base), ...patch })),
    [base],
  )

  /**
   * 카드는 위에 붙박이로 두고 아래만 굴린다.
   *
   * 크기는 **남은 자리를 재서** 정한다. 예전에는 화면 높이의 몇 퍼센트로 박아 뒀는데,
   * 그러면 아래 내용이 늘거나 줄 때마다 숫자를 다시 맞춰야 했다. 조작부가 제 높이를
   * 가져가고 남는 만큼을 카드가 쓰면 그 손질이 없어진다.
   *
   * 폭을 실제로 줄인다 — transform 으로 줄이면 카드는 작아 보이지만 자리는 그대로
   * 차지하고 글자도 흐려진다. 폭을 줄이면 카드를 그리는 쪽이 그 크기로 다시 그린다.
   *
   * 재기 전 첫 프레임에는 화면 높이로 어림잡는다. 0 으로 두면 카드가 한 번 깜빡인다.
   */
  const [previewBox, setPreviewBox] = useState(0)
  const room = previewBox > 0 ? previewBox : height * 0.4
  const cardWidth = Math.min(
    width - HIT_PAD * 2 - spacing['200'] * 2,
    (room - HIT_PAD * 2 - HINT_ROOM) * CARD_ASPECT,
  )
  const [tab, setTab] = useState<TabKey>('photo')

  /** 글자 입력과 색상판만 시트로 뺀다 — 가로 스트립에 들어가지 않는 둘이다 */
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [hexOpen, setHexOpen] = useState(false)
  /**
   * 시트를 닫은 까닭이 "색 코드를 치러 간다" 인지.
   *
   * 내려가는 도중에 바를 띄우면 iOS 가 앞의 Modal 을 걷느라 삼킨다. 그래서 뜻만 적어
   * 두고, 시트가 다 사라졌다고 알려 올 때(onClosed) 그때 띄운다.
   */
  const [toHex, setToHex] = useState(false)
  /** 지금 고치는 칸. null 이면 편집 바가 닫혀 있다 */
  const [infoField, setInfoField] = useState<InfoKey | null>(null)

  const look = useMemo(() => lookOfFanCard(value), [value])
  const player = useMemo(() => playerOfFanCard(value), [value])

  const [working, setWorking] = useState(false)

  const pickPhoto = useCallback(async () => {
    const picked = await pickFromLibrary()
    if (picked === 'denied') {
      Alert.alert('사진 접근이 필요합니다', '설정에서 사진 접근을 켜면 카드에 넣을 수 있습니다.')
      return
    }
    if (!picked) return

    setWorking(true)
    try {
      const raw = await keepPhoto(picked)
      const cut = await cutOut(raw)
      // 누끼를 땄으면 그것도 앱 안으로 옮겨 둔다. 임시 자리는 언제 비워질지 모른다
      const kept = cut ? await keepPhoto(cut) : null
      set({ rawPhotoUri: raw, cutPhotoUri: kept, photoUri: kept ?? raw })
    } catch {
      Alert.alert('사진을 저장하지 못했습니다', '다시 골라 주세요.')
    } finally {
      setWorking(false)
    }
  }, [set])

  /** 누끼와 원본을 오간다. 누끼가 엉뚱하게 잘렸을 때 되돌릴 길이다 */
  const showingCutout = value.photoUri !== null && value.photoUri === value.cutPhotoUri
  const canToggle = Boolean(value.rawPhotoUri && value.cutPhotoUri)
  const toggleCutout = useCallback(() => {
    if (!canToggle) return
    set({ photoUri: showingCutout ? value.rawPhotoUri : value.cutPhotoUri })
  }, [canToggle, showingCutout, value.rawPhotoUri, value.cutPhotoUri, set])

  /**
   * 저장.
   *
   * 만드는 것은 로그인 없이 되지만 저장은 로그인이 필요하다. 그래서 로그인 전에 누르면
   * 카드를 기기에 붙잡아 둔 뒤 로그인을 청하고, 끝나면 그 카드를 올린다 — 공들여 만든
   * 것을 로그인 때문에 버리게 하지 않는다.
   *
   * 로그인 창을 닫아도 카드는 기기에 남는다. 다음에 로그인하면 그때 올라간다.
   */
  const onSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const { needsLogin } = await save(value)
      if (!needsLogin) {
        setDraft(null)
        onSaved?.()
        return
      }

      Alert.alert(
        '카드를 저장하려면 로그인이 필요해요',
        '만든 카드는 그대로 두고, 로그인하면 바로 저장됩니다.',
        [
          { text: '나중에', style: 'cancel', onPress: () => onSaved?.() },
          {
            // 여기서 바로 카카오 로그인을 부르지 않는다. 카카오 로그인 디자인 가이드가
            // 정한 버튼(색·심볼·문구)을 시스템 얼럿 단추에는 넣을 수 없어서, 규격대로
            // 된 버튼이 있는 로그인 화면으로 보낸다.
            // 카드는 이미 기기에 담겨 있고, 로그인이 끝나면 저장소가 알아서 올린다
            text: '로그인',
            onPress: () => onRequireLogin?.(),
          },
        ],
      )
    } catch (e) {
      Alert.alert('저장하지 못했습니다', e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [onRequireLogin, onSaved, save, saving, value])

  // 누를 것이 바뀔 때마다 헤더에 다시 걸어 준다. 도는 중인지도 같이 간다
  useEffect(() => {
    onSaveAction?.({ onPress: onSave, busy: saving })
  }, [onSave, onSaveAction, saving])

  if (!loaded) return <View style={{ flex: 1, backgroundColor: theme.background }} />

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* 붙박이. 무엇을 고치든 결과가 여기서 바로 보인다 */}
      <View style={styles.previewWrap} onLayout={e => setPreviewBox(e.nativeEvent.layout.height)}>
        <View style={styles.preview}>
          <PlayerCard player={player} width={cardWidth} look={look} showStats={false} />
        </View>

        <Text style={[fonts.caption, styles.rubHint, { color: theme.textMuted }]}>카드를 문질러보세요!</Text>
      </View>

      {/*
        아래 여백을 따로 주지 않는다. 카드 만들기는 탭 스택 안이라 하단 탭바가 계속 떠
        있고, 탭바가 이미 홈 인디케이터만큼을 잡아 둔다. 여기서 insets.bottom 을 또 더하면
        칩 아래로 40pt 넘게 빈 자리가 생긴다 — 스트립이 제 패딩(12)을 갖고 있으면 충분하다.
      */}
      <View style={[styles.controls, { borderTopColor: theme.divider }]}>
        <CategoryTabs
          tabs={TABS as unknown as Array<{ key: string; label: string }>}
          value={tab}
          onChange={(key: string) => setTab(key as TabKey)}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'photo' && (
            <>
              <Chip
                label={value.photoUri ? '사진 바꾸기' : '사진 고르기'}
                busy={working}
                onPress={working ? undefined : pickPhoto}
              />
              {/* 누끼를 땄을 때만 되돌릴 길을 보여 준다 */}
              {canToggle && (
                <Chip label={showingCutout ? '원본으로' : '배경 지우기'} onPress={toggleCutout} />
              )}
            </>
          )}

          {tab === 'info' && (
            <>
              {/*
                누른 칸이 곧바로 열린다. 칩에는 **값만** 적는다 — 카드에 그 값이 그대로
                보이고 있어서 "이름 김포항" 처럼 이름표를 붙이면 같은 말이 두 번 된다.
                비워 두면 값이 없으니 그때만 이름표를 대신 보여 준다. 안 그러면 빈 칩
                셋이 똑같아져 어느 것이 무엇인지 알 수 없다.

                목록을 손으로 또 적지 않고 InfoBar 것을 그대로 쓴다 — 그래야 "다음" 이
                가는 순서와 눈에 보이는 순서가 어긋나지 않는다.
              */}
              {INFO_FIELDS.map(f => (
                <Chip
                  key={f.key}
                  label={value[f.key] || f.chip}
                  accessibilityLabel={`${f.label} ${value[f.key] || '없음'}`}
                  onPress={() => setInfoField(f.key)}
                />
              ))}
            </>
          )}

          {tab === 'tint' && (
            <>
              {/*
                색상판은 정사각형이라 가로 스트립에 안 들어가서 시트로 연다.
                맨 앞에 둔다 — 자주 쓰는 색 여덟을 지나 끝까지 밀어야 닿으면, 원하는 색이
                목록에 없는 사람이 매번 스트립을 끝까지 쓸어야 한다.
              */}
              <Chip label="직접 고르기" onPress={() => setPaletteOpen(true)} />
              {SWATCHES.map(hex => (
                <Chip
                  key={hex}
                  label=""
                  swatch={hex}
                  selected={value.tint.toUpperCase() === hex.toUpperCase()}
                  onPress={() => set({ tint: hex })}
                  accessibilityLabel={`색 ${hex}`}
                />
              ))}
            </>
          )}

          {tab === 'pattern' &&
            CARD_PATTERNS.map(item => (
              <Chip
                key={item.key}
                label={item.label}
                selected={value.pattern === item.key}
                onPress={() => set({ pattern: item.key })}
              />
            ))}

          {tab === 'effect' &&
            CARD_EFFECTS.map(item => (
              <Chip
                key={item.key}
                label={item.label}
                selected={value.effect === item.key}
                onPress={() => set({ effect: item.key })}
              />
            ))}
        </ScrollView>

        {/*
          안내는 "예상과 다른 결과" 일 때만 붙인다.
          사진이 없을 때 실루엣이 들어간다는 설명은 뺐다 — 카드에 이미 실루엣이 보이고
          있으므로 글자로 한 번 더 말할 이유가 없다. 배경을 못 지운 경우는 다르다.
          누르면 지워질 줄 알았는데 네모난 사진이 들어가므로 이유를 알려야 한다.
        */}
        {tab === 'photo' && value.rawPhotoUri !== null && value.cutPhotoUri === null && (
          <Text style={[fonts.caption, styles.note, { color: theme.textMuted }]}>
            이 사진에서는 배경을 찾지 못해 원본을 그대로 씁니다.
          </Text>
        )}
      </View>

      <InfoBar
        field={infoField}
        card={value}
        onChange={set}
        onField={setInfoField}
        onClose={() => setInfoField(null)}
      />
      {/*
        색 코드는 시트에서 넘겨받는다. 시트를 닫고 키보드 바를 띄웠다가, 바를 닫으면
        시트를 다시 띄운다 — 애플 지침이 말하는 "먼저 것을 닫고, 필요하면 다시 띄워라" 다.
        둘을 겹쳐 띄우면 Modal 위에 Modal 이라 iOS 에서 어긋난다.
      */}
      <PaletteSheet
        open={paletteOpen}
        tint={value.tint}
        onChange={tint => set({ tint })}
        onClose={() => setPaletteOpen(false)}
        onEditHex={() => {
          setToHex(true)
          setPaletteOpen(false)
        }}
        onClosed={() => {
          if (!toHex) return
          setToHex(false)
          setHexOpen(true)
        }}
      />
      <HexBar
        open={hexOpen}
        tint={value.tint}
        onChange={tint => set({ tint })}
        onClose={() => {
          setHexOpen(false)
          // 바가 걷히는 동안 시트를 띄우면 이번엔 시트가 삼켜진다. 걷히고 나서 띄운다
          setTimeout(() => setPaletteOpen(true), MODAL_LEAVE_MS)
        }}
      />
    </View>
  )
}

/**
 * 이름·등번호·한 줄 시트.
 *
 * 세 칸을 단계 안에 두면 키보드가 오르내릴 때마다 카드가 접히고 펴져서 어지럽다.
 * 시트 안에 두면 키보드는 시트만 밀어 올리고 카드는 뒤에 그대로 남는다 — 이름을
 * 치면서 카드에 어떻게 들어가는지 볼 수 있다.
 *
 * 세 칸을 한 시트에 모은 이유는 한꺼번에 치는 값이기 때문이다. 칸마다 시트를 열게
 * 하면 여닫는 일이 세 배가 된다.
 */

const styles = StyleSheet.create({
  root: { flex: 1 },
  /**
   * 카드 자리.
   *
   * 카드에는 둘레 여백(HIT_PAD)이 붙어 있다 — 기울일 때 누끼가 밖으로 나와도 안 잘리게
   * 두는 자리라 없앨 수 없지만, 그만큼 아래가 뜨므로 음수 여백으로 당겨 붙인다.
   */
  /**
   * 카드 둘레 여백은 이제 딱 필요한 만큼(HIT_PAD)이라 따로 당기지 않는다.
   * 아래쪽은 안내 문구가 그 여백 안에 들어앉는다.
   */
  /** 남는 자리를 다 쓴다. 그 높이에 맞춰 카드 크기가 정해진다 */
  previewWrap: { flex: 1, justifyContent: 'center' },
  preview: { alignItems: 'center', justifyContent: 'center' },
  /**
   * 카드 아래 여백(HIT_PAD) 안으로 끌어올린다.
   *
   * 카드 그림의 아래끝은 상자 바닥에서 HIT_PAD 만큼 위에 있다 — 기울일 때 누끼가
   * 밖으로 나와도 안 잘리게 두는 자리다. 글자를 그냥 두면 그 40px 을 다 지나 앉아
   * 카드와 동떨어진다. 여백만큼 당기고 숨 쉴 틈 하나만 남긴다.
   */
  rubHint: {
    textAlign: 'center',
  },
  /** 탭 + 스트립. 미리보기가 남는 자리를 쓰도록 여기는 내용 높이만 차지한다 */
  controls: { borderTopWidth: StyleSheet.hairlineWidth },
  strip: {
    flexDirection: 'row',
    gap: spacing['100'],
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
  },
  note: { textAlign: 'center', paddingHorizontal: spacing['200'], paddingBottom: spacing['150'] },
})

import { StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, palette, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { BottomSheet } from '@/components/foundation/BottomSheet'
import { ColorPicker } from '@/components/foundation/ColorPicker'

/**
 * 자주 쓰는 색.
 *
 * 색상판에서 구단 빨강을 손으로 정확히 집기는 어렵다. 구단 색과 포지션 색은 한 번에
 * 닿도록 따로 깔아 둔다. 카드 만들기의 가로 스트립과 이 시트가 같은 목록을 쓴다.
 */
export const SWATCHES = [
  palette.red,
  palette.sandal,
  palette.cyan,
  palette.win,
  palette.keeper.yellow,
  palette.keeper.sky,
  palette.white,
  palette.gray['50'],
]

/**
 * 색 고르기 시트.
 *
 * 색상판·자주 쓰는 색·색 코드를 단계 안에 다 늘어놓으면 그 단계만 유난히 길어져서,
 * 카드를 작게 줄여도 아래가 넘친다. 열었을 때만 자리를 쓰게 시트로 뺀다.
 *
 * 바텀시트를 쓰는 이유는 뒤의 카드가 남기 때문이다 — 고르는 동안 결과가 보여야
 * 판단이 된다. 그래서 고른 색은 곧바로 카드에 반영한다.
 *
 * 취소를 두지 않는 것도 그래서다. HIG 는 완료만 두면 "마치는 것 말고는 나갈 길이
 * 없다" 로 읽힌다고 경고하는데, 그건 저장할 것이 쌓이는 시트 이야기다. 여기는 고르는
 * 즉시 반영되니 되돌릴 것이 없고, 나가는 다른 길은 끌어내리기와 바깥 누르기가 맡는다.
 */
export function PaletteSheet({
  open,
  tint,
  onChange,
  onClose,
  onClosed,
  onEditHex,
}: {
  open: boolean
  tint: string
  onChange: (hex: string) => void
  onClose: () => void
  /** 다 내려간 뒤. 색 코드 바를 그때 띄운다 */
  onClosed?: () => void
  /**
   * 색 코드를 직접 치러 간다.
   *
   * 입력칸을 시트 **안에** 두면 키보드가 시트를 통째로 밀어 올린다 — 정작 시트의
   * 주인공인 색상판과 견본은 키보드가 필요 없는데 그것들까지 출렁였다. 그래서 여기서는
   * 지금 값만 보여 주고 누르면 넘긴다.
   *
   * 시트를 닫고 키보드 바를 띄우는 일은 부르는 쪽이 한다. 애플 지침도 그렇게 말한다 —
   * "시트에서 또 시트를 열게 되면 먼저 것을 닫고, 필요하면 두 번째를 닫은 뒤 다시 띄워라."
   */
  onEditHex: () => void
}) {
  const theme = useTheme()

  return (
    <BottomSheet
      open={open}
      title="색 고르기"
      onClose={onClose}
      onClosed={onClosed}
      done={{ label: '완료', onPress: onClose }}
    >
      <ColorPicker value={tint} onChange={onChange} />

      <View style={styles.swatches}>
        {SWATCHES.map(hex => {
          const picked = tint.toUpperCase() === hex.toUpperCase()
          return (
            <PressableScale
              key={hex}
              scaleTo={0.9}
              onPress={() => onChange(hex)}
              accessibilityLabel={`색 ${hex}`}
              accessibilityState={{ selected: picked }}
              style={[
                styles.ring,
                { borderColor: 'transparent', backgroundColor: theme.sheet },
                picked && { borderColor: theme.accent },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: hex, borderColor: theme.border }]} />
            </PressableScale>
          )
        })}
      </View>

      <PressableScale
        scaleTo={0.99}
        onPress={onEditHex}
        accessibilityRole="button"
        accessibilityLabel="색 코드 입력 열기"
        style={[styles.hex, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[fonts.label, { color: theme.textMuted }]}>색 코드</Text>
        <Text style={[fonts.field, { color: theme.textPrimary }]}>{tint.toUpperCase()}</Text>
      </PressableScale>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['100'] },
  /**
   * 고른 표시를 두르는 고리. 안쪽 여백이 견본과 고리를 갈라 주는 틈이다.
   * 견본에 바로 테두리를 주면 견본과 같은 색일 때 표시가 사라진다 — 흰 견본에
   * 밝은 테두리, 빨강 견본에 강조색 테두리가 그랬다.
   */
  ring: {
    width: 40,
    height: 40,
    borderRadius: cornerRadius.full,
    borderWidth: 2,
    padding: 2,
  },
  swatch: { flex: 1, borderRadius: cornerRadius.full, borderWidth: StyleSheet.hairlineWidth },
  /** 지금 색 코드를 보여 주고 누르면 치러 간다. 입력칸처럼 보이지만 단추다 */
  hex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
})

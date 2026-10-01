import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'

import { cornerRadius, fonts, palette, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

/** 누른 것의 화면 위 자리. measureInWindow 가 주는 값 그대로다 */
export interface MenuAnchor {
  x: number
  y: number
  width: number
  height: number
}

export interface MenuItem {
  label: string
  /** 되돌릴 수 없는 것. 빨갛게 적는다 (팬카드 지우기와 같은 색) */
  destructive?: boolean
  onPress: () => void
}

/**
 * 차림표가 걷히는 데 걸리는 시간.
 *
 * 고른 일은 이만큼 기다렸다 한다. 그 일이 또 Modal 을 띄우는 것일 때 — 신고 사유 시트가
 * 그렇다 — 앞엣것이 걷히는 중에 뒤엣것을 띄우면 iOS 가 제대로 받지 못한다. 뒤엣것이
 * 아예 안 뜨거나, 화면에 붙는 시점이 밀리는 사이 제 등장 애니메이션이 이미 끝나 버려서
 * 다 올라온 모습으로 툭 나타난다.
 *
 * Modal 의 fade 가 대략 300ms 다. 거기에 한 박자를 더 둔다 — 걷히자마자 이어 붙으면
 * 두 동작이 한 덩어리로 뭉쳐 보여서, 무엇을 골라 무엇이 떴는지 눈이 따라가지 못한다.
 * 부르는 쪽은 이 뜸을 신경 쓸 것이 없다.
 */
const LEAVE_MS = 450

const WIDTH = 200
const ITEM = 44
const PAD = spacing['050']
const GAP = spacing['050']

/**
 * 누른 자리에 붙어 뜨는 작은 차림표.
 *
 * 액션 시트(Alert)를 쓰지 않는 이유는 그것이 화면 아래에서 통째로 올라와, 글 하나를
 * 다루는 일에 비해 몸짓이 크기 때문이다. 어느 댓글을 두고 하는 말인지도 끊긴다 —
 * 시트가 올라오는 동안 그 댓글은 화면 밖으로 밀린다.
 *
 * Modal 로 띄우는 것은 잘리지 않기 위해서다. 목록 안에 그대로 두면 부모의 overflow 에
 * 잘리고, 마지막 줄에서는 차림표가 화면 밖으로 나간다.
 */
export function DropdownMenu({
  anchor,
  items,
  onClose,
}: {
  /** null 이면 닫혀 있다 */
  anchor: MenuAnchor | null
  items: MenuItem[]
  onClose: () => void
}) {
  const theme = useTheme()
  const screen = useWindowDimensions()

  if (!anchor) return null

  const height = items.length * ITEM + PAD * 2

  // 오른쪽 끝을 누른 것에 맞춘다. 화면 밖으로 나가지 않게 양쪽으로 한 번 더 가둔다
  const right = anchor.x + anchor.width
  const left = Math.min(Math.max(spacing['200'], right - WIDTH), screen.width - WIDTH - spacing['200'])

  // 아래로 펴되, 아래가 모자라면 위로 편다. 마지막 댓글에서 화면 밖으로 나가지 않게
  const below = anchor.y + anchor.height + GAP
  const fits = below + height < screen.height - spacing['400']
  const top = fits ? below : anchor.y - height - GAP

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* 바깥을 누르면 닫는다. 차림표는 한 번에 하나만 열려 있다 */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />

      <View
        style={[
          styles.card,
          { top, left, width: WIDTH, backgroundColor: theme.surfaceElevated, borderColor: theme.border },
        ]}
      >
        {items.map((item, i) => (
          <PressableScale
            key={item.label}
            scaleTo={0.98}
            onPress={() => {
              // 먼저 닫는다. 지우기처럼 목록이 바뀌는 일은 차림표가 떠 있는 채로 일어나면
              // 사라진 댓글 위에 차림표만 남는다
              onClose()
              // 걷히고 나서 한다 (LEAVE_MS 주석). 곧바로 하면 다음 Modal 이 어그러진다
              setTimeout(item.onPress, LEAVE_MS)
            }}
            accessibilityRole="button"
            style={[
              styles.item,
              i > 0 && { borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text
              style={[fonts.field, { color: theme.textPrimary }, item.destructive && { color: palette.red }]}
            >
              {item.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: PAD,
    overflow: 'hidden',
  },
  item: { height: ITEM, justifyContent: 'center', paddingHorizontal: spacing['200'] },
})

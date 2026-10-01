import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Input } from '@/components/foundation/Input'
import { KeyboardBar } from '@/components/foundation/KeyboardBar'

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * 색 코드 직접 넣기.
 *
 * 색상판 시트 안에 있던 것을 밖으로 뺐다. 시트에 입력칸이 하나 있으면 키보드가 올라올 때
 * **시트가 통째로 밀려 올라간다** — 정작 시트의 주인공인 색상판과 견본은 키보드가 필요
 * 없는데 그것들까지 출렁였다. 밖으로 빼니 시트에서 키보드가 사라지고, 카드 만들기의
 * 글자 입력(이름·한 줄·번호)과도 같은 자리에서 같은 모양으로 열린다.
 *
 * 치는 도중에는 아직 색이 아니라서(#F, #FA …) 여섯 자리가 다 차야 카드에 반영한다.
 * 그 전까지 입력칸은 친 그대로 둔다 — 안 그러면 한 글자 칠 때마다 지워진다.
 */
export function HexBar({
  open,
  tint,
  onChange,
  onClose,
}: {
  open: boolean
  tint: string
  onChange: (hex: string) => void
  onClose: () => void
}) {
  const theme = useTheme()
  const [text, setText] = useState(tint)

  // 견본이나 색상판으로 색을 골랐으면 입력칸도 따라간다
  useEffect(() => {
    setText(tint)
  }, [tint])

  return (
    <KeyboardBar open={open} onClose={onClose} label="색 코드">
      <View style={styles.row}>
        <View style={styles.input}>
          <Input
            value={text}
            onChangeText={next => {
              const clean = (next.startsWith('#') ? next : `#${next}`).slice(0, 7)
              setText(clean)
              if (HEX.test(clean)) onChange(clean)
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={7}
            placeholder="#FB342E"
            returnKeyType="done"
            onSubmitEditing={onClose}
            accessibilityLabel="색 코드"
          />
        </View>
        <PressableScale
          scaleTo={0.96}
          // 누르는 순간 닫는다 (InfoBar 주석 참고)
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="완료"
          style={[styles.done, { backgroundColor: theme.accent }]}
        >
          <Text style={[fonts.label, { color: theme.textOnMain }]}>완료</Text>
        </PressableScale>
      </View>
    </KeyboardBar>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'] },
  input: { flex: 1 },
  done: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
  },
})

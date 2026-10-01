import { useEffect, useRef } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Input } from '@/components/foundation/Input'
import { KeyboardBar } from '@/components/foundation/KeyboardBar'
import { DEFAULT_BACK_NO, DEFAULT_NAME, type FanCard } from '@/hooks/fanCard/useFanCards'

/**
 * 카드에 적을 것.
 *
 * 한 번에 한 칸만 다룬다. 칸 셋을 담은 시트를 띄우면 어느 칸을 누르든 키보드가 시트를
 * 통째로 밀어 올려서, 고치는 중인 칸이 화면 어디로 가는지 매번 달라진다. 카드도 그만큼
 * 가려진다.
 *
 * 그래서 시트를 걷어내고 **키보드 바로 위에 칸 하나만** 띄운다. 자리가 고정되고, 카드는
 * 키보드가 가리는 만큼만 가려진다.
 *
 * 칸을 옮기는 단추도 여기 둔다. iOS 의 InputAccessoryView 를 쓰지 않는 이유는 그것이
 * iOS 전용이기 때문이다 — 이 바는 두 OS 에서 똑같이 뜬다.
 *
 * 단추 글자는 자리에 따라 갈린다 — 넘길 곳이 있으면 "다음", 마지막 칸이면 "완료" 다.
 * 숫자 칸(등번호)이 맨 끝이라 거기서는 늘 "완료" 가 된다.
 */
/**
 * 칸과 그 순서.
 *
 * 숫자 칸을 **맨 끝에** 둔다. 가운데 두면 거기서 사슬이 끊긴다 — 그 칸에는 넘기는
 * 단추가 없어서, 앞 칸에서 "다음" 을 누른 사람이 더 갈 수 없는 자리에 떨어진다.
 *
 * 칸을 여는 칩도 이 목록에서 뽑는다. 두 군데에 손으로 적어 두면 순서가 어긋나는데,
 * 실제로 여기만 고치고 칩을 안 고쳐서 "다음" 이 가는 순서와 눈에 보이는 순서가
 * 달라진 적이 있다. 문구만 자리에 맞게 가른다 — 칩은 좁아서 짧아야 한다.
 */
export const INFO_FIELDS = [
  { key: 'name', label: '이름', chip: '이름', placeholder: DEFAULT_NAME, maxLength: 12, numeric: false },
  { key: 'tagline', label: '한 줄', chip: '한 줄', placeholder: 'FAN', maxLength: 10, numeric: false },
  // 칩은 가로로 늘어서는 자리라 짧게. 고칠 때는 무엇의 번호인지 또렷해야 한다
  { key: 'backNo', label: '등번호', chip: '번호', placeholder: DEFAULT_BACK_NO, maxLength: 2, numeric: true },
] as const

export type InfoKey = (typeof INFO_FIELDS)[number]['key']

/**
 * 리턴 키에 무엇을 적을지.
 *
 * 숫자 칸에는 주지 않는다. 숫자 패드에는 리턴 키가 없어서 iOS 가 그 동작을 제 액세서리
 * 바로 꺼내 보여 준다 — 파란 "Next" 가 우리 단추와 따로 떠 있던 것이 그것이다.
 */
function returnKeyOf(numeric: boolean, last: boolean) {
  if (numeric) return undefined
  if (last) return 'done' as const
  return 'next' as const
}

export function InfoBar({
  field,
  card,
  onChange,
  onField,
  onClose,
}: {
  /** 지금 고치는 칸. null 이면 닫혀 있다 */
  field: InfoKey | null
  card: FanCard
  onChange: (patch: Partial<FanCard>) => void
  onField: (key: InfoKey) => void
  onClose: () => void
}) {
  const theme = useTheme()
  const input = useRef<TextInput>(null)
  const at = INFO_FIELDS.findIndex(f => f.key === field)
  const spec = at >= 0 ? INFO_FIELDS[at]! : null
  const last = at === INFO_FIELDS.length - 1

  // 칸을 옮겨도 키보드를 내리지 않는다. 같은 입력칸의 내용만 갈아 끼우고 초점을 되돌린다
  useEffect(() => {
    if (spec) input.current?.focus()
  }, [spec])

  if (!spec) return null

  const value = card[spec.key]
  const set = (text: string) =>
    onChange({
      [spec.key]: spec.numeric ? text.replace(/[^0-9]/g, '').slice(0, spec.maxLength) : text,
    } as Partial<FanCard>)

  return (
    <KeyboardBar open onClose={onClose} label={spec.label}>
      <View style={styles.row}>
        <View style={styles.input}>
          <Input
            ref={input}
            value={value}
            onChangeText={set}
            placeholder={spec.placeholder}
            maxLength={spec.maxLength}
            keyboardType={spec.numeric ? 'number-pad' : 'default'}
            autoFocus
            /*
              숫자 칸에는 리턴 키 종류를 주지 않는다. 숫자 패드에는 리턴 키가 없어서
              iOS 가 그 동작을 **키보드 위 자체 액세서리 바**로 꺼내 보여 준다 —
              파란 "Next" 가 우리 단추와 따로 떠 있던 것이 그것이다. 넘기고 마치는
              일은 아래 단추 하나가 맡는다.
            */
            returnKeyType={returnKeyOf(spec.numeric, last)}
            onSubmitEditing={() => (last ? onClose() : onField(INFO_FIELDS[at + 1]!.key))}
            accessibilityLabel={spec.label}
          />
        </View>
        <PressableScale
          scaleTo={0.96}
          onPress={() => (last ? onClose() : onField(INFO_FIELDS[at + 1]!.key))}
          accessibilityRole="button"
          style={[styles.next, { backgroundColor: theme.accent }]}
        >
          <Text style={[fonts.label, { color: theme.textOnMain }]}>{last ? '완료' : '다음'}</Text>
        </PressableScale>
      </View>
    </KeyboardBar>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'] },
  input: { flex: 1 },
  next: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
  },
})

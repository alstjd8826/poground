import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'

import { cornerRadius, fonts, fontFamily, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { checkHandle, HANDLE_MAX, handleProblemMessage } from '@/utils/handle'
import type { SaveAction } from '@/components/foundation/HeaderAction'

export interface HandleScreenProps {
  initial: string
  onSubmit: (handle: string) => Promise<void>
  /** 헤더에 걸 저장을 내보낸다. 누를 것은 이 화면이 쥐고 있으므로 넘겨만 준다 */
  onSaveAction?: (action: SaveAction) => void
}

/**
 * 아이디 바꾸기.
 *
 * 닉네임 화면과 따로 둔다. 규칙이 훨씬 좁아서 안내할 것이 다르고, 여기서는
 * **입력하는 동안** 쓸 수 없는 글자를 걸러내야 한다 — 다 치고 나서 "영문만 됩니다"
 * 라고 하면 지운 만큼 다시 쳐야 한다.
 *
 * 다만 밑줄로 끝나는 것은 치는 동안 막지 않는다. `steel_` 을 지나야 `steel_yard` 에
 * 닿는데, 그때마다 밑줄이 씹히면 아이디를 만들 수가 없다. 그건 저장할 때 본다.
 */
export function HandleScreen({ initial, onSubmit, onSaveAction }: HandleScreenProps) {
  const theme = useTheme()
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** 치는 동안 쓸 수 없는 글자만 떨어낸다. 길이·모양 판정은 저장할 때 한다 */
  const onChangeText = useCallback((text: string) => {
    setValue(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))
    setError(null)
  }, [])

  const problem = useMemo(() => checkHandle(value), [value])
  const changed = value !== initial
  const canSubmit = problem === null && changed && !busy

  const submit = useCallback(async () => {
    if (problem) {
      setError(handleProblemMessage(problem))
      return
    }
    if (!canSubmit) return

    setBusy(true)
    setError(null)
    try {
      await onSubmit(value)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [canSubmit, onSubmit, problem, value])

  // 저장은 헤더 오른쪽에 있다. 여기서 만들어 위로 올려 보낸다
  useEffect(() => {
    onSaveAction?.({ onPress: submit, busy, disabled: !canSubmit })
  }, [busy, canSubmit, onSaveAction, submit])

  // 치는 동안에는 잔소리하지 않는다. 저장이 막힐 이유는 너무 짧을 때가 대부분이고,
  // 그건 곧 채워질 테니 굳이 빨간 글씨로 알릴 일이 아니다
  const note = error ?? (problem && problem !== 'short' ? handleProblemMessage(problem) : null)

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.body}>
        <Text style={[fonts.bodySmall, styles.hint, { color: theme.textMuted }]}>
          다른 사람이 나를 @로 가리킬 때 쓰는 이름입니다. 영문 소문자로 시작하고 소문자·숫자·밑줄만 쓸 수
          있어요.
        </Text>

        <View
          style={[
            styles.field,
            { backgroundColor: theme.surface, borderColor: theme.border },
            note && { borderColor: theme.loss },
          ]}
        >
          <Text style={[styles.at, { color: theme.textMuted, fontFamily: fontFamily.dynamic }]}>@</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            maxLength={HANDLE_MAX}
            placeholder="steel_7k3f"
            placeholderTextColor={theme.textDisabled}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="ascii-capable"
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel="아이디"
            style={[styles.input, { color: theme.textPrimary, fontFamily: fontFamily.dynamic }]}
          />
        </View>

        {/* 글자가 바뀔 때 스며들게 한다. 툭 나타나면 오류가 아닌 글자 수도 경고처럼 읽힌다 */}
        <View style={styles.meta}>
          <Animated.Text
            key={note ?? 'count'}
            entering={FadeIn.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
            style={[fonts.caption, { color: theme.textMuted }, note && { color: theme.loss }]}
          >
            {note ?? `${value.length}/${HANDLE_MAX}`}
          </Animated.Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing['200'], paddingTop: spacing['200'] },
  body: { flex: 1, gap: spacing['100'] },
  hint: { marginBottom: spacing['200'] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['200'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  at: { fontSize: 20 },
  input: { flex: 1, fontSize: 20, paddingVertical: spacing['200'], paddingLeft: 4 },
  meta: { paddingHorizontal: spacing['100'] },
})

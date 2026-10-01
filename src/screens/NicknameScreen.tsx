import { useCallback, useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'

import { cornerRadius, fonts, fontFamily, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PrimaryButton } from '@/components/foundation/PrimaryButton'
import { PressableScale } from '@/components/foundation/PressableScale'
import { NICKNAME_MAX } from '@/hooks/auth/useProfile'
import type { SaveAction } from '@/components/foundation/HeaderAction'

export interface NicknameScreenProps {
  /** 처음 정할 때 미리 채워 둘 이름. 카카오 닉네임이 들어온다 */
  initial: string
  /** 첫 로그인인지. 문구와 "나중에" 여부가 갈린다 */
  first: boolean
  onSubmit: (nickname: string) => Promise<void>
  /**
   * 헤더에 걸 저장을 내보낸다. 첫 로그인 관문에는 헤더가 없어서 안 준다 —
   * 그때는 아래의 "시작하기" 가 그 일을 한다.
   */
  onSaveAction?: (action: SaveAction) => void
  /**
   * 정하지 않고 빠져나갈 길. 첫 로그인 관문에서만 준다.
   *
   * 이 화면은 앱 전체를 덮는데 닫는 단추가 없었다. 세션은 살아 있는데 저장이 계속
   * 실패하면(지워진 계정, 끊긴 망) 앱이 통째로 잠긴다 — 실제로 한 번 갇혔다.
   */
  onEscape?: () => void
}

/**
 * 닉네임 정하기.
 *
 * 첫 로그인과 나중 수정에 같은 화면을 쓴다. 다만 놓이는 자리가 다르다.
 *   첫 로그인  ProfileGate 가 앱 위에 덮는다. 헤더가 없으니 큰 제목으로 무엇을
 *              묻는지 알려야 하고, 노치를 직접 피해야 한다
 *   수정      내비게이션 스택 안이라 헤더에 이미 "닉네임" 이 적혀 있다. 제목을 또
 *              쓰면 같은 말이 두 번 나오므로 빼고, 입력칸을 위로 붙인다
 *
 * 첫 로그인에서는 카카오 닉네임을 미리 채워 둔다. 그대로 쓸 사람은 단추만 누르면
 * 되고, 바꿀 사람만 지우고 쓴다 — 빈 칸으로 두면 모두에게 타이핑을 요구하게 된다.
 */
export function NicknameScreen({ initial, first, onSubmit, onEscape, onSaveAction }: NicknameScreenProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = value.trim()
  const canSubmit = trimmed.length > 0 && !busy

  const submit = useCallback(async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [canSubmit, onSubmit, trimmed])

  // 고치러 들어온 쪽은 헤더 오른쪽에 저장이 걸린다. 누를 것만 만들어 올려 보낸다
  useEffect(() => {
    onSaveAction?.({ onPress: submit, busy, disabled: !canSubmit })
  }, [busy, canSubmit, onSaveAction, submit])

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        { backgroundColor: theme.background },
        // 헤더가 없는 첫 로그인에서만 노치를 피한다
        first && { paddingTop: insets.top + spacing['400'] },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.body}>
        {first && <Text style={[fonts.title1, { color: theme.textPrimary }]}>어떻게 불러 드릴까요?</Text>}
        <Text style={[fonts.bodySmall, styles.hint, { color: theme.textMuted }]}>
          {first
            ? '앱에서 쓸 이름입니다. 나중에 마이에서 바꿀 수 있어요.'
            : '카카오 계정 이름은 그대로예요. 앱에서 쓰는 이름만 바뀝니다.'}
        </Text>

        <TextInput
          value={value}
          onChangeText={t => {
            setValue(t)
            setError(null)
          }}
          maxLength={NICKNAME_MAX}
          placeholder="닉네임"
          placeholderTextColor={theme.textDisabled}
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel="닉네임"
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.textPrimary,
              fontFamily: fontFamily.dynamic,
            },
            error && { borderColor: theme.loss },
          ]}
        />

        {/* 글자가 바뀔 때 스며들게 한다. 툭 나타나면 오류가 아닌 글자 수도 경고처럼 읽힌다 */}
        <View style={styles.meta}>
          <Animated.Text
            key={error ?? 'count'}
            entering={FadeIn.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
            style={[fonts.caption, { color: theme.textMuted }, error && { color: theme.loss }]}
          >
            {error ?? `${trimmed.length}/${NICKNAME_MAX}`}
          </Animated.Text>
        </View>
      </View>

      {/*
        첫 로그인 관문에서만 아래에 단추를 둔다. 그때는 이 면이 앱 전체를 덮어 헤더가
        없기 때문이다. 고치러 들어온 쪽은 헤더 오른쪽에 저장이 걸린다.
        홈 인디케이터에 붙지 않게 아래 안전영역을 남긴다.
      */}
      {first && (
        <View style={{ paddingBottom: insets.bottom + spacing['200'] }}>
          <PrimaryButton label="시작하기" onPress={submit} disabled={!canSubmit} busy={busy} />
          {onEscape && (
            <PressableScale
              scaleTo={0.98}
              onPress={onEscape}
              accessibilityRole="button"
              accessibilityLabel="다른 계정으로 로그인"
              style={styles.escape}
            >
              <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>다른 계정으로 로그인</Text>
            </PressableScale>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing['200'] },
  body: { flex: 1, gap: spacing['100'] },
  hint: { marginBottom: spacing['200'] },
  input: {
    fontSize: 20,
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['200'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  /** 관문에서 빠져나가는 길. 눈에 띄지 않게 두되 손이 닿는 크기는 지킨다 */
  escape: { alignItems: 'center', paddingVertical: spacing['200'] },
  meta: { paddingHorizontal: spacing['100'] },
})

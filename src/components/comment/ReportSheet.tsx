import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { BottomSheet } from '@/components/foundation/BottomSheet'
import { KeyboardBar } from '@/components/foundation/KeyboardBar'
import { Input } from '@/components/foundation/Input'

/**
 * 신고 사유.
 *
 * 값을 그대로 서버에 남기므로 문구를 바꾸면 옛 신고와 새 신고가 달리 적힌다. 나중에
 * 모아 세려면 갈래를 코드로 따로 두어야 하는데, 지금은 사람이 메일로 읽고 판단하는
 * 단계라 읽히는 말을 그대로 남긴다.
 */
const REASONS = ['욕설·비하', '스팸·광고', '음란물', '폭력·위협', '개인정보 노출']

/** 직접 쓰는 사유의 길이. 메일 한 눈에 들어올 만큼만 */
const MAX = 200

/**
 * 왜 신고하는지 고르는 자리.
 *
 * 사유 없이 받으면 메일에 "누가 어떤 글을 신고했다" 까지만 남아, 무엇이 문제인지는
 * 글을 처음부터 읽고 헤아려야 한다. 갈래 하나만 있어도 판단이 훨씬 빨라진다.
 *
 * 직접 쓰는 길은 시트를 **닫고** 키보드 위 입력바로 넘긴다. 시트 안에 칸을 두면 키보드가
 * 시트를 통째로 밀어 올려 고르던 목록이 화면 밖으로 나간다 — 색 코드에서 쓴 방식과 같고,
 * 애플 지침도 "시트에서 또 열게 되면 먼저 것을 닫으라" 고 말한다.
 */
export function ReportSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  /** 고른(혹은 쓴) 사유. 빈 값으로는 부르지 않는다 */
  onSubmit: (reason: string) => void
}) {
  const theme = useTheme()
  /**
   * 어디까지 왔는지.
   *
   * 'pick' 은 사유를 고르는 시트, 'write' 는 직접 쓰는 입력바다. 사이에 'leaving' 을 두는
   * 이유는 시트가 다 내려가기를 기다려야 하기 때문이다 — 내려가는 도중에 띄우면 iOS 가
   * 둘째 Modal 을 삼킨다.
   *
   * 이 단계를 안에서 들고 있는 것이 중요하다. 넘어갈 때마다 바깥에 닫혔다고 알리면
   * 부르는 쪽이 "누구를 신고하는 중인지" 를 놓아 버려, 다 쓰고 보낼 때 대상이 없다.
   */
  const [stage, setStage] = useState<'pick' | 'leaving' | 'write'>('pick')
  const [text, setText] = useState('')

  // 다시 열 때는 늘 빈 상태에서 시작한다
  useEffect(() => {
    if (!open) return
    setText('')
    setStage('pick')
  }, [open])

  const pick = useCallback(
    (reason: string) => {
      onSubmit(reason)
      onClose()
    },
    [onClose, onSubmit],
  )

  // 보낼 것이 있는지. 단추 색과 글자색이 같이 이 값을 본다
  const ready = text.trim().length > 0

  const send = useCallback(() => {
    const written = text.trim()
    if (!written) return
    onSubmit(written)
    onClose()
  }, [onClose, onSubmit, text])

  return (
    <>
      <BottomSheet
        open={open && stage === 'pick'}
        title="신고 사유"
        onClose={onClose}
        cancel={{ label: '취소', onPress: onClose }}
        onClosed={() => {
          // 시트가 다 내려간 뒤에 입력바를 띄운다. 겹치면 둘째가 안 뜬다
          setStage(at => (at === 'leaving' ? 'write' : at))
        }}
      >
        <View style={styles.list}>
          {REASONS.map(reason => (
            <PressableScale
              key={reason}
              scaleTo={0.99}
              onPress={() => pick(reason)}
              accessibilityRole="button"
              style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[fonts.field, { color: theme.textPrimary }]}>{reason}</Text>
            </PressableScale>
          ))}

          <PressableScale
            scaleTo={0.99}
            // 바깥에는 알리지 않는다. 시트만 내려가고 이어서 입력바가 뜬다
            onPress={() => setStage('leaving')}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[fonts.field, { color: theme.textPrimary }]}>직접 쓰기</Text>
          </PressableScale>
        </View>
      </BottomSheet>

      <KeyboardBar
        open={open && stage === 'write'}
        // 쓰다 말고 닫으면 신고하지 않는다. 사유 없는 신고를 만들지 않기 위해서다
        onClose={onClose}
        label="신고 사유"
      >
        <View style={styles.bar}>
          <View style={styles.input}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder="무엇이 문제인지 적어주세요"
              maxLength={MAX}
              autoFocus
              multiline
              accessibilityLabel="신고 사유 입력"
            />
          </View>
          <PressableScale
            scaleTo={0.96}
            onPress={send}
            accessibilityRole="button"
            accessibilityLabel="신고하기"
            style={[
              styles.send,
              { backgroundColor: theme.surfaceElevated },
              ready && { backgroundColor: theme.accent },
            ]}
          >
            <Text style={[fonts.label, { color: theme.textDisabled }, ready && { color: theme.textOnMain }]}>
              신고
            </Text>
          </PressableScale>
        </View>
      </KeyboardBar>
    </>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing['100'] },
  row: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['200'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'] },
  input: { flex: 1 },
  send: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
  },
})

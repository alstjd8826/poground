import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Input } from '@/components/foundation/Input'
import { KeyboardBar } from '@/components/foundation/KeyboardBar'
import { nameOf } from '@/components/comment/name'
import type { Comment, CommentSubject } from '@/repositories/comment/remote'
import { useComments } from '@/hooks/comment/useComments'
import { activeMention, pickMention, replyMention } from '@/models/mention'
import { MentionSuggestions } from '@/components/foundation/MentionSuggestions'

const MAX = 500

export interface CommentComposerProps {
  /** 어디에 달 댓글인지. 경기와 선수가 같은 표를 쓴다 */
  subject: CommentSubject
  /** 답글을 달 상대. 목록에서 "답글" 을 누르면 정해진다 */
  replyTo: Comment | null
  /** 답글 대상을 놓는다 — 올렸거나 그만뒀을 때 */
  onClearReply: () => void
  /** 로그인이 필요할 때. 규격대로 된 카카오 버튼이 있는 화면으로 보낸다 */
  onRequireLogin?: () => void
  /** 제 높이를 알린다. 화면이 그만큼 아래를 비워야 목록 끝이 이 바에 가린다 */
  onHeight?: (height: number) => void
}

/**
 * 댓글 쓰는 자리.
 *
 * **화면 아래에 고정한다.** 목록 끝에 두면 댓글이 쌓일수록 쓰러 가는 길이 멀어진다 —
 * 스무 개만 달려도 끝까지 내려야 단추가 나온다. X·네이버 스포츠처럼 목록 길이와 무관하게
 * 늘 같은 자리에 둔다.
 *
 * 누르면 키보드 위로 입력칸이 올라온다(KeyboardBar). 여기에 칸을 바로 두지 않는 이유는,
 * 이 바가 화면에 붙어 있어 키보드가 올라오면 그 뒤로 숨기 때문이다. 누르는 자리와 치는
 * 자리를 나누면 둘 다 제 위치에 있을 수 있다.
 */
/** 여는 단추에 적을 말. 로그인 여부와 답글 여부로 갈린다 */
function openerLabel(me: string | null, replyTo: Comment | null) {
  if (!me) return '로그인하고 댓글을 남겨보세요'
  if (replyTo) return `${nameOf(replyTo)} 에게 답글`
  return '댓글을 남겨보세요'
}

export function CommentComposer({
  subject,
  replyTo,
  onClearReply,
  onRequireLogin,
  onHeight,
}: CommentComposerProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { me, add } = useComments(subject)
  const [body, setBody] = useState('')
  /*
    커서 자리. 언급 후보는 커서 바로 앞의 @글자 로 찾는다. 선택 이벤트가 안 오는 곳(테스트)에서는 글 끝으로
    본다. 후보를 고른 직후 한 번만 커서를 옮겨 준다(forced) — 계속 쥐고 있으면 사람이 커서를 못 옮긴다
  */
  const [cursor, setCursor] = useState(0)
  const [forced, setForced] = useState<{ start: number; end: number } | undefined>(undefined)
  const typing = activeMention(body, cursor)
  const pick = useCallback(
    (handle: string) => {
      if (!typing) return
      const next = pickMention(body, typing, cursor, handle)
      setBody(next.text)
      setCursor(next.cursor)
      setForced({ start: next.cursor, end: next.cursor })
    },
    [body, cursor, typing],
  )
  const [writing, setWriting] = useState(false)

  /** 로그인은 쓰려고 할 때 청한다. 읽기는 로그인이 없어도 된다 */
  const open = useCallback(() => {
    if (!me) {
      onRequireLogin?.()
      return
    }
    setWriting(true)
  }, [me, onRequireLogin])

  /*
    목록에서 답글을 고르면 곧바로 쓰는 자리가 열린다.

    open 은 의존성에 두지 않는다. 바깥에서 인라인으로 넘어오는 콜백(onRequireLogin)을
    물고 있어서, 부르는 쪽이 다시 그려질 때마다 함수가 새로 생기고 그때마다 이 effect 가
    다시 돈다 — 닫아 둔 입력칸이 저절로 열린다. 같은 덫에 바텀시트에서 한 번 걸렸다.
  */
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    if (replyTo) openRef.current()
  }, [replyTo])

  /*
    답글이면 입력 맨 앞에 상대 @아이디 를 둔다(2026-09-29). 대상이 바뀌면 앞서 자동으로 단 것만 바꾸고,
    답글을 풀면 그것만 뗀다 — 사람이 손으로 쓴 언급은 건드리지 않는다.
  */
  const autoMention = useRef<string | null>(null)
  useEffect(() => {
    const handle = replyTo?.handle ?? null
    setBody(b => replyMention(b, handle, autoMention.current))
    autoMention.current = handle
  }, [replyTo])

  const close = useCallback(() => {
    setWriting(false)
    onClearReply()
  }, [onClearReply])

  // 보낼 것이 있는지. 단추 색과 글자색이 같이 이 값을 본다
  const ready = body.trim().length > 0

  const submit = useCallback(async () => {
    const text = body.trim()
    if (!text) return
    try {
      await add.mutateAsync({ body: text, parentId: replyTo?.id ?? null })
      setBody('')
      setWriting(false)
      onClearReply()
    } catch (e) {
      Alert.alert('올리지 못했습니다', e instanceof Error ? e.message : String(e))
    }
  }, [add, body, onClearReply, replyTo])

  return (
    <View
      onLayout={e => onHeight?.(e.nativeEvent.layout.height)}
      style={[
        styles.dock,
        {
          backgroundColor: theme.surfaceElevated,
          borderTopColor: theme.divider,
          // 하단 탭이 없는 화면이라 홈 인디케이터 자리를 우리가 피한다. 안드로이드는 하단 바에 칸이 딱 붙어
          // 아래 테두리가 묻혀서(갤럭시, 2026-09-30) 바 위에 틈을 더 둔다. 아이폰은 인디케이터 자리가 곧 틈이다
          paddingBottom:
            Platform.OS === 'android'
              ? insets.bottom + spacing['150']
              : Math.max(insets.bottom, spacing['150']),
        },
      ]}
    >
      <PressableScale
        scaleTo={0.99}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="댓글 쓰기"
        style={[styles.opener, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[fonts.field, { color: theme.textDisabled }]} numberOfLines={1}>
          {openerLabel(me, replyTo)}
        </Text>
      </PressableScale>

      <KeyboardBar open={writing} onClose={close} label={replyTo ? `${nameOf(replyTo)} 에게 답글` : '댓글'}>
        <MentionSuggestions query={typing?.query ?? null} onPick={pick} />
        <View style={styles.row}>
          <View style={styles.input}>
            <Input
              value={body}
              onChangeText={text => {
                setBody(text)
                setCursor(text.length)
              }}
              onSelectionChange={e => {
                setCursor(e.nativeEvent.selection.end)
                setForced(undefined)
              }}
              selection={forced}
              placeholder="댓글을 남겨보세요"
              maxLength={MAX}
              autoFocus
              multiline
              accessibilityLabel="댓글 입력"
            />
          </View>
          <PressableScale
            scaleTo={0.96}
            onPress={submit}
            accessibilityRole="button"
            accessibilityLabel="올리기"
            style={[
              styles.send,
              { backgroundColor: theme.surfaceElevated },
              ready && { backgroundColor: theme.accent },
            ]}
          >
            <Text style={[fonts.label, { color: theme.textDisabled }, ready && { color: theme.textOnMain }]}>
              올리기
            </Text>
          </PressableScale>
        </View>
      </KeyboardBar>
    </View>
  )
}

const styles = StyleSheet.create({
  /** 화면 아래에 붙는다. 목록이 아무리 길어도 쓰는 자리는 늘 여기다 */
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing['200'],
    paddingTop: spacing['150'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  /** 누르면 키보드 위로 올라온다. 입력칸처럼 보이지만 실제로는 단추다 */
  opener: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'] },
  input: { flex: 1 },
  send: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
  },
})

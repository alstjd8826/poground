import { type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'

export interface KeyboardBarProps {
  open: boolean
  onClose: () => void
  /** 위에 작게 적는 이름. 무엇을 치는 중인지 알린다 */
  label?: string
  children: ReactNode
}

/**
 * 키보드 바로 위에 붙는 입력 줄.
 *
 * 입력칸을 시트에 담아 띄우면 키보드가 시트를 통째로 밀어 올려서, 고치는 중인 칸이
 * 화면 어디로 가는지 매번 달라지고 뒤에 있던 것도 그만큼 가려진다. 칸 하나만 키보드에
 * 붙여 두면 자리가 고정되고 가려지는 것은 키보드 높이만큼이다.
 *
 * Modal 로 띄우는 이유는 화면 트리 안에 두면 탭바 높이만큼 어긋나기 때문이다. Modal 은
 * 화면 전체를 덮으므로 키보드 높이가 그대로 맞는다.
 *
 * 뒤는 어둡게 깔아 지금 무엇을 고치는 중인지 드러낸다. 바깥을 누르면 닫힌다.
 *
 * **이 바를 띄우는 화면이 ScrollView 안이라면 그 스크롤에 `keyboardShouldPersistTaps`
 * 를 줘야 한다.** Modal 이라 화면에서는 맨 앞에 뜨지만, 터치 임자를 정할 때 RN 은
 * 리액트 트리를 따라가므로 바는 여전히 그 스크롤의 자식이다. 기본값이면 스크롤이 첫
 * 탭을 가로채 키보드를 내리는 데 써 버려서, 바 안의 단추가 눌리지 않는다.
 */
export function KeyboardBar({ open, onClose, label, children }: KeyboardBarProps) {
  const theme = useTheme()

  /**
   * 키보드가 내려가면 바도 닫는다.
   *
   * 바깥을 눌렀을 때 바가 남는 문제를 여기서 푼다. 배경에 누름을 달아 봤지만 첫 탭이
   * 키보드를 내리는 데 쓰여 배경까지 닿지 않았다. 반대로 **결과**를 보고 닫으면
   * 어떤 경로로 내려가든(바깥 탭·아래로 쓸기·리턴 키) 한 가지로 다뤄진다.
   *
   * 뜨기 전에는 듣지 않는다. autoFocus 로 키보드가 올라오기 전에 남아 있던 신호를
   * 들으면 열자마자 닫힌다.
   */
  // 인라인으로 넘어오는 콜백을 참조로 들어 둔다 (아래 의존성 주석 참고)
  const close = useRef(onClose)
  close.current = onClose

  const shown = useRef(false)
  // 키보드가 떠 있는지. 떠 있으면 키보드가 하단 바를 덮으므로 바 높이를 따로 비우지 않는다
  const [keyboardUp, setKeyboardUp] = useState(false)
  // 모달도 하단 바 밑까지 그린다(안드로이드 edge-to-edge). 키보드가 없을 때는 그 높이만큼 줄을 올린다
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0
  useEffect(() => {
    if (!open) {
      shown.current = false
      setKeyboardUp(false)
      return
    }
    const up = Keyboard.addListener('keyboardDidShow', () => {
      shown.current = true
      setKeyboardUp(true)
    })
    const down = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardUp(false)
      if (!shown.current) return
      /*
        곧바로 닫지 않고 한 박자 뒤에 다시 본다.
        바 안에서 다음 칸으로 옮길 때도 키보드가 잠깐 내려갔다 올라온다. 그것까지
        닫기로 받으면 넘어가려는데 바가 사라진다. 돌아왔으면 우리가 부른 것이므로 둔다.
      */
      setTimeout(() => {
        if (!Keyboard.isVisible()) close.current()
      }, 250)
    })
    return () => {
      up.remove()
      down.remove()
    }
    // onClose 는 참조로 떼어 놓는다. 의존성에 두면 부르는 쪽이 렌더될 때마다 리스너를
    // 떼었다 붙이는데, 그 틈에 키보드가 내려가면 신호를 놓쳐 바가 안 닫힌다
  }, [open])

  if (!open) return null

  /*
    안드로이드는 모달 안의 autoFocus 가 창이 준비되기 전에 포커스만 잡고 키보드를 부르지 못한다 — 갤럭시에서
    입력 줄만 뜨고 키보드가 안 올라왔다 (2026-09-30). 모달이 다 뜬 뒤 포커스를 한 번 더 주면 RN 이 키보드를
    올려 달라고 한다. 아이폰은 autoFocus 로 잘 뜨므로 건드리지 않는다
  */
  const onShow = () => {
    if (Platform.OS !== 'android') return
    /*
      RN 은 이미 포커스된 칸의 focus() 를 그냥 넘긴다(TextInputState.focusTextInput) — autoFocus 가 먼저 잡아서
      다시 불러도 안드로이드까지 가지 않았다. 한 번 놓았다가 다시 줘야 네이티브가 키보드를 올려 달라고 한다.
      창이 포커스를 받기 전이면 그것도 무시되므로, 뜰 때까지 몇 번만 다시 한다
    */
    const tries = [50, 150, 300, 600]
    for (const at of tries) {
      setTimeout(() => {
        if (Keyboard.isVisible()) return
        const input = TextInput.State.currentlyFocusedInput()
        if (!input) return
        input.blur()
        input.focus()
      }, at)
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/*
        바깥을 누르면 닫는다.
        누르는 **순간**(onPressIn)에 닫게 해 본 적이 있는데, 그러면 배경이 바 안쪽 단추보다
        먼저 터치를 채간다 — "올리기" 가 안 눌리고 키보드만 내려갔다. 닫는 일은 키보드가
        내려가는 것을 보고 하므로(위 effect) 배경은 여기서 서두를 이유가 없다.
      */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />

      <KeyboardAvoidingView
        style={styles.dock}
        // 안드로이드도 padding 이다. edge-to-edge 에서는 창이 키보드만큼 줄지 않아 스스로 비켜야 한다
        behavior="padding"
        pointerEvents="box-none"
      >
        {/*
          바는 한 단 올린 색으로 둔다. 입력칸이 theme.surface 라 바까지 같은 색이면
          칸의 경계가 사라져 어디를 누르는지 안 보인다 (원정 테마는 둘 다 흰색이라
          입력칸 테두리가 그 일을 맡는다)
        */}
        <View
          style={[
            styles.bar,
            { backgroundColor: theme.surfaceElevated, borderTopColor: theme.divider },
            !keyboardUp && { paddingBottom: spacing['150'] + bottomInset },
          ]}
        >
          {label ? <Text style={[fonts.label, { color: theme.textMuted }]}>{label}</Text> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0009' },
  dock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  bar: {
    paddingHorizontal: spacing['200'],
    paddingTop: spacing['150'],
    paddingBottom: spacing['150'],
    gap: spacing['075'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})

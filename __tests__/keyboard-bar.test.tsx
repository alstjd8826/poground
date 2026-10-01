import { Keyboard, Modal, Platform, StyleSheet, TextInput, View } from 'react-native'
import { act, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { KeyboardBar } from '@/components/foundation/KeyboardBar'

/**
 * 갤럭시에서 댓글을 누르면 입력 줄은 뜨는데 키보드가 안 올라왔다 (2026-09-30). 모달 안의 autoFocus 는 창이
 * 준비되기 전에 포커스만 잡고 키보드는 부르지 못한다. 줄은 하단 내비게이션 바 뒤에 반쯤 깔렸다
 */

const NAV_BAR = 48
const metrics = {
  frame: { x: 0, y: 0, width: 412, height: 915 },
  insets: { top: 32, left: 0, right: 0, bottom: NAV_BAR },
}
const wrap = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider initialPreference="home">
        <KeyboardBar open onClose={jest.fn()} label="댓글">
          <View testID="child" />
        </KeyboardBar>
      </ThemeProvider>
    </SafeAreaProvider>,
  )

const os = Platform.OS
afterEach(() => {
  Platform.OS = os
  jest.restoreAllMocks()
  jest.useRealTimers()
})

/** 모달 창이 포커스를 받기 전에 부르면 안드로이드가 무시한다. 키보드가 뜰 때까지 몇 번 다시 부른다 */
it('키보드가 안 뜨면 뜰 때까지 몇 번 다시 부르고, 뜨면 멈춘다', () => {
  jest.useFakeTimers()
  Platform.OS = 'android'
  const focus = jest.fn()
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({ focus, blur: jest.fn() } as never)
  let visible = false
  jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => visible)
  wrap()
  act(() => {
    screen.UNSAFE_getByType(Modal).props.onShow()
    jest.advanceTimersByTime(60)
  })
  const first = focus.mock.calls.length
  act(() => jest.advanceTimersByTime(200))
  expect(focus.mock.calls.length).toBeGreaterThan(first)
  visible = true
  const afterUp = focus.mock.calls.length
  act(() => jest.runAllTimers())
  expect(focus.mock.calls.length).toBeLessThanOrEqual(afterUp + 1)
})

it('안드로이드에서는 모달이 뜬 뒤 포커스를 다시 줘 키보드를 부른다', () => {
  jest.useFakeTimers()
  Platform.OS = 'android'
  // RN 은 이미 포커스된 칸의 focus() 를 그냥 넘긴다(TextInputState.focusTextInput). 한 번 놓았다가 다시 줘야
  // 안드로이드까지 가서 키보드를 부른다
  const calls: string[] = []
  const input = { blur: () => calls.push('blur'), focus: () => calls.push('focus') }
  jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(input as never)
  wrap()
  act(() => {
    screen.UNSAFE_getByType(Modal).props.onShow()
    jest.advanceTimersByTime(60)
  })
  expect(calls.slice(0, 2)).toEqual(['blur', 'focus'])
})

it('모달도 하단 바 밑까지 그리고, 키보드가 없을 때는 바 높이만큼 아래를 비운다', () => {
  Platform.OS = 'android'
  wrap()
  expect(screen.UNSAFE_getByType(Modal).props.navigationBarTranslucent).toBe(true)
  // 줄은 넘긴 자식을 감싼 가장 가까운 View 다
  let bar = screen.getByTestId('child').parent
  while (bar && !(bar.type === View && bar.props.style)) bar = bar.parent
  const style = StyleSheet.flatten(bar!.props.style)
  expect(style.paddingBottom).toBeGreaterThanOrEqual(NAV_BAR)
})

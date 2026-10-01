import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { LoginScreen } from '@/screens/LoginScreen'
import { useAuth } from '@/hooks/auth/useAuth'

/** 로그인 자체는 소셜 서비스와 Supabase 가 주고받는 일이라 여기서는 결과만 흉내 낸다 */
jest.mock('@/hooks/auth/useAuth', () => ({
  useAuth: jest.fn(),
  // 이 화면은 뜨자마자 애플을 쓸 수 있는지 묻는다. 기본은 "없음" 으로 둬서 카카오만 본다
  isAppleAvailable: jest.fn().mockResolvedValue(false),
}))

function mockSignIn(result: boolean | Promise<boolean>, lastProvider: string | null = null) {
  const signIn = jest.fn().mockResolvedValue(result)
  ;(useAuth as jest.Mock).mockReturnValue({
    session: null,
    ready: true,
    signIn,
    signOut: jest.fn(),
    lastProvider,
  })
  return signIn
}

beforeEach(() => {
  mockSignIn(true)
})

/**
 * 카카오 로그인 버튼은 카카오가 배포한 이미지를 그대로 쓴다.
 *
 * 디자인 가이드가 말풍선 심볼의 형태·비율·색을 바꾸지 못하게 하고, 심볼 없이 만드는
 * 것도 막는다. 그래서 우리가 다시 그리지 않는다 — 여기서 지킬 것은 "직접 그린 버튼이
 * 슬그머니 들어오지 않는 것" 이다.
 */

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider initialPreference="home">{ui}</ThemeProvider>
    </SafeAreaProvider>,
  )

it('카카오 버튼이 있다', () => {
  wrap(<LoginScreen />)
  expect(screen.getByLabelText('카카오 로그인')).toBeTruthy()
})

/**
 * 가이드가 정한 값은 바뀌면 안 된다. 색이나 문구를 손대면 규격을 벗어난다.
 */
it('가이드가 정한 색과 문구를 쓴다', () => {
  const { toJSON } = wrap(<LoginScreen />)
  const tree = JSON.stringify(toJSON())
  expect(tree).toContain('#FEE500')
  expect(tree).toContain('rgba(0, 0, 0, 0.85)')
  expect(tree).toContain('카카오 로그인')
})

/** 심볼은 필수이고 변형할 수 없다. 우리가 그리지 않고 오려낸 것을 쓴다 */
it('심볼을 함께 보여 준다', () => {
  const { toJSON } = wrap(<LoginScreen />)
  expect(JSON.stringify(toJSON())).toContain('symbol.png')
})

it('화면 폭을 다 쓴다', () => {
  const { toJSON } = wrap(<LoginScreen />)
  expect(JSON.stringify(toJSON())).toContain('"width":"100%"')
})

describe('로그인하지 않고 닫았을 때', () => {
  /**
   * 카카오 창을 그냥 닫으면 실패가 아니라 "로그인 안 함" 이다. 둘을 구분하지 못하면
   * 닫았는데 로그인된 것처럼 화면을 넘겨 버려서, 다시 들어와야 한다.
   */
  it('화면을 닫지 않는다', async () => {
    mockSignIn(false)
    const onDone = jest.fn()
    wrap(<LoginScreen onDone={onDone} />)

    fireEvent.press(screen.getByLabelText('카카오 로그인'))

    await waitFor(() => expect(onDone).not.toHaveBeenCalled())
  })

  it('로그인했으면 닫는다', async () => {
    mockSignIn(true)
    const onDone = jest.fn()
    wrap(<LoginScreen onDone={onDone} />)

    fireEvent.press(screen.getByLabelText('카카오 로그인'))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})

/**
 * 소셜이 서넛 되면 어느 것으로 가입했는지 못 외운다. 잘못 고르면 빈 계정이 하나 더
 * 생기고 그 사람은 제 댓글과 카드가 사라진 줄 안다. 그래서 마지막에 쓴 것을 짚어 준다.
 */
describe('최근 로그인 말풍선', () => {
  it('마지막에 쓴 것에만 뜬다', () => {
    mockSignIn(true, 'kakao')
    wrap(<LoginScreen />)
    expect(screen.getByText('최근 로그인')).toBeTruthy()
  })

  it('처음 오는 사람에게는 뜨지 않는다', () => {
    mockSignIn(true, null)
    wrap(<LoginScreen />)
    expect(screen.queryByText('최근 로그인')).toBeNull()
  })
})

/**
 * 기기에 카카오 로그인이 남아 있으면 그 계정으로 곧장 들어가 다른 계정을 고를 수 없었다 (2026-09-30).
 * 평소 로그인은 그대로 두고, 따로 누르는 길에서만 카카오 로그인 화면을 다시 띄운다
 */
describe('다른 카카오 계정', () => {
  it('누르면 다른 계정으로 로그인하게 부른다', async () => {
    const signIn = mockSignIn(true)
    wrap(<LoginScreen />)
    fireEvent.press(screen.getByRole('button', { name: '다른 카카오 계정으로 로그인' }))
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('kakao', { switchAccount: true }))
  })

  it('평소 카카오 버튼은 계정을 다시 묻지 않는다', async () => {
    const signIn = mockSignIn(true)
    wrap(<LoginScreen />)
    fireEvent.press(screen.getByRole('button', { name: '카카오 로그인' }))
    await waitFor(() => expect(signIn).toHaveBeenCalled())
    expect(signIn.mock.calls[0]![1]).toBeUndefined()
  })
})

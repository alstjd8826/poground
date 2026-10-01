import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { Session } from '@supabase/supabase-js'

import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { NICKNAME_MAX, suggestedNickname } from '@/hooks/auth/useProfile'
import { NicknameScreen } from '@/screens/NicknameScreen'

/** 이 화면은 노치를 피해 여백을 잡으므로 SafeAreaProvider 가 필요하다 */
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

function sessionWith(meta: Record<string, unknown>): Session {
  return { user: { user_metadata: meta } } as unknown as Session
}

describe('첫 이름 제안', () => {
  it('카카오 닉네임을 그대로 쓴다', () => {
    expect(suggestedNickname(sessionWith({ name: '민성' }))).toBe('민성')
  })

  /** 카카오 닉네임이 DB 제약보다 길 수 있다. 그대로 넣으면 저장이 거부된다 */
  it('길면 잘라서 제안한다', () => {
    const long = '가'.repeat(40)
    expect(suggestedNickname(sessionWith({ name: long }))).toHaveLength(NICKNAME_MAX)
  })

  it('이름을 못 받았으면 빈 칸으로 둔다', () => {
    expect(suggestedNickname(sessionWith({}))).toBe('')
    expect(suggestedNickname(null)).toBe('')
  })
})

describe('닉네임 화면', () => {
  it('제안된 이름이 미리 채워진다', () => {
    wrap(<NicknameScreen initial="민성" first onSubmit={jest.fn()} />)
    expect(screen.getByDisplayValue('민성')).toBeTruthy()
  })

  /**
   * 빈 이름으로는 넘어갈 수 없어야 한다.
   * DB 에도 제약이 있지만, 여기서 막지 않으면 눌러 본 뒤에야 알게 된다.
   */
  it('빈 칸이면 단추가 잠긴다', () => {
    const onSubmit = jest.fn()
    wrap(<NicknameScreen initial="" first onSubmit={onSubmit} />)

    fireEvent.press(screen.getByLabelText('시작하기'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('공백만 넣어도 잠긴다', () => {
    const onSubmit = jest.fn()
    wrap(<NicknameScreen initial="   " first onSubmit={onSubmit} />)

    fireEvent.press(screen.getByLabelText('시작하기'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('앞뒤 공백을 떼고 넘긴다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    wrap(<NicknameScreen initial="  민성  " first onSubmit={onSubmit} />)

    fireEvent.press(screen.getByLabelText('시작하기'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('민성'))
  })

  /** 저장이 실패하면 왜 안 됐는지 화면에 남아야 한다. 조용히 삼키면 다시 눌러 볼 뿐이다 */
  it('저장 실패 사유를 보여준다', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('이미 쓰는 이름입니다'))
    wrap(<NicknameScreen initial="민성" first onSubmit={onSubmit} />)

    fireEvent.press(screen.getByLabelText('시작하기'))
    await waitFor(() => expect(screen.getByText('이미 쓰는 이름입니다')).toBeTruthy())
  })

  it('첫 로그인에서만 큰 제목을 쓴다', () => {
    wrap(<NicknameScreen initial="민성" first onSubmit={jest.fn()} />)
    expect(screen.getByText('어떻게 불러 드릴까요?')).toBeTruthy()
  })

  /**
   * 수정 화면은 내비게이션 헤더에 이미 "닉네임" 이 적혀 있다.
   * 제목을 또 쓰면 같은 말이 두 번 나오고 입력칸이 아래로 밀린다.
   */
  it('수정 화면에는 제목을 쓰지 않는다', () => {
    wrap(<NicknameScreen initial="민성" first={false} onSubmit={jest.fn()} />)
    expect(screen.queryByText('어떻게 불러 드릴까요?')).toBeNull()
    expect(screen.queryByText('닉네임 바꾸기')).toBeNull()
    // 입력칸은 그대로 있어야 한다
    expect(screen.getByDisplayValue('민성')).toBeTruthy()
  })
})

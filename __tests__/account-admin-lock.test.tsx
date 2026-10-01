import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AccountScreen } from '@/screens/AccountScreen'

/** 운영자 계정은 아이디·닉네임을 바꾸지 못한다 (2026-09-29). DB 도 막는다(0026) */

let mockIsAdmin = false
jest.mock('@/hooks/comment/useIsAdmin', () => ({ useIsAdmin: () => mockIsAdmin }))
jest.mock('@/hooks/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'me' } }, signOut: jest.fn() }),
  isAppleAvailable: async () => false,
}))
jest.mock('@/hooks/auth/useProfile', () => ({
  useProfile: () => ({
    profile: { id: 'me', nickname: '포그라운드 운영자', handle: 'poground', avatarUrl: null },
    saveAvatar: jest.fn(),
    clearAvatar: jest.fn(),
  }),
}))
jest.mock('@/components/auth/LinkedAccounts', () => ({ LinkedAccounts: () => null }))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

beforeEach(() => {
  mockIsAdmin = false
})

it('운영자는 아이디·닉네임 줄을 눌러도 바꾸는 화면으로 가지 않고, 안내가 있다', () => {
  mockIsAdmin = true
  const onOpenHandle = jest.fn()
  const onOpenNickname = jest.fn()
  wrap(<AccountScreen onOpenHandle={onOpenHandle} onOpenNickname={onOpenNickname} />)
  fireEvent.press(screen.getByLabelText('아이디, 현재 poground'))
  fireEvent.press(screen.getByLabelText('닉네임, 현재 포그라운드 운영자'))
  expect(onOpenHandle).not.toHaveBeenCalled()
  expect(onOpenNickname).not.toHaveBeenCalled()
  expect(screen.getByText('운영자 계정은 아이디와 닉네임을 바꿀 수 없습니다')).toBeTruthy()
})

it('일반 사용자는 그대로 바꾸러 간다', () => {
  const onOpenHandle = jest.fn()
  wrap(<AccountScreen onOpenHandle={onOpenHandle} />)
  fireEvent.press(screen.getByLabelText('아이디, 현재 poground'))
  expect(onOpenHandle).toHaveBeenCalled()
  expect(screen.queryByText('운영자 계정은 아이디와 닉네임을 바꿀 수 없습니다')).toBeNull()
})

it('차단한 사용자 화면으로 가는 길이 있다', () => {
  const onOpenBlocked = jest.fn()
  wrap(<AccountScreen onOpenBlocked={onOpenBlocked} />)
  fireEvent.press(screen.getByLabelText('차단한 사용자'))
  expect(onOpenBlocked).toHaveBeenCalled()
})

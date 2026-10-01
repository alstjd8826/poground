import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AccountScreen } from '@/screens/AccountScreen'
import { deleteMyAccount } from '@/repositories/profile/account'

/** 앱 안에서 계정을 지운다 (지침 5.1.1(v), 2026-09-30) */

const mockInvoke = jest.fn()
jest.mock('@/repositories/remote/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}))

let mockIsAdmin = false
const mockSignOut = jest.fn(async () => {})
const mockForgetCards = jest.fn(async () => {})
jest.mock('@/hooks/comment/useIsAdmin', () => ({ useIsAdmin: () => mockIsAdmin }))
jest.mock('@/hooks/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'me' } }, signOut: mockSignOut }),
  isAppleAvailable: async () => false,
}))
jest.mock('@/hooks/auth/useProfile', () => ({
  useProfile: () => ({
    profile: { id: 'me', nickname: '팬', handle: 'fan', avatarUrl: null, termsVersion: 1 },
    saveAvatar: jest.fn(),
    clearAvatar: jest.fn(),
  }),
}))
jest.mock('@/hooks/fanCard/useFanCards', () => ({ forgetLocalFanCards: () => mockForgetCards() }))
jest.mock('@/components/auth/LinkedAccounts', () => ({ LinkedAccounts: () => null }))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
/** 확인 창에서 이 이름의 단추를 누른다 */
const confirmWith = (label: string) =>
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find(b => b.text === label)?.onPress?.()
  })

beforeEach(() => {
  mockIsAdmin = false
  mockInvoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null })
  mockSignOut.mockClear()
  mockForgetCards.mockClear()
  jest.restoreAllMocks()
})

it('한 번 묻고, 지우면 서버 함수를 부르고 기기의 카드를 비운 뒤 로그아웃한다', async () => {
  const alert = confirmWith('계정 삭제')
  wrap(<AccountScreen />)
  fireEvent.press(screen.getByRole('button', { name: '계정 삭제' }))
  expect(alert.mock.calls[0]![1]).toMatch(/되돌릴 수 없습니다/)
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled())
  expect(mockInvoke).toHaveBeenCalledWith('delete-account', expect.objectContaining({ method: 'POST' }))
  expect(mockForgetCards).toHaveBeenCalled()
})

it('취소하면 아무것도 지우지 않는다', () => {
  confirmWith('취소')
  wrap(<AccountScreen />)
  fireEvent.press(screen.getByRole('button', { name: '계정 삭제' }))
  expect(mockInvoke).not.toHaveBeenCalled()
})

it('서버가 실패하면 알리고 로그인을 그대로 둔다', async () => {
  const alert = confirmWith('계정 삭제')
  mockInvoke.mockResolvedValue({
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ error: 'storage down' }) },
    },
  })
  wrap(<AccountScreen />)
  fireEvent.press(screen.getByRole('button', { name: '계정 삭제' }))
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith('계정을 지우지 못했습니다', expect.stringContaining('storage down')),
  )
  expect(mockSignOut).not.toHaveBeenCalled()
  expect(mockForgetCards).not.toHaveBeenCalled()
})

it('운영자 계정에는 계정 삭제를 두지 않는다', () => {
  mockIsAdmin = true
  wrap(<AccountScreen />)
  expect(screen.queryByRole('button', { name: '계정 삭제' })).toBeNull()
})

it('서버 함수의 오류 문구를 꺼내 던진다', async () => {
  mockInvoke.mockResolvedValue({
    data: null,
    error: {
      message: 'non-2xx',
      context: { json: async () => ({ error: '운영자 계정은 지울 수 없습니다' }) },
    },
  })
  await expect(deleteMyAccount()).rejects.toThrow('운영자 계정은 지울 수 없습니다')
})

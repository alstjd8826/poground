import { renderHook, waitFor } from '@testing-library/react-native'

import { useNotificationTaps } from '@/notifications/useNotificationTaps'

/** 알림을 누르면 그 경기 상세로 (2026-09-30). 앱이 꺼져 있다 알림으로 켜진 경우도 받는다 */

let mockListener: ((r: unknown) => void) | null = null
let mockLast: unknown = null
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (cb: (r: unknown) => void) => {
    mockListener = cb
    return { remove: jest.fn() }
  },
  getLastNotificationResponseAsync: async () => mockLast,
  setNotificationHandler: jest.fn(),
}))
const mockOpen = jest.fn((_url: string) => true)
jest.mock('@/navigation/deepLink', () => ({
  openFromUrl: (url: string) => mockOpen(url),
  commentUrl: (s: { type: string; id: string }) => `poground://comment?type=${s.type}&id=${s.id}`,
}))

const response = (gameId: number) => ({ notification: { request: { content: { data: { gameId } } } } })

beforeEach(() => {
  mockOpen.mockClear()
  mockListener = null
  mockLast = null
})

it('떠 있는 동안 누른 알림은 그 경기를 연다', () => {
  renderHook(() => useNotificationTaps())
  mockListener!(response(178))
  expect(mockOpen).toHaveBeenCalledWith('poground://comment?type=match&id=178')
})

it('알림으로 앱이 켜졌으면 그 알림의 경기를 연다', async () => {
  mockLast = response(179)
  renderHook(() => useNotificationTaps())
  await waitFor(() => expect(mockOpen).toHaveBeenCalledWith('poground://comment?type=match&id=179'))
})

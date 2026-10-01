import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { attendancesKey, useAttendances } from '@/hooks/attendance/useAttendances'
import { SEASON_YEAR } from '@/config/env'
import type { Match } from '@/models/kleague'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: mockSession }) }))

jest.mock('@/repositories/attendance/remote', () => ({
  ...jest.requireActual('@/repositories/attendance/remote'),
  listMine: jest.fn(),
  mark: jest.fn(),
  unmark: jest.fn(),
}))
jest.mock('@/repositories/remote/privateImage', () => ({
  adoptPrivateImage: jest.fn(() => 'cache://x'),
  dropPrivateImage: jest.fn(),
  resolvePrivateImage: jest.fn(async () => null),
}))

const remote = jest.requireMock('@/repositories/attendance/remote') as {
  listMine: jest.Mock
  mark: jest.Mock
  unmark: jest.Mock
}
const match = { id: 172 } as Match
const key = { year: SEASON_YEAR, leagueId: 1, gameId: 172 }
const row = { ...key, updatedAt: '2026-09-28T00:00:00Z' }

const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach(c => c.clear())
  clients.length = 0
})

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useAttendances(), { wrapper })
}

beforeEach(() => {
  mockSession = { user: { id: 'user-1' } }
  // 가짜 모듈에는 진짜 값(버킷 이름, 경로 함수)도 섞여 있다. 가짜만 되돌린다
  for (const fn of [remote.listMine, remote.mark, remote.unmark]) fn.mockReset()
  remote.listMine.mockResolvedValue([])
  remote.mark.mockResolvedValue(row)
  remote.unmark.mockResolvedValue(undefined)
})

describe('직관 기록 저장소', () => {
  /** 맨 앞 칸이 사용자 id 여야 정책이 주인을 가린다 (0022) */
  it('질의 열쇠에 누구의 답인지 담는다', () => {
    expect(attendancesKey('user-1')).toEqual(['myAttendances', 'user-1'])
  })
})

describe('직관 표시', () => {
  it('누르는 즉시 표시되고 서버에 적는다', async () => {
    // 처음엔 비어 있고, 표시 뒤 다시 받으면 서버에 한 줄이 있다
    remote.listMine.mockResolvedValueOnce([]).mockResolvedValue([row])
    const { result } = setup()
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    await act(async () => {
      await result.current.toggle(match)
    })
    expect(remote.mark).toHaveBeenCalledWith('user-1', key)
    // react-query 는 바뀐 것을 한 박자 뒤(setTimeout 0)에 알린다
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
  })

  it('표시가 실패하면 되돌리고 알린다', async () => {
    remote.mark.mockRejectedValue(new Error('network'))
    const { result } = setup()
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
    await act(async () => {
      await expect(result.current.toggle(match)).rejects.toThrow('network')
    })
    await waitFor(() => expect(result.current.rows).toHaveLength(0))
  })

  it('이미 표시했으면 취소한다', async () => {
    remote.listMine.mockResolvedValueOnce([row]).mockResolvedValue([])
    const { result } = setup()
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    await act(async () => {
      await result.current.toggle(match)
    })
    expect(remote.unmark).toHaveBeenCalledWith(key)
    await waitFor(() => expect(result.current.rows).toHaveLength(0))
  })

  /** 앞 사람의 기록이 남으면 안 된다 */
  it('로그인 전에는 빈 목록이고 서버를 부르지 않는다', async () => {
    mockSession = null
    const { result } = setup()
    expect(result.current.signedIn).toBe(false)
    expect(result.current.rows).toEqual([])
    expect(remote.listMine).not.toHaveBeenCalled()
  })

  /** 같은 기기에 다른 사람이 로그인하면 앞 사람 기록을 물려받지 않는다 */
  it('로그인한 사람이 바뀌면 그 사람의 기록만 보인다', async () => {
    remote.listMine.mockResolvedValueOnce([row]).mockResolvedValue([])
    const { result, rerender } = setup()
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    mockSession = { user: { id: 'user-2' } }
    rerender({})
    await waitFor(() => expect(result.current.rows).toHaveLength(0))
  })
})

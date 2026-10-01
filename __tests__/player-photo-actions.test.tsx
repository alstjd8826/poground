import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { usePlayerPhotoActions } from '@/hooks/playerPhoto/usePlayerPhotos'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: mockSession }) }))

jest.mock('@/repositories/playerPhoto/remote', () => ({
  ...jest.requireActual('@/repositories/playerPhoto/remote'),
  uploadPlayerPhoto: jest.fn(),
  listMyPlayerPhotos: jest.fn(),
  removePlayerPhoto: jest.fn(),
}))
jest.mock('@/repositories/remote/privateImage', () => ({
  adoptPrivateImage: jest.fn(() => 'cache://x'),
  dropPrivateImage: jest.fn(),
  resolvePrivateImage: jest.fn(async () => null),
}))

const remote = jest.requireMock('@/repositories/playerPhoto/remote') as {
  uploadPlayerPhoto: jest.Mock
  listMyPlayerPhotos: jest.Mock
}
const cache = jest.requireMock('@/repositories/remote/privateImage') as { adoptPrivateImage: jest.Mock }

// 테스트가 끝나도 캐시가 타이머를 물고 있으면 jest 가 종료되지 않는다
const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach(c => c.clear())
  clients.length = 0
})

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => usePlayerPhotoActions('20060066'), { wrapper })
  return { ...hook, client, invalidate }
}

beforeEach(() => {
  mockSession = { user: { id: 'user-1' } }
  remote.uploadPlayerPhoto.mockReset().mockResolvedValue(undefined)
  remote.listMyPlayerPhotos.mockReset().mockResolvedValue({ '20060066': '2026-09-28T00:00:00Z' })
  cache.adoptPrivateImage.mockClear()
})

describe('선수 사진 올리기', () => {
  /**
   * 올라간 뒤에 목록을 다시 받다 실패하면, 서버에는 새 사진이 있는데 화면은 "올리지 못했다"
   * 고 알리고 되돌렸다. 올라갔으면 성공이다. 목록은 다음에 다시 받게 둔다.
   */
  it('올린 뒤 목록을 못 받아도 성공으로 친다', async () => {
    remote.listMyPlayerPhotos.mockRejectedValue(new Error('network'))
    const { result, invalidate } = setup()
    await act(async () => {
      await expect(result.current.put('file:///picked.png')).resolves.toBeUndefined()
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['myPlayerPhotos', 'user-1'] })
  })

  it('올리기 자체가 실패하면 실패다', async () => {
    remote.uploadPlayerPhoto.mockRejectedValue(new Error('403'))
    const { result } = setup()
    await act(async () => {
      await expect(result.current.put('file:///picked.png')).rejects.toThrow('403')
    })
  })

  /** 로그아웃하면 캐시를 비우는데, 그 뒤에 끝난 업로드가 앞 사람 사진을 다시 적으면 안 된다 */
  it('올리는 사이 로그아웃했으면 캐시에 적지 않는다', async () => {
    let finish: () => void = () => {}
    remote.uploadPlayerPhoto.mockReturnValue(new Promise<void>(resolve => (finish = resolve)))
    const { result, rerender } = setup()

    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.put('file:///picked.png')
    })
    mockSession = null
    rerender({})
    await act(async () => {
      finish()
      await pending
    })

    expect(cache.adoptPrivateImage).not.toHaveBeenCalled()
  })

  it('평소에는 방금 고른 파일을 캐시에 옮겨 둔다', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.put('file:///picked.png')
    })
    expect(cache.adoptPrivateImage).toHaveBeenCalledWith(
      { bucket: 'my-player-photos', path: 'user-1/20060066', version: '2026-09-28T00:00:00Z' },
      'file:///picked.png',
    )
  })
})

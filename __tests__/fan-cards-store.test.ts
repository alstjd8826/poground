import { act, renderHook, waitFor } from '@testing-library/react-native'

import { emptyFanCard, type FanCard, photoPlan, useFanCards } from '@/hooks/fanCard/useFanCards'

/** 로그인 상태 바뀜을 손으로 일으키려고 구독 콜백을 붙잡아 둔다 */
jest.mock('@/repositories/remote/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: jest.fn(),
    },
  },
}))

jest.mock('@/repositories/fanCard/remote', () => ({
  ...jest.requireActual('@/repositories/fanCard/remote'),
  listMyCards: jest.fn(),
  upsertCard: jest.fn(),
  uploadCardPhoto: jest.fn(),
  deleteCard: jest.fn(),
}))

// 캐시 파일은 cache:// 로 시작한다고 친다. 실제 파일시스템은 jest 에 없다
jest.mock('@/repositories/remote/privateImage', () => ({
  isPrivateCacheUri: (uri: string) => uri.startsWith('cache://'),
  resolvePrivateImage: jest.fn(async () => null),
  adoptPrivateImage: jest.fn(() => 'cache://adopted'),
  dropPrivateImage: jest.fn(),
}))

const { supabase } = jest.requireMock('@/repositories/remote/supabase') as {
  supabase: { auth: { onAuthStateChange: jest.Mock } }
}
const remote = jest.requireMock('@/repositories/fanCard/remote') as { listMyCards: jest.Mock }

const authChange = (userId: string | null) => {
  const listener = supabase.auth.onAuthStateChange.mock.calls[0][0] as (
    event: string,
    session: unknown,
  ) => void
  listener(userId ? 'SIGNED_IN' : 'SIGNED_OUT', userId ? { user: { id: userId } } : null)
}

const card = (over: Partial<FanCard>): FanCard => ({ ...emptyFanCard(), id: 'card-1', ...over })

describe('저장할 때 사진을 어떻게 다루나', () => {
  it('새로 고른 기기 파일은 올린다', () => {
    expect(photoPlan(card({ photoUri: 'file:///picked.jpg' }), 'user-1')).toEqual({
      upload: 'file:///picked.jpg',
      path: 'user-1/card-1.jpg',
    })
  })

  it('이미 받아 둔 캐시 파일은 다시 올리지 않는다', () => {
    expect(
      photoPlan(card({ photoUri: 'cache://x', remotePhotoPath: 'user-1/card-1.jpg' }), 'user-1'),
    ).toEqual({
      upload: null,
      path: 'user-1/card-1.jpg',
    })
  })

  /**
   * 보관함은 글자를 먼저 보여 주고 사진은 받는 대로 채운다. 사진이 오기 전이나 받기에
   * 실패한 채로 이름만 고쳐 저장하면, 사진이 없는 것으로 알고 서버에서 지워 버렸다.
   * 카드 만들기에는 사진 빼기가 없다 — 비어 있는 것은 "지워라" 가 아니라 "아직 모른다" 다.
   */
  it('사진을 아직 못 받은 카드를 저장해도 서버 사진을 지우지 않는다', () => {
    expect(photoPlan(card({ photoUri: null, remotePhotoPath: 'user-1/card-1.jpg' }), 'user-1')).toEqual({
      upload: null,
      path: 'user-1/card-1.jpg',
    })
  })

  it('처음부터 사진이 없던 카드는 없는 채로 둔다', () => {
    expect(photoPlan(card({ photoUri: null }), 'user-1')).toEqual({ upload: null, path: null })
  })
})

describe('로그인이 바뀌는 사이', () => {
  /**
   * 앞 사람의 목록을 받는 중에 로그아웃하면, 늦게 도착한 목록이 이미 비운 자리를 다시
   * 채웠다. 로그아웃한 화면이나 다음 사람에게 앞 사람 카드가 보인다.
   */
  it('로그아웃 뒤에 도착한 앞 사람 목록은 버린다', async () => {
    let deliver: (rows: unknown[]) => void = () => {}
    remote.listMyCards.mockReturnValue(new Promise(resolve => (deliver = resolve)))

    const { result } = renderHook(() => useFanCards())
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => authChange('user-a'))
    act(() => authChange(null))
    await act(async () => {
      deliver([
        {
          id: 'a-card',
          name: 'A',
          backNo: '1',
          tagline: 'FAN',
          tint: '#f00',
          pattern: 'halo',
          effect: 'brushed',
          photoPath: null,
          updatedAt: '2026-09-28T00:00:00Z',
        },
      ])
      await Promise.resolve()
    })

    expect(result.current.cards.find(c => c.id === 'a-card')).toBeUndefined()
  })
})

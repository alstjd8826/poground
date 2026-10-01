import { QueryClient } from '@tanstack/react-query'

import { clearOnViewerChange, persistsAcrossViewers } from '@/hooks/auth/viewerCaches'

jest.mock('@/repositories/remote/supabase', () => ({ supabase: { auth: {} } }))

/**
 * 커뮤니티·댓글 캐시에는 보는 사람의 좋아요와 차단 거르기가 들어 있는데 열쇠에 사람이 없다.
 * 계정이 바뀌면 앞사람의 하트가 30초쯤 남아 보였다 (2026-09-29)
 */
type Listener = (event: string, session: { user: { id: string } } | null) => void
function setup() {
  let listener: Listener = () => {}
  const auth = {
    onAuthStateChange: (cb: Listener) => {
      listener = cb
      return { data: { subscription: { unsubscribe: jest.fn() } } }
    },
  }
  const client = new QueryClient()
  client.setQueryData(['community', 'feed', 'all'], 'feed')
  client.setQueryData(['comments', 'post', 'p1'], 'comments')
  client.setQueryData(['reports', true], 'reports')
  client.setQueryData(['matches'], 'matches')
  clearOnViewerChange(client, auth)
  const has = (key: unknown[]) => client.getQueryData(key) !== undefined
  const as = (event: string, id: string | null) => listener(event, id ? { user: { id } } : null)
  return { has, as }
}

it('앱을 켜 같은 사람으로 이어지면 캐시를 둔다', () => {
  const { has, as } = setup()
  as('INITIAL_SESSION', 'a')
  as('TOKEN_REFRESHED', 'a')
  expect(has(['community', 'feed', 'all'])).toBe(true)
  expect(has(['comments', 'post', 'p1'])).toBe(true)
})

it('로그아웃하면 보는 사람에 딸린 캐시를 비우고 경기 캐시는 둔다', () => {
  const { has, as } = setup()
  as('INITIAL_SESSION', 'a')
  as('SIGNED_OUT', null)
  expect(has(['community', 'feed', 'all'])).toBe(false)
  expect(has(['comments', 'post', 'p1'])).toBe(false)
  expect(has(['reports', true])).toBe(false)
  expect(has(['matches'])).toBe(true)
})

it('다른 계정으로 바뀌면 비운다', () => {
  const { has, as } = setup()
  as('INITIAL_SESSION', 'a')
  as('SIGNED_IN', 'b')
  expect(has(['community', 'feed', 'all'])).toBe(false)
})

/** 앱이 꺼진 사이 세션이 끝났으면 기기에 남은 캐시는 앞사람의 것이다 */
it('로그아웃 상태로 켜지면 비운다', () => {
  const { has, as } = setup()
  as('INITIAL_SESSION', null)
  expect(has(['community', 'feed', 'all'])).toBe(false)
})

/**
 * 기기 저장 캐시는 마운트 뒤에 늦게 되살아난다. 로그아웃 상태로 켜 비운 뒤에 앞사람의 것이 되살아날 수
 * 있어, 보는 사람에 딸린 캐시는 아예 기기에 남기지 않는다 (0028 검토)
 */
it('보는 사람에 딸린 캐시는 기기에 남기지 않고 경기 캐시는 남긴다', () => {
  expect(persistsAcrossViewers(['community', 'feed', 'all'])).toBe(false)
  expect(persistsAcrossViewers(['comments', 'post', 'p1'])).toBe(false)
  expect(persistsAcrossViewers(['reports', true])).toBe(false)
  expect(persistsAcrossViewers(['matches'])).toBe(true)
})

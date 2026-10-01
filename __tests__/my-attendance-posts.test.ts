import { listMyAttendancePosts } from '@/repositories/community/remote'

/** 직관 기록에 띄울 내 직관 글 — 본문에 #직관, 안 지운 것, 나만 보기 포함 (4단계, 2026-09-29) */

const mockCalls: [string, string, ...unknown[]][] = []
jest.mock('@/repositories/remote/supabase', () => {
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const name of ['select', 'eq', 'is', 'ilike', 'filter', 'order', 'limit', 'in']) {
      chain[name] = (...args: unknown[]) => {
        mockCalls.push([table, name, ...args])
        return chain
      }
    }
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
    return chain
  }
  return { supabase: { from, auth: { getSession: async () => ({ data: { session: null } }) } } }
})
jest.mock('@/repositories/remote/imageUpload', () => ({ uploadPrivateImage: jest.fn() }))

beforeEach(() => {
  mockCalls.length = 0
})

it('내 글 중 #직관 이 있고 안 지운 것을 최신순으로 받는다', async () => {
  await listMyAttendancePosts('me')
  const posts = mockCalls.filter(([table]) => table === 'posts').map(([, ...rest]) => rest)
  expect(posts).toEqual(
    expect.arrayContaining([
      ['eq', 'author', 'me'],
      ['is', 'deleted_at', null],
      ['filter', 'body', 'match', '#직관([[:space:]#]|$)'],
      ['order', 'created_at', { ascending: false }],
      ['limit', 200],
    ]),
  )
})

/** 나만 보기 글은 커뮤니티 피드에 없다. 다시 찾아 들어갈 곳이 여기다 */
it('공개 여부로 거르지 않는다 — 나만 보기 글도 받는다', async () => {
  await listMyAttendancePosts('me')
  expect(
    mockCalls.some(([table, name, col]) => table === 'posts' && name === 'eq' && col === 'visibility'),
  ).toBe(false)
})

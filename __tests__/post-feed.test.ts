import { listFeed } from '@/repositories/community/remote'

/** 직관 글은 본문의 #직관 으로 가른다 (2026-09-29). 경기를 안 골라도 직관 글이다 */

const mockCalls: [string, ...unknown[]][] = []
jest.mock('@/repositories/remote/supabase', () => {
  const chain: Record<string, unknown> = {}
  for (const name of ['select', 'eq', 'is', 'order', 'limit', 'ilike', 'not', 'or', 'in', 'filter']) {
    chain[name] = (...args: unknown[]) => {
      mockCalls.push([name, ...args])
      return chain
    }
  }
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
  return { supabase: { from: () => chain } }
})
jest.mock('@/repositories/remote/imageUpload', () => ({ uploadPrivateImage: jest.fn() }))

beforeEach(() => {
  mockCalls.length = 0
})

it('직관 거르개는 본문에 #직관 이 있는 글만 받는다', async () => {
  await listFeed('attendance', null)
  expect(mockCalls).toContainEqual(['filter', 'body', 'match', '#직관([[:space:]#]|$)'])
})

it('자유 거르개는 #직관 이 없는 글만 받는다', async () => {
  await listFeed('free', null)
  expect(mockCalls).toContainEqual(['not', 'body', 'match', '#직관([[:space:]#]|$)'])
})

it('전체는 본문으로 거르지 않는다', async () => {
  await listFeed('all', null)
  expect(mockCalls.some(([name, col]) => name === 'filter' && col === 'body')).toBe(false)
  expect(mockCalls.some(([name, col]) => name === 'not' && col === 'body')).toBe(false)
})

/** 쪽 경계. 같은 시각의 글이 빠지거나 두 번 오지 않게 (시각, id) 로 잇는다 */
it('커서가 있으면 (작성 시각, id) 로 다음 쪽을 묻는다', async () => {
  await listFeed('all', { createdAt: '2026-09-29T01:00:00Z', id: 'p9' })
  expect(mockCalls).toContainEqual([
    'or',
    'created_at.lt.2026-09-29T01:00:00Z,and(created_at.eq.2026-09-29T01:00:00Z,id.lt.p9)',
  ])
})

it('첫 쪽은 커서 조건이 없다', async () => {
  await listFeed('all', null)
  expect(mockCalls.some(([name]) => name === 'or')).toBe(false)
})

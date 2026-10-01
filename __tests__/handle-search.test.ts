import { searchHandles } from '@/repositories/profile/search'

/** @ 를 칠 때 아이디 앞부분으로 찾는다 (2026-09-29) */

const mockCalls: [string, ...unknown[]][] = []
jest.mock('@/repositories/remote/supabase', () => {
  const chain: Record<string, unknown> = {}
  for (const name of ['select', 'ilike', 'order', 'limit']) {
    chain[name] = (...args: unknown[]) => {
      mockCalls.push([name, ...args])
      return chain
    }
  }
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [{ id: 'u1', handle: 'steel', avatar_url: null }], error: null })
  return { supabase: { from: (table: string) => (mockCalls.push(['from', table]), chain) } }
})

beforeEach(() => {
  mockCalls.length = 0
})

it('아이디 앞부분으로 다섯 명까지, 가나다순으로 찾는다', async () => {
  const found = await searchHandles('st')
  expect(found).toEqual([{ id: 'u1', handle: 'steel', avatarUrl: null }])
  expect(mockCalls).toEqual([
    ['from', 'profiles'],
    ['select', 'id,handle,avatar_url'],
    ['ilike', 'handle', 'st%'],
    ['order', 'handle'],
    ['limit', 5],
  ])
})

/** LIKE 에서 _ 는 "아무 글자 하나" 다. 그대로 넘기면 fan_ 을 쳤는데 fanX 도 걸린다 */
it('밑줄은 글자 그대로 찾는다', async () => {
  await searchHandles('fan_a')
  expect(mockCalls).toContainEqual(['ilike', 'handle', 'fan\\_a%'])
})

it('아이디에 없는 글자가 섞이면 묻지 않는다', async () => {
  expect(await searchHandles('st%')).toEqual([])
  expect(await searchHandles('')).toEqual([])
  expect(mockCalls).toEqual([])
})

import { listBlockedUsers } from '@/repositories/comment/remote'

/** 차단 목록에 사람 이름을 붙여 준다. 차단 표는 내 것만 읽힌다(0011 "own all") */

jest.mock('@/repositories/remote/supabase', () => {
  const rows: Record<string, unknown[]> = {
    user_blocks: [{ blocked: 'u1' }, { blocked: 'u2' }],
    profiles: [{ id: 'u1', handle: 'test_fan', avatar_url: null }],
  }
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    chain.select = () => chain
    chain.in = () => chain
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: rows[table], error: null })
    return chain
  }
  return { supabase: { from } }
})

it('차단한 사람마다 아이디와 사진을 붙인다. 프로필이 없어도 빠뜨리지 않는다', async () => {
  expect(await listBlockedUsers()).toEqual([
    { id: 'u1', handle: 'test_fan', avatarUrl: null },
    { id: 'u2', handle: null, avatarUrl: null },
  ])
})

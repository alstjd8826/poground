import { listMine, mark } from '@/repositories/attendance/remote'

/**
 * 옛 직관 사진은 글로 옮겨 갔다(4단계, 2026-09-29). 0027 이 photo_path 칸을 지우므로 앱이 그 칸을 부르면
 * 직관 기록 질의 전체가 깨진다 — 칸 이름이 어디에도 남으면 안 된다.
 */

const mockCalls: [string, unknown][] = []
jest.mock('@/repositories/remote/supabase', () => {
  const chain: Record<string, unknown> = {}
  for (const name of ['select', 'insert', 'upsert', 'eq', 'match', 'order', 'single', 'maybeSingle']) {
    chain[name] = (arg: unknown) => {
      mockCalls.push([name, arg])
      return chain
    }
  }
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: { year: 2026, league_id: 1, game_id: 1, updated_at: 't' }, error: null })
  return { supabase: { from: () => chain } }
})

beforeEach(() => {
  mockCalls.length = 0
})

it('읽을 때 옛 사진 칸을 부르지 않는다', async () => {
  await listMine().catch(() => {})
  const selects = mockCalls.filter(([name]) => name === 'select').map(([, cols]) => String(cols))
  expect(selects.length).toBeGreaterThan(0)
  for (const cols of selects) expect(cols).not.toMatch(/photo_path/)
})

it('표시할 때도 사진 칸을 보내지 않는다', async () => {
  await mark('me', { year: 2026, leagueId: 1, gameId: 1 }).catch(() => {})
  expect(JSON.stringify(mockCalls)).not.toMatch(/photo_path/)
})

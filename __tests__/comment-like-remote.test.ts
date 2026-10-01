import { likeComment, listCommentPage, unlikeComment } from '@/repositories/comment/remote'

/** 댓글 좋아요 — 읽을 때 수와 내가 눌렀는지를 함께 받고, 누르고 푼다 (2026-09-29) */

const mockWrites: [string, string, unknown][] = []
const mockReads: [string, string, unknown][] = []
let mockSession: { user: { id: string } } | null = { user: { id: 'me' } }

jest.mock('@/repositories/remote/supabase', () => {
  const comment = {
    id: 'c1',
    parent_id: null,
    author: 'u1',
    body: '좋은 경기',
    deleted_at: null,
    deleted_by_admin: false,
    created_at: 't',
  }
  const rows: Record<string, unknown[]> = {
    comments: [comment],
    profiles: [],
    comment_like_stats: [{ comment_id: 'c1', like_count: 2 }],
    comment_likes: [{ comment_id: 'c1' }],
  }
  const from = (table: string) => {
    let isReplies = false
    const chain: Record<string, unknown> = {}
    for (const name of ['select', 'is', 'order', 'range']) chain[name] = () => chain
    for (const name of ['eq', 'in']) {
      chain[name] = (col: string, value: unknown) => {
        mockReads.push([table, `${name}:${col}`, value])
        if (table === 'comments' && col === 'parent_id') isReplies = true
        return chain
      }
    }
    chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: table === 'comments' && isReplies ? [] : rows[table], count: 1, error: null })
    chain.insert = (payload: unknown) => {
      mockWrites.push([table, 'insert', payload])
      return Promise.resolve({ error: null })
    }
    chain.delete = () => {
      const filters: Record<string, unknown> = {}
      const del: Record<string, unknown> = {}
      del.eq = (col: string, value: unknown) => {
        filters[col] = value
        return del
      }
      del.then = (resolve: (v: unknown) => void) => {
        mockWrites.push([table, 'delete', filters])
        resolve({ error: null })
      }
      return del
    }
    return chain
  }
  return { supabase: { from, auth: { getSession: async () => ({ data: { session: mockSession } }) } } }
})

beforeEach(() => {
  mockWrites.length = 0
  mockReads.length = 0
  mockSession = { user: { id: 'me' } }
})

it('댓글 한 쪽을 읽을 때 좋아요 수와 내가 눌렀는지 함께 받는다', async () => {
  const page = await listCommentPage({ type: 'match', id: '180' }, 0)
  expect(page.comments[0]).toMatchObject({ id: 'c1', likeCount: 2, likedByMe: true })
  expect(mockReads).toContainEqual(['comment_likes', 'eq:user_id', 'me'])
})

it('로그인 전이면 내 좋아요는 묻지 않는다', async () => {
  mockSession = null
  const page = await listCommentPage({ type: 'match', id: '180' }, 0)
  expect(page.comments[0]).toMatchObject({ likeCount: 2, likedByMe: false })
  expect(mockReads.some(([table]) => table === 'comment_likes')).toBe(false)
})

it('누르고 푼다', async () => {
  await likeComment('c1', 'me')
  await unlikeComment('c1', 'me')
  expect(mockWrites).toEqual([
    ['comment_likes', 'insert', { comment_id: 'c1', user_id: 'me' }],
    ['comment_likes', 'delete', { comment_id: 'c1', user_id: 'me' }],
  ])
})

import { adminDeletePost, getPost, likePost, reportPost, unlikePost } from '@/repositories/community/remote'

/** 좋아요 누르기·풀기와, 글을 읽을 때 내가 누른 글인지 함께 받기 (2026-09-29) */

const mockWrites: [string, string, unknown][] = []
const mockReads: [string, string, unknown][] = []
let mockSession: { user: { id: string } } | null = { user: { id: 'me' } }
const mockRpc = jest.fn()

jest.mock('@/repositories/remote/supabase', () => {
  const rows: Record<string, unknown[]> = {
    posts: [
      {
        id: 'p1',
        author: 'u1',
        body: 'x',
        visibility: 'public',
        match_year: null,
        match_league_id: null,
        match_game_id: null,
        created_at: 't',
        updated_at: 't',
        post_photos: [],
      },
    ],
    profiles: [],
    post_stats: [{ post_id: 'p1', like_count: 1, comment_count: 0 }],
    post_likes: [{ post_id: 'p1' }],
  }
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const name of ['select', 'is', 'order', 'limit']) chain[name] = () => chain
    for (const name of ['eq', 'in']) {
      chain[name] = (col: string, value: unknown) => {
        mockReads.push([table, `${name}:${col}`, value])
        return chain
      }
    }
    chain.maybeSingle = async () => ({ data: rows[table]![0], error: null })
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: rows[table], error: null })
    chain.upsert = (row: unknown, options: unknown) => {
      mockWrites.push([table, 'upsert', { row, options }])
      return Promise.resolve({ error: null })
    }
    chain.insert = (payload: unknown) => {
      mockWrites.push([table, 'insert', payload])
      return Promise.resolve({ error: null })
    }
    chain.delete = () => {
      const del: Record<string, unknown> = {}
      const filters: Record<string, unknown> = {}
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
  return {
    supabase: {
      from,
      rpc: (...args: unknown[]) => {
        mockRpc(...args)
        return Promise.resolve({ error: null })
      },
      auth: { getSession: async () => ({ data: { session: mockSession } }) },
    },
  }
})
jest.mock('@/repositories/remote/imageUpload', () => ({ uploadPrivateImage: jest.fn() }))

beforeEach(() => {
  mockWrites.length = 0
  mockReads.length = 0
  mockSession = { user: { id: 'me' } }
})

it('누르면 내 이름으로 좋아요를 남긴다', async () => {
  await likePost('p1', 'me')
  expect(mockWrites).toEqual([['post_likes', 'insert', { post_id: 'p1', user_id: 'me' }]])
})

it('풀면 내 좋아요만 지운다', async () => {
  await unlikePost('p1', 'me')
  expect(mockWrites).toEqual([['post_likes', 'delete', { post_id: 'p1', user_id: 'me' }]])
})

it('로그인했으면 글을 읽을 때 내가 누른 글인지 함께 받는다', async () => {
  const post = await getPost('p1')
  expect(post?.likedByMe).toBe(true)
  expect(mockReads).toContainEqual(['post_likes', 'eq:user_id', 'me'])
})

it('로그인 전이면 좋아요 목록을 묻지 않는다', async () => {
  mockSession = null
  const post = await getPost('p1')
  expect(post?.likedByMe).toBe(false)
  expect(mockReads.some(([table]) => table === 'post_likes')).toBe(false)
})

/** 신고와 관리자 삭제 (3단계, 2026-09-29) */
describe('신고와 관리자 삭제', () => {
  it('같은 글을 다시 신고해도 조용히 넘긴다', async () => {
    await reportPost('p1', 'me', '욕설')
    expect(mockWrites).toContainEqual([
      'post_reports',
      'upsert',
      {
        row: { post_id: 'p1', reporter: 'me', reason: '욕설' },
        options: { onConflict: 'post_id,reporter', ignoreDuplicates: true },
      },
    ])
  })

  it('관리자 삭제는 서버 함수로 한다', async () => {
    await adminDeletePost('p1')
    expect(mockRpc).toHaveBeenCalledWith('admin_delete_post', { p_id: 'p1' })
  })
})

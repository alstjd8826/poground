import { FEED_PAGE, nextCursor, type Post, withoutBlocked } from '@/models/community'
import { toPost } from '@/repositories/community/remote'

jest.mock('@/repositories/remote/supabase', () => ({ supabase: {} }))

const post = (id: string, createdAt: string, authorId = 'a'): Post => ({
  id,
  authorId,
  handle: null,
  nickname: null,
  avatarUrl: null,
  body: '글',
  visibility: 'public',
  match: null,
  photos: [],
  likeCount: 0,
  likedByMe: false,
  commentCount: 0,
  createdAt,
  updatedAt: createdAt,
})

describe('다음 쪽', () => {
  it('한 쪽이 꽉 차면 마지막 글이 커서가 된다', () => {
    const page = Array.from({ length: FEED_PAGE }, (_, i) =>
      post(`p${i}`, `2026-09-28T00:00:${String(59 - i).padStart(2, '0')}Z`),
    )
    expect(nextCursor(page)).toEqual({
      createdAt: page[FEED_PAGE - 1]!.createdAt,
      id: page[FEED_PAGE - 1]!.id,
    })
  })

  it('덜 차면 끝이다', () => {
    expect(nextCursor([post('p1', '2026-09-28T00:00:00Z')])).toBeNull()
  })
})

describe('차단', () => {
  it('차단한 사람의 글은 뺀다', () => {
    const posts = [post('1', 'x', 'kim'), post('2', 'x', 'lee')]
    expect(withoutBlocked(posts, ['lee']).map(p => p.id)).toEqual(['1'])
  })
})

describe('행 옮기기', () => {
  const row = {
    id: 'p1',
    author: 'u1',
    body: '직관 다녀왔어요',
    visibility: 'private' as const,
    match_year: 2026,
    match_league_id: 1,
    match_game_id: 180,
    created_at: '2026-09-28T00:00:00Z',
    updated_at: '2026-09-28T01:00:00Z',
    post_photos: [
      { position: 1, path: 'u1/p1/1' },
      { position: 0, path: 'u1/p1/0' },
    ],
  }

  it('사진은 순서대로, 경기는 키로, 통계와 프로필을 붙인다', () => {
    const post = toPost(
      row,
      new Map([['u1', { id: 'u1', handle: 'steel', nickname: '김포항', avatar_url: null }]]),
      new Map([['p1', { post_id: 'p1', like_count: 3, comment_count: 2 }]]),
    )
    expect(post.photos.map(p => p.position)).toEqual([0, 1])
    expect(post.match).toEqual({ year: 2026, leagueId: 1, gameId: 180 })
    expect(post).toMatchObject({
      handle: 'steel',
      nickname: '김포항',
      likeCount: 3,
      commentCount: 2,
      visibility: 'private',
    })
  })

  it('내가 좋아요 누른 글인지 붙인다', () => {
    expect(toPost(row, new Map(), new Map(), new Set(['p1'])).likedByMe).toBe(true)
    expect(toPost(row, new Map(), new Map(), new Set()).likedByMe).toBe(false)
  })

  /** 닉네임을 아직 안 정한 사람의 글도 깨지지 않고 그려져야 한다 */
  it('프로필과 통계가 없어도 옮긴다', () => {
    const post = toPost(
      { ...row, match_year: null, match_league_id: null, match_game_id: null },
      new Map(),
      new Map(),
    )
    expect(post).toMatchObject({ handle: null, nickname: null, likeCount: 0, commentCount: 0, match: null })
  })
})

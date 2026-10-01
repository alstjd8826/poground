import { toThreads } from '@/hooks/comment/useComments'
import type { Comment } from '@/repositories/comment/remote'

const at = (id: string, parentId: string | null = null): Comment => ({
  id,
  parentId,
  authorId: 'u1',
  handle: 'pohang_fan',
  avatarUrl: null,
  body: id,
  deleted: false,
  deletedByAdmin: false,
  createdAt: '2026-09-21T00:00:00Z',
  likeCount: 0,
  likedByMe: false,
})

/**
 * 평평하게 받은 댓글을 부모-답글로 묶는다.
 *
 * 서버는 한 경기의 댓글을 한 줄로 내려준다. 두 번 나눠 물으면 답글이 늦게 붙어 목록이
 * 한 번 출렁이므로 한 번에 받고 여기서 묶는다.
 */
describe('댓글 묶기', () => {
  it('답글을 제 부모 밑에 붙인다', () => {
    const threads = toThreads([at('a'), at('b'), at('a-1', 'a'), at('a-2', 'a')])

    expect(threads.map(t => t.root.id)).toEqual(['a', 'b'])
    expect(threads[0]!.replies.map(c => c.id)).toEqual(['a-1', 'a-2'])
    expect(threads[1]!.replies).toEqual([])
  })

  /**
   * 부모가 목록에 없는 답글은 맨 위로 올린다.
   *
   * 차단한 사람이 쓴 부모를 걸러 냈거나 부모가 지워진 경우다. 그냥 버리면 남이 쓴 글이
   * 이유 없이 사라진다.
   */
  it('부모를 못 찾은 답글도 보여 준다', () => {
    const threads = toThreads([at('a'), at('x-1', 'x')])

    expect(threads.map(t => t.root.id)).toEqual(['a', 'x-1'])
  })

  /** 답글의 답글은 한 단으로 눌린다. 안 그러면 들여쓰기가 끝없이 깊어진다 */
  it('답글에 달린 답글은 그 답글의 부모를 못 찾으므로 위로 올라간다', () => {
    const threads = toThreads([at('a'), at('a-1', 'a'), at('a-1-1', 'a-1')])

    expect(threads.map(t => t.root.id)).toEqual(['a', 'a-1-1'])
    expect(threads[0]!.replies.map(c => c.id)).toEqual(['a-1'])
  })
})

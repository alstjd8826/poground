import { nextCommentPage } from '@/hooks/comment/useComments'
import type { Comment, CommentPage } from '@/repositories/comment/remote'

/** 세는 것은 맨 위 댓글뿐이다. 답글은 부모를 따라오므로 쪽을 끊는 단위가 아니다 */
function page(roots: number, replies: number, totalRoots: number): CommentPage {
  const one = (id: string, parentId: string | null): Comment => ({
    id,
    parentId,
    authorId: 'u',
    handle: null,
    avatarUrl: null,
    body: '',
    deleted: false,
    deletedByAdmin: false,
    createdAt: '2026-01-01T00:00:00Z',
    likeCount: 0,
    likedByMe: false,
  })
  return {
    totalRoots,
    comments: [
      ...Array.from({ length: roots }, (_, i) => one(`r${i}`, null)),
      ...Array.from({ length: replies }, (_, i) => one(`c${i}`, 'r0')),
    ],
  }
}

describe('댓글 다음 쪽', () => {
  it('아직 남았으면 다음 쪽 번호를 준다', () => {
    expect(nextCommentPage([page(20, 0, 55)])).toBe(1)
    expect(nextCommentPage([page(20, 0, 55), page(20, 0, 55)])).toBe(2)
  })

  it('다 받았으면 더 없다고 한다', () => {
    expect(nextCommentPage([page(20, 0, 55), page(20, 0, 55), page(15, 0, 55)])).toBeUndefined()
  })

  it('답글은 세지 않는다', () => {
    // 답글까지 세면 20 + 40 = 60 이 되어 55 를 넘겨 끝난 것으로 본다
    expect(nextCommentPage([page(20, 40, 55)])).toBe(1)
  })

  it('처음부터 비었으면 더 없다', () => {
    expect(nextCommentPage([page(0, 0, 0)])).toBeUndefined()
    expect(nextCommentPage([])).toBeUndefined()
  })

  it('딱 한 쪽으로 끝나면 더 없다', () => {
    expect(nextCommentPage([page(20, 3, 20)])).toBeUndefined()
  })
})

import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { type InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { commentKeys, useCommentLike } from '@/hooks/comment/useComments'
import type { Comment, CommentPage, CommentSubject } from '@/repositories/comment/remote'

/** 댓글 좋아요도 게시글 좋아요처럼 — 즉시 반영, 실패하면 되돌림, 끝날 때까지 잠금 (스펙 오류 처리) */

jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }))
jest.mock('@/repositories/comment/remote', () => ({ likeComment: jest.fn(), unlikeComment: jest.fn() }))
const remote = jest.requireMock('@/repositories/comment/remote') as {
  likeComment: jest.Mock
  unlikeComment: jest.Mock
}

const subject: CommentSubject = { type: 'match', id: '180' }
const comment = (on: boolean, count: number): Comment => ({
  id: 'c1',
  parentId: null,
  authorId: 'u1',
  handle: 'u',
  avatarUrl: null,
  body: 'x',
  deleted: false,
  deletedByAdmin: false,
  createdAt: 't',
  likeCount: count,
  likedByMe: on,
})

let client: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
const read = () =>
  (client.getQueryData(commentKeys.comments(subject)) as InfiniteData<CommentPage>).pages[0]!.comments[0]

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  client.setQueryData(commentKeys.comments(subject), {
    pages: [{ comments: [comment(false, 1)], totalRoots: 1 }],
    pageParams: [0],
  })
  remote.likeComment.mockReset()
  remote.unlikeComment.mockReset()
})
afterEach(() => client.clear())

it('누르는 즉시 반영한다', async () => {
  let finish: () => void = () => {}
  remote.likeComment.mockReturnValue(new Promise<void>(r => (finish = r)))
  const { result } = renderHook(() => useCommentLike(subject), { wrapper })
  let done: Promise<void> = Promise.resolve()
  act(() => {
    done = result.current.toggle(comment(false, 1))
  })
  expect(read()).toMatchObject({ likedByMe: true, likeCount: 2 })
  expect(remote.likeComment).toHaveBeenCalledWith('c1', 'me')
  finish()
  await act(() => done)
})

it('실패하면 되돌린다', async () => {
  remote.likeComment.mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useCommentLike(subject), { wrapper })
  await act(async () => {
    await expect(result.current.toggle(comment(false, 1))).rejects.toThrow('network')
  })
  expect(read()).toMatchObject({ likedByMe: false, likeCount: 1 })
})

it('끝나기 전에 또 누르면 한 번만 보낸다', async () => {
  let finish: () => void = () => {}
  remote.likeComment.mockReturnValue(new Promise<void>(r => (finish = r)))
  const { result } = renderHook(() => useCommentLike(subject), { wrapper })
  let first: Promise<void> = Promise.resolve()
  act(() => {
    first = result.current.toggle(comment(false, 1))
    void result.current.toggle(comment(true, 2))
  })
  expect(remote.likeComment).toHaveBeenCalledTimes(1)
  expect(remote.unlikeComment).not.toHaveBeenCalled()
  finish()
  await act(() => first)
})

it('누른 댓글을 다시 누르면 푼다', async () => {
  remote.unlikeComment.mockResolvedValue(undefined)
  const { result } = renderHook(() => useCommentLike(subject), { wrapper })
  await act(() => result.current.toggle(comment(true, 1)))
  expect(remote.unlikeComment).toHaveBeenCalledWith('c1', 'me')
})

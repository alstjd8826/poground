import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { CommentList } from '@/components/comment/CommentList'
import type { Comment } from '@/repositories/comment/remote'

/** 댓글과 답글에 하트. 지워진 댓글·차단한 사람의 댓글에는 없다 (2026-09-29) */

const c = (id: string, over: Partial<Comment> = {}): Comment => ({
  id,
  parentId: null,
  authorId: 'u1',
  handle: 'u',
  avatarUrl: null,
  body: `본문 ${id}`,
  deleted: false,
  deletedByAdmin: false,
  createdAt: new Date().toISOString(),
  likeCount: 1,
  likedByMe: false,
  ...over,
})

let mockThreads: { root: Comment; replies: Comment[] }[] = []
let mockBlocked = new Set<string>()
const mockLike = { toggle: jest.fn(async () => {}), signedIn: true }
jest.mock('@/hooks/comment/useComments', () => ({
  useComments: () => ({
    threads: mockThreads,
    rest: 0,
    blockedIds: mockBlocked,
    comments: { isPending: false, isError: false, isFetchingNextPage: false },
    me: 'me',
    isAdmin: false,
    remove: { mutate: jest.fn() },
    report: { mutateAsync: jest.fn() },
    block: { mutate: jest.fn() },
    unblock: { mutate: jest.fn() },
  }),
  useCommentLike: () => mockLike,
}))

// 신고 시트(BottomSheet)가 안전 영역을 읽는다
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}
const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider initialPreference="home">{ui}</ThemeProvider>
    </SafeAreaProvider>,
  )
const subject = { type: 'match' as const, id: '180' }

beforeEach(() => {
  mockThreads = [{ root: c('c1'), replies: [c('r1', { parentId: 'c1', likeCount: 3, likedByMe: true })] }]
  mockBlocked = new Set()
  mockLike.toggle.mockClear()
  mockLike.signedIn = true
})

it('댓글과 답글에 하트가 있고 누르면 좋아요를 보낸다', () => {
  wrap(<CommentList subject={subject} onReply={jest.fn()} />)
  fireEvent.press(screen.getByRole('button', { name: '좋아요 1' }))
  expect(mockLike.toggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }))
  expect(screen.getByRole('button', { name: '좋아요 3' }).props.accessibilityState).toMatchObject({
    selected: true,
  })
})

it('지워진 댓글과 차단한 사람의 댓글에는 하트가 없다', () => {
  mockThreads = [
    { root: c('c1', { deleted: true, body: '' }), replies: [] },
    { root: c('c2', { authorId: 'bad', likeCount: 5 }), replies: [] },
  ]
  mockBlocked = new Set(['bad'])
  wrap(<CommentList subject={subject} onReply={jest.fn()} />)
  expect(screen.queryByRole('button', { name: /좋아요/ })).toBeNull()
})

it('로그인 전이면 로그인부터 청한다', () => {
  mockLike.signedIn = false
  const onRequireLogin = jest.fn()
  wrap(<CommentList subject={subject} onReply={jest.fn()} onRequireLogin={onRequireLogin} />)
  fireEvent.press(screen.getByRole('button', { name: '좋아요 1' }))
  expect(onRequireLogin).toHaveBeenCalled()
  expect(mockLike.toggle).not.toHaveBeenCalled()
})

/** 탈퇴한 사람의 댓글은 자리만 남는다(0029). 글쓴이 칸이 비어 온다. 거기 달린 남의 답글은 그대로 보인다 */
it('탈퇴한 사람의 댓글은 탈퇴 자리로 보이고 답글은 남는다', () => {
  mockThreads = [
    {
      root: c('c1', { authorId: null, handle: null, deleted: true, body: '' }),
      replies: [c('r1', { parentId: 'c1', body: '남의 답글' })],
    },
  ]
  wrap(<CommentList subject={subject} onReply={jest.fn()} />)
  expect(screen.getByText('탈퇴한 사용자의 댓글입니다')).toBeTruthy()
  expect(screen.queryByText('지워진 댓글입니다')).toBeNull()
  expect(screen.getByText('남의 답글')).toBeTruthy()
})

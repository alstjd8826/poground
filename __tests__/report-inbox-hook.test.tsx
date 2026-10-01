import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useReports } from '@/hooks/comment/useReports'
import type { Report } from '@/repositories/comment/reports'

/**
 * 신고함의 지우기. 관리자도 남의 나만 보기 글에 달린 댓글은 읽기 정책에 걸려, 그냥 update 로 지우면
 * 조용히 0 행이 되고 신고만 "처리됨" 이 됐다(3단계 검토 I1). 댓글도 관리자 함수로 지운다.
 */

jest.mock('@/repositories/comment/reports', () => ({
  REPORT_PAGE: 30,
  listReports: jest.fn(async () => []),
  resolveReport: jest.fn(async () => {}),
}))
jest.mock('@/repositories/comment/remote', () => ({ adminDeleteComment: jest.fn(async () => {}) }))
jest.mock('@/repositories/community/remote', () => ({ adminDeletePost: jest.fn(async () => {}) }))
const reports = jest.requireMock('@/repositories/comment/reports') as { resolveReport: jest.Mock }
const comments = jest.requireMock('@/repositories/comment/remote') as { adminDeleteComment: jest.Mock }
const posts = jest.requireMock('@/repositories/community/remote') as { adminDeletePost: jest.Mock }

let client: QueryClient
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
const report = (kind: 'comment' | 'post', targetId: string) => ({ kind, targetId }) as Report

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => client.clear())

it('댓글 신고를 지우면 관리자 함수로 지우고 처리한다', async () => {
  const { result } = renderHook(() => useReports(), { wrapper })
  await act(() => result.current.removeAndResolve.mutateAsync(report('comment', 'c1')))
  expect(comments.adminDeleteComment).toHaveBeenCalledWith('c1')
  expect(reports.resolveReport).toHaveBeenCalledWith(report('comment', 'c1'))
})

it('게시글 신고를 지우면 관리자 게시글 삭제로 간다', async () => {
  const { result } = renderHook(() => useReports(), { wrapper })
  await act(() => result.current.removeAndResolve.mutateAsync(report('post', 'p1')))
  expect(posts.adminDeletePost).toHaveBeenCalledWith('p1')
})

it('지우기가 실패하면 처리 표시를 하지 않는다', async () => {
  comments.adminDeleteComment.mockRejectedValueOnce(new Error('권한'))
  reports.resolveReport.mockClear()
  const { result } = renderHook(() => useReports(), { wrapper })
  await act(async () => {
    await expect(result.current.removeAndResolve.mutateAsync(report('comment', 'c1'))).rejects.toThrow('권한')
  })
  expect(reports.resolveReport).not.toHaveBeenCalled()
})

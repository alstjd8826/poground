import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { ReportInboxScreen } from '@/screens/ReportInboxScreen'
import type { Report } from '@/repositories/comment/reports'

/** 신고함 화면이 게시글 신고를 게시글로 적고, 지우기는 게시글을 내린다 (3단계, 2026-09-29) */

const report = (over: Partial<Report>): Report => ({
  kind: 'comment',
  targetId: 'c1',
  count: 1,
  lastReportedAt: new Date().toISOString(),
  resolved: false,
  reasons: [],
  subject: { type: 'match', id: '180' },
  body: '본문',
  authorId: 'a',
  handle: 'aa',
  deleted: false,
  ...over,
})

const mockRemove = jest.fn()
let mockReports: Report[] = []
jest.mock('@/hooks/comment/useReports', () => ({
  useReports: () => ({
    reports: mockReports,
    query: {
      isPending: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: jest.fn(),
    },
    onlyOpen: true,
    setOnlyOpen: jest.fn(),
    resolve: { mutate: jest.fn(), isPending: false },
    removeAndResolve: { mutate: mockRemove, isPending: false },
  }),
}))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

beforeEach(() => mockRemove.mockClear())
afterEach(() => jest.restoreAllMocks())

it('게시글 신고는 게시글로, 댓글 신고는 달린 곳의 댓글로 적는다', () => {
  mockReports = [
    report({ kind: 'post', targetId: 'p1', subject: { type: 'post', id: 'p1' }, body: '문제의 글' }),
    report({}),
  ]
  wrap(<ReportInboxScreen />)
  expect(screen.getByText('게시글 · @aa')).toBeTruthy()
  expect(screen.getByLabelText('신고된 게시글 보기')).toBeTruthy()
  expect(screen.getByText('경기 댓글 · @aa')).toBeTruthy()
  expect(screen.getByLabelText('경기에 달린 신고된 댓글 보기')).toBeTruthy()
})

it('게시글 신고의 지우기는 그 신고를 넘겨 게시글을 내린다', () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find(b => b.style === 'destructive')?.onPress?.()
  })
  const post = report({ kind: 'post', targetId: 'p1', subject: { type: 'post', id: 'p1' } })
  mockReports = [post]
  wrap(<ReportInboxScreen />)
  fireEvent.press(screen.getByText('글 지우기'))
  expect(mockRemove).toHaveBeenCalledWith(post)
})

it('지워진 게시글은 지워진 글이라고 적는다', () => {
  mockReports = [report({ kind: 'post', targetId: 'p1', subject: { type: 'post', id: 'p1' }, deleted: true })]
  wrap(<ReportInboxScreen />)
  expect(screen.getByText('이미 지워진 글입니다')).toBeTruthy()
})

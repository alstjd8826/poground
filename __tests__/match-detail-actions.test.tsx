import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { MatchDetailScreen } from '@/screens/MatchDetailScreen'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'
import { ticketUrlOf } from '@/models/kleague'
import { SEASON_YEAR } from '@/config/env'

/**
 * 경기 상세 위쪽의 할 일. 예매할 수 있는 경기는 [티켓 예매] 를 크게, 직관 예정은 그 옆 작은
 * 토글로 둔다 (2026-09-29). 강조 단추 둘이 위아래로 쌓이면 무엇을 먼저 할지 흐려진다.
 */

jest.mock('@/hooks/query/useKleague', () => ({
  useMatchLineup: () => ({ data: undefined, isPending: true, isError: false }),
  useMatchVideos: () => ({ data: [], isPending: false, isError: false }),
}))
let mockRows: unknown[] = []
jest.mock('@/hooks/attendance/useAttendances', () => ({
  useAttendances: () => ({
    rows: mockRows,
    signedIn: true,
    toggle: jest.fn(),
  }),
}))
let mockMyPosts: unknown[] = []
jest.mock('@/hooks/community/useCommunity', () => ({
  useMyAttendancePosts: () => ({ posts: mockMyPosts, query: { isPending: false } }),
  usePostLike: () => ({ toggle: jest.fn(async () => {}), signedIn: true }),
  usePostPhoto: () => null,
}))
jest.mock('@/components/community/usePostMenu', () => ({
  usePostMenu: () => ({ menuFor: () => undefined, sheet: null }),
}))
jest.mock('@/components/comment/CommentList', () => ({ CommentList: () => null }))
jest.mock('@/components/comment/CommentComposer', () => ({ CommentComposer: () => null }))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
const withTicket = { ...mockMatchScheduled, ticketUrl: 'https://ticket.example' }

it('예매할 수 있으면 [티켓 예매] 와 작은 직관 예정 토글이 함께 선다', () => {
  expect(ticketUrlOf(withTicket)).toBeTruthy()
  const onOpenTicket = jest.fn()
  wrap(<MatchDetailScreen match={withTicket} round={1} onOpenTicket={onOpenTicket} />)
  fireEvent.press(screen.getByText('티켓 예매'))
  expect(onOpenTicket).toHaveBeenCalledWith(withTicket)
  expect(screen.getByRole('checkbox', { name: '이 경기 직관 가요' })).toBeTruthy()
})

it('끝난 경기에는 예매가 없고 직관했어요 체크 칸만 있다', () => {
  wrap(<MatchDetailScreen match={mockMatchFinished} round={1} />)
  expect(screen.queryByText('티켓 예매')).toBeNull()
  expect(screen.getByRole('checkbox', { name: '이 경기 직관했어요' })).toBeTruthy()
})

it('직관한 경기의 [직관 글 쓰기] 는 그 경기로 글쓰기를 연다', () => {
  mockRows = [{ year: SEASON_YEAR, leagueId: 1, gameId: mockMatchFinished.id, updatedAt: 'x' }]
  const onWritePost = jest.fn()
  wrap(<MatchDetailScreen match={mockMatchFinished} round={1} onWritePost={onWritePost} />)
  fireEvent.press(screen.getByText('직관 글 쓰기'))
  expect(onWritePost).toHaveBeenCalledWith(mockMatchFinished)
  mockRows = []
})

/** 그 경기에 쓴 내 직관 글은 경기 상세에서도 보인다 (4단계, 2026-09-29) */
it('그 경기에 쓴 내 글이 있으면 카드로 보인다', () => {
  mockMyPosts = [
    {
      id: 'p1',
      authorId: 'me',
      handle: 'poground',
      nickname: null,
      avatarUrl: null,
      body: '그날 최고였다\n#직관',
      visibility: 'private',
      match: { year: SEASON_YEAR, leagueId: 1, gameId: mockMatchFinished.id },
      photos: [],
      likeCount: 0,
      likedByMe: false,
      commentCount: 0,
      createdAt: 't',
      updatedAt: 't',
    },
  ]
  wrap(<MatchDetailScreen match={mockMatchFinished} round={1} />)
  expect(screen.getByText(/그날 최고였다/)).toBeTruthy()
  mockMyPosts = []
})

it('다른 경기의 글은 보이지 않는다', () => {
  mockMyPosts = [
    {
      id: 'p2',
      body: '다른 경기 #직관',
      match: { year: SEASON_YEAR, leagueId: 1, gameId: 99999 },
      photos: [],
      visibility: 'public',
      createdAt: 't',
      updatedAt: 't',
    },
  ]
  wrap(<MatchDetailScreen match={mockMatchFinished} round={1} />)
  expect(screen.queryByText(/다른 경기/)).toBeNull()
  mockMyPosts = []
})

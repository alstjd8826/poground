import React from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AttendanceScreen } from '@/screens/AttendanceScreen'
import { SEASON_YEAR } from '@/config/env'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'
import type { Post } from '@/models/community'

const mockState = {
  rows: [] as unknown[],
  signedIn: true,
  query: { isPending: false, isError: false, data: [], refetch: jest.fn() },
}
jest.mock('@/hooks/attendance/useAttendances', () => ({
  useAttendances: () => mockState,
}))
let mockPosts: Post[] = []
let mockPostsQuery = { isPending: false, isError: false, refetch: jest.fn() }
jest.mock('@/hooks/community/useCommunity', () => ({
  useMyAttendancePosts: () => ({ posts: mockPosts, query: mockPostsQuery }),
  usePostLike: () => ({ toggle: jest.fn(async () => {}), signedIn: true }),
  usePostPhoto: () => null,
}))
jest.mock('@/components/community/usePostMenu', () => ({
  usePostMenu: () => ({ menuFor: () => undefined, sheet: null }),
}))
jest.mock('@/hooks/query/useKleague', () => ({
  useMatches: () => ({ data: [mockMatchFinished, mockMatchScheduled] }),
}))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
const attended = (gameId: number) => ({
  year: SEASON_YEAR,
  leagueId: 1,
  gameId,
  updatedAt: 'x',
})

describe('직관 기록 화면', () => {
  it('기록이 없으면 안내한다', () => {
    mockState.rows = []
    wrap(<AttendanceScreen />)
    expect(screen.getByText(/직관했어요/)).toBeTruthy()
  })

  it('로그인 전이면 로그인을 안내한다', () => {
    mockState.signedIn = false
    wrap(<AttendanceScreen />)
    expect(screen.getByText(/로그인/)).toBeTruthy()
    mockState.signedIn = true
  })

  /** 픽스처의 끝난 경기는 2:2 무승부다. 승률 0%, 예정 1경기 */
  it('요약과 예정 경기를 보여 준다', () => {
    mockState.rows = [attended(mockMatchFinished.id), attended(mockMatchScheduled.id)]
    wrap(<AttendanceScreen />)
    expect(screen.getByText('승리요정 0%')).toBeTruthy()
    expect(screen.getByText(/직관 2경기 · 0승 1무 0패/)).toBeTruthy()
    expect(screen.getByText(/예정 1경기/)).toBeTruthy()
  })
})

/** 직관 기록이 내 직관 글 피드가 된다 (4단계, 2026-09-29) */
describe('내 직관 글', () => {
  const mine = (over: Partial<Post>): Post => ({
    id: 'p1',
    authorId: 'me',
    handle: 'poground',
    nickname: null,
    avatarUrl: null,
    body: '오늘 좋았다\n#직관',
    visibility: 'public',
    match: { year: SEASON_YEAR, leagueId: 1, gameId: mockMatchFinished.id },
    photos: [],
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  })

  afterEach(() => {
    mockPosts = []
  })

  /** 3열 격자다 (2026-09-29). 글 칸을 누르면 글로, 좋아요·수정은 상세에서 */
  it('글이 붙은 경기는 글 칸 하나, 누르면 그 글을 연다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    const post = mine({})
    mockPosts = [post]
    const onOpenPost = jest.fn()
    wrap(<AttendanceScreen onOpenPost={onOpenPost} />)
    fireEvent.press(screen.getByLabelText(/글 열기: 오늘 좋았다/))
    expect(onOpenPost).toHaveBeenCalledWith(post)
    // 글이 붙은 경기에는 글 쓰기 칸을 따로 두지 않는다
    expect(screen.queryByLabelText('이 경기 글 쓰기')).toBeNull()
  })

  it('나만 보기 글 칸에는 자물쇠가 붙는다', () => {
    mockPosts = [mine({ visibility: 'private' })]
    wrap(<AttendanceScreen />)
    expect(screen.getByLabelText('나만 보기')).toBeTruthy()
  })

  it('사진이 여러 장인 글 칸에는 여러 장 표시가 붙는다', () => {
    mockPosts = [
      mine({
        photos: [
          { position: 0, path: 'me/p1/a' },
          { position: 1, path: 'me/p1/b' },
        ],
      }),
    ]
    wrap(<AttendanceScreen />)
    expect(screen.getByLabelText('사진 여러 장')).toBeTruthy()
  })

  it('글 없이 체크만 한 경기 칸은 누르면 그 경기로 글쓰기를 연다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    const onWritePost = jest.fn()
    wrap(<AttendanceScreen onWritePost={onWritePost} />)
    fireEvent.press(screen.getByLabelText('이 경기 글 쓰기'))
    expect(onWritePost).toHaveBeenCalledWith(mockMatchFinished)
  })

  /** 글만 있으면 텍스트만 덜렁 있어 어색했다 — 따옴표와 쓴 날짜를 둔 카드로 (2026-09-29) */
  it('글만 있는 칸은 쓴 날짜를 단 카드로 보인다', () => {
    mockPosts = [mine({ match: null, body: '비 와도 간다\n#직관', createdAt: '2026-09-29T03:00:00Z' })]
    wrap(<AttendanceScreen />)
    expect(screen.getByText('비 와도 간다')).toBeTruthy()
    expect(screen.getByText('9.29')).toBeTruthy()
    expect(screen.getByText('“')).toBeTruthy()
    expect(screen.getByText('”')).toBeTruthy()
  })

  /** 사진 칸에도 승패를 연하게 (2026-09-29). 픽스처 끝난 경기는 2:2 무승부 */
  /** 사진 없는 칸의 스코어를 그대로, 결과 색을 반쯤 비치게 해서 사진 위에 얹는다 */
  it('경기가 붙은 사진 글 칸에는 스코어가 사진 위에 연하게 얹힌다', () => {
    mockPosts = [mine({ photos: [{ position: 0, path: 'me/p1/a' }] })]
    wrap(<AttendanceScreen />)
    expect(screen.getByText('무')).toBeTruthy()
    expect(screen.getByText('2:2')).toBeTruthy()
    expect(screen.queryByText('무 2:2')).toBeNull()
    expect(StyleSheet.flatten(screen.getByLabelText('스코어 겹침').props.style).opacity).toBeLessThan(1)
  })

  it('경기 없는 사진 글 칸에는 승패가 없다', () => {
    mockPosts = [mine({ match: null, photos: [{ position: 0, path: 'me/p1/a' }] })]
    wrap(<AttendanceScreen />)
    expect(screen.queryByText('2:2')).toBeNull()
  })

  it('세 칸씩 한 줄이다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    wrap(<AttendanceScreen />)
    expect(screen.UNSAFE_getByType(FlatList).props.numColumns).toBe(3)
  })

  it('체크가 없어도 직관 글이 있으면 보인다', () => {
    mockState.rows = []
    mockPosts = [mine({ match: null, body: '경기 없이 #직관' })]
    wrap(<AttendanceScreen />)
    expect(screen.getByLabelText(/글 열기: 경기 없이/)).toBeTruthy()
  })
})

/** 내 직관 글은 따로 받는다. 받는 중이나 실패했을 때 "글을 써 보세요" 라고 하면 틀린 말이다 (4단계 검토) */
describe('내 직관 글을 받는 동안', () => {
  afterEach(() => {
    mockPostsQuery = { isPending: false, isError: false, refetch: jest.fn() }
  })

  it('받는 중이면 빈 안내 대신 불러오는 중', () => {
    mockState.rows = []
    mockPostsQuery = { isPending: true, isError: false, refetch: jest.fn() }
    wrap(<AttendanceScreen />)
    expect(screen.queryByText(/글을 써 보세요/)).toBeNull()
    expect(screen.getByText('불러오는 중입니다')).toBeTruthy()
  })

  it('실패하면 다시 시도를 둔다', () => {
    mockState.rows = []
    const refetch = jest.fn()
    mockPostsQuery = { isPending: false, isError: true, refetch }
    wrap(<AttendanceScreen />)
    expect(screen.queryByText(/글을 써 보세요/)).toBeNull()
    fireEvent.press(screen.getByText('다시 시도'))
    expect(refetch).toHaveBeenCalled()
  })
})

/** 체크 없이 글만 있으면 '직관 0경기' 가 어색했다 — 글 수를 적고 체크를 권한다 (2026-09-29) */
describe('요약', () => {
  const post = (id: string) =>
    ({
      id,
      authorId: 'me',
      handle: 'poground',
      body: `${id} #직관`,
      visibility: 'public',
      match: null,
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: 't',
    }) as unknown as Post

  afterEach(() => {
    mockPosts = []
  })

  it('체크한 경기가 없으면 승률 줄 대신 글 수와 체크 안내', () => {
    mockState.rows = []
    mockPosts = [post('a'), post('b')]
    wrap(<AttendanceScreen />)
    expect(screen.getByText('직관 글 2개')).toBeTruthy()
    expect(screen.getByText(/직관을 체크하면 승률이 쌓여요/)).toBeTruthy()
    expect(screen.queryByText(/직관 0경기/)).toBeNull()
  })

  it('체크한 경기가 있으면 승률 줄과 함께 글 수도 적는다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    mockPosts = [post('a')]
    wrap(<AttendanceScreen />)
    expect(screen.getByText(/직관 1경기/)).toBeTruthy()
    expect(screen.getByText('직관 글 1개')).toBeTruthy()
    expect(screen.queryByText(/승률이 쌓여요/)).toBeNull()
  })
})

/** 승리요정 카드 공유 (2026-09-30). 끝난 직관 경기가 있어야 카드가 생긴다 */
describe('승리요정 카드 공유', () => {
  it('끝난 직관 경기가 있으면 공유 단추가 있고, 누르면 부른다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    const onShareFairy = jest.fn()
    wrap(<AttendanceScreen onShareFairy={onShareFairy} />)
    fireEvent.press(screen.getByRole('button', { name: '승리요정 카드 공유' }))
    expect(onShareFairy).toHaveBeenCalled()
  })

  it('예정 경기만 체크했으면 공유 단추가 없다', () => {
    mockState.rows = [attended(mockMatchScheduled.id)]
    wrap(<AttendanceScreen onShareFairy={jest.fn()} />)
    expect(screen.queryByRole('button', { name: '승리요정 카드 공유' })).toBeNull()
  })
})

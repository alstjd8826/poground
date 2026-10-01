import React from 'react'
import { Alert, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { CommunityScreen } from '@/screens/CommunityScreen'
import { PostDetailScreen } from '@/screens/PostDetailScreen'
import type { Post } from '@/models/community'

const p = (id: string, body: string): Post => ({
  id,
  authorId: 'u',
  handle: 'h',
  nickname: '팬',
  avatarUrl: null,
  body,
  visibility: 'public',
  match: null,
  photos: [],
  likeCount: 0,
  likedByMe: false,
  commentCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const mockFeed = {
  posts: [p('1', '첫 글')],
  query: {
    isPending: false,
    isError: false,
    data: {},
    refetch: jest.fn(),
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    isFetchingNextPage: false,
    isRefetching: false,
  },
}
const mockFeedCalls: string[] = []
const mockPostState = {
  post: p('9', '상세 본문') as Post | null,
  blocked: false,
  query: { isPending: false, isError: false, data: {}, refetch: jest.fn() },
}
jest.mock('@/hooks/community/useCommunity', () => ({
  useCommunityFeed: (filter: string) => {
    mockFeedCalls.push(filter)
    return mockFeed
  },
  usePost: () => mockPostState,
  usePostPhoto: () => mockPhotoUri,
  useDeletePost: () => ({ mutate: mockDelete }),
  usePostLike: () => mockLike,
  usePostModeration: () => mockModeration,
}))
const mockDelete = jest.fn()
const mockLike = { toggle: jest.fn(async () => {}), signedIn: true }
const mockModeration = {
  signedIn: true,
  isAdmin: false,
  report: jest.fn(async () => {}),
  block: jest.fn(async () => {}),
  adminDelete: jest.fn(async () => {}),
}
// 신고 시트는 사유를 고르는 자리다. 열리면 '욕설' 을 고르는 단추 하나로 흉내 낸다
jest.mock('@/components/comment/ReportSheet', () => {
  const { createElement } = jest.requireActual('react')
  const { Pressable } = jest.requireActual('react-native')
  return {
    ReportSheet: ({ open, onSubmit }: { open: boolean; onSubmit: (r: string) => void }) =>
      open
        ? createElement(Pressable, { accessibilityLabel: '사유 욕설', onPress: () => onSubmit('욕설') })
        : null,
  }
})
let mockPhotoUri: string | null = null
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'u' } } }) }))
// 자리 재기(measureInWindow)는 테스트 렌더러에서 콜백을 안 부른다. 누르면 바로 알리는 판으로 바꾼다
jest.mock('@/components/foundation/MoreDots', () => {
  const { createElement } = jest.requireActual('react')
  const { Pressable } = jest.requireActual('react-native')
  return {
    MoreDots: ({
      onPress,
      accessibilityLabel,
    }: {
      onPress: (a: object) => void
      accessibilityLabel: string
    }) =>
      createElement(Pressable, {
        accessibilityLabel,
        onPress: () => onPress({ x: 0, y: 0, width: 0, height: 0 }),
      }),
  }
})

// 탭 화면은 탭바 높이만큼 이미 아래가 비어 있다(tabs.tsx TabRoot). 화면이 그 값을 또 더하면 안 된다
jest.mock('@/navigation/tabBarHeight', () => ({ useTabBarHeight: () => 83 }))
jest.mock('@/hooks/query/useKleague', () => ({ useMatches: () => ({ data: [] }) }))
jest.mock('@/components/comment/CommentList', () => ({ CommentList: () => null }))
jest.mock('@/components/comment/CommentComposer', () => {
  const { createElement } = jest.requireActual('react')
  const { View } = jest.requireActual('react-native')
  return { CommentComposer: () => createElement(View, { accessibilityLabel: '댓글 입력 자리' }) }
})

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

describe('커뮤니티 피드 화면', () => {
  it('공개 글을 보여 준다', () => {
    wrap(<CommunityScreen />)
    expect(screen.getByText('첫 글')).toBeTruthy()
  })

  it('거르개를 바꾸면 그 갈래를 받는다', () => {
    mockFeedCalls.length = 0
    wrap(<CommunityScreen />)
    fireEvent.press(screen.getByText('자유'))
    expect(mockFeedCalls).toContain('free')
  })

  it('글이 없으면 안내한다', () => {
    mockFeed.posts = []
    wrap(<CommunityScreen />)
    expect(screen.getByText(/첫 글을 남겨 보세요/)).toBeTruthy()
    mockFeed.posts = [p('1', '첫 글')]
  })
})

describe('글 상세', () => {
  it('본문을 보여 준다', () => {
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.getByText('상세 본문')).toBeTruthy()
  })

  it('글쓴이는 @아이디 로 적는다', () => {
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.getByText('@h')).toBeTruthy()
  })

  /** 나만 보기로 바뀌었거나 지워진 글 */
  it('볼 수 없는 글이면 안내한다', () => {
    mockPostState.post = null
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.getByText('볼 수 없는 글입니다')).toBeTruthy()
    mockPostState.post = p('9', '상세 본문')
  })

  it('차단한 사람의 글이면 가린다', () => {
    mockPostState.blocked = true
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.queryByText('상세 본문')).toBeNull()
    expect(screen.getByText('차단한 사용자의 글입니다')).toBeTruthy()
    mockPostState.blocked = false
  })
})

/** 내 나만 보기 글에도 댓글을 단다 (2026-09-29) — 남은 어차피 못 본다 */
describe('나만 보기 글의 댓글', () => {
  afterEach(() => {
    mockPostState.post = p('9', '상세 본문')
  })

  it('내 나만 보기 글에는 댓글 입력이 있다', () => {
    mockPostState.post = { ...p('9', '상세 본문'), authorId: 'u', visibility: 'private' }
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.getByLabelText('댓글 입력 자리')).toBeTruthy()
  })

  it('남의 나만 보기 글(운영자가 신고로 여는 경우)에는 댓글 입력이 없다', () => {
    mockPostState.post = { ...p('9', '상세 본문'), authorId: 'someone', visibility: 'private' }
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.queryByLabelText('댓글 입력 자리')).toBeNull()
  })
})

describe('상세 사진', () => {
  /** 상세도 피드처럼 1:1 칸을 채운다 (2026-09-29) */
  it('사진이 정사각형 칸을 채운다', () => {
    mockPhotoUri = 'file:///p.jpg'
    mockPostState.post = { ...p('9', '상세 본문'), photos: [{ position: 0, path: 'u/9/a' }] }
    wrap(<PostDetailScreen postId="9" />)
    const image = screen.UNSAFE_getByType(Image)
    expect(image.props.contentFit).toBe('cover')
    expect(StyleSheet.flatten(image.parent!.props.style).aspectRatio).toBe(1)
    mockPhotoUri = null
    mockPostState.post = p('9', '상세 본문')
  })
})

describe('좋아요', () => {
  it('피드에서 하트를 누르면 좋아요를 보낸다', () => {
    mockLike.toggle.mockClear()
    wrap(<CommunityScreen />)
    fireEvent.press(screen.getByRole('button', { name: '좋아요 0' }))
    expect(mockLike.toggle).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('로그인 전이면 로그인부터 청한다', () => {
    mockLike.toggle.mockClear()
    mockLike.signedIn = false
    const onRequireLogin = jest.fn()
    wrap(<CommunityScreen onRequireLogin={onRequireLogin} />)
    fireEvent.press(screen.getByRole('button', { name: '좋아요 0' }))
    expect(onRequireLogin).toHaveBeenCalled()
    expect(mockLike.toggle).not.toHaveBeenCalled()
    mockLike.signedIn = true
  })

  it('상세에서도 누른다', () => {
    mockLike.toggle.mockClear()
    wrap(<PostDetailScreen postId="9" />)
    fireEvent.press(screen.getByRole('button', { name: '좋아요 0' }))
    expect(mockLike.toggle).toHaveBeenCalledWith(expect.objectContaining({ id: '9' }))
  })
})

describe('글쓰기와 내 글', () => {
  /** 글쓰기는 헤더 오른쪽 연필로 옮겼다 (2026-09-29). 떠 있는 단추가 마지막 카드와 바탕을 가렸다 */
  it('피드에는 떠 있는 글쓰기 단추가 없다', () => {
    wrap(<CommunityScreen />)
    expect(screen.queryByLabelText('글쓰기')).toBeNull()
  })

  /** 남의 글에도 ⋮ 가 있다 — 신고·차단 (3단계) */
  it('피드의 남의 글 ⋮ → 신고 → 사유를 고르면 신고를 보낸다', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockModeration.report.mockClear()
    mockFeed.posts = [{ ...p('1', '첫 글'), authorId: 'someone' }]
    wrap(<CommunityScreen />)
    fireEvent.press(screen.getByLabelText('글 더보기'))
    fireEvent.press(await screen.findByText('신고'))
    fireEvent.press(await screen.findByLabelText('사유 욕설'))
    await waitFor(() =>
      expect(mockModeration.report).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), '욕설'),
    )
    await waitFor(() => expect(alert).toHaveBeenCalledWith('신고했습니다', '확인 후 조치하겠습니다.'))
    alert.mockRestore()
    mockFeed.posts = [p('1', '첫 글')]
  })

  it('피드의 내 글 ⋮ 에는 수정이 있다', async () => {
    mockFeed.posts = [{ ...p('1', '첫 글'), authorId: 'u' }]
    wrap(<CommunityScreen />)
    fireEvent.press(screen.getByLabelText('글 더보기'))
    expect(await screen.findByText('수정')).toBeTruthy()
    mockFeed.posts = [p('1', '첫 글')]
  })

  it('상세의 내 글에도 ⋮ 가 있다', () => {
    mockPostState.post = { ...p('9', '상세 본문'), authorId: 'u' }
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.getByLabelText('글 더보기')).toBeTruthy()
  })
})

/** PostCard 는 memo 다. 피드가 다시 그려질 때 카드에 넘기는 것이 새 객체면 모든 카드가 다시 그려진다 */
describe('피드 카드 다시 그리기', () => {
  it('피드를 다시 그려도 카드에 같은 차림표와 좋아요 함수를 넘긴다', () => {
    // PostCard 는 memo 라 형으로 못 찾는다. 좋아요 함수를 받는 자리가 카드다
    const card = () =>
      screen.UNSAFE_getAllByProps({ post: mockFeed.posts[0] }).find(n => 'onToggleLike' in n.props)!
    const onRequireLogin = () => {}
    const ui = () => (
      <ThemeProvider initialPreference="home">
        <CommunityScreen onRequireLogin={onRequireLogin} />
      </ThemeProvider>
    )
    const { rerender } = render(ui())
    const before = card().props
    rerender(ui())
    const after = card().props
    expect(after.menu).toBe(before.menu)
    expect(after.onToggleLike).toBe(before.onToggleLike)
  })
})

/**
 * 더 보기는 그려진 줄 수로 정한다. 줄바꿈으로 세면 줄바꿈 없이 긴 문단은 세 줄에서 잘리고도 더 보기가
 * 없었다. 줄 제한 없는 숨은 사본이 잰 줄 수를 쓴다
 */
describe('더 보기', () => {
  afterEach(() => {
    mockFeed.posts = [p('1', '첫 글')]
  })
  const measure = () => screen.getByTestId('post-body-measure', { includeHiddenElements: true })
  const layout = (count: number) =>
    fireEvent(measure(), 'textLayout', { nativeEvent: { lines: Array.from({ length: count }, () => ({})) } })

  it('줄바꿈 없는 긴 문단도 네 줄 넘게 그려지면 더 보기가 뜬다', () => {
    mockFeed.posts = [p('1', '아주 긴 한 문단 '.repeat(30))]
    wrap(<CommunityScreen />)
    expect(screen.queryByText('더 보기')).toBeNull()
    layout(5)
    fireEvent.press(screen.getByText('더 보기'))
    expect(screen.queryByText('더 보기')).toBeNull()
  })

  it('줄바꿈이 많아도 세 줄 안에 들면 더 보기가 없다', () => {
    mockFeed.posts = [p('1', 'a\nb\nc')]
    wrap(<CommunityScreen />)
    layout(3)
    expect(screen.queryByText('더 보기')).toBeNull()
  })

  it('숨은 사본은 화면 읽기에 잡히지 않는다', () => {
    wrap(<CommunityScreen />)
    expect(screen.getAllByText('첫 글')).toHaveLength(1)
  })
})

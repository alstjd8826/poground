import React from 'react'
import { StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { homeTheme } from '@/styles/colors/theme'
import { PostCard } from '@/components/community/PostCard'
import type { Post } from '@/models/community'
import { mockMatchFinished } from '@/utils/fixtures'

jest.mock('@/hooks/community/useCommunity', () => ({ usePostPhoto: () => 'file:///p.jpg' }))
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

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

const base: Post = {
  id: 'p1',
  authorId: 'u1',
  handle: 'steel',
  nickname: '김포항',
  avatarUrl: null,
  body: '오늘 직관 최고',
  visibility: 'public',
  match: null,
  photos: [],
  likeCount: 3,
  likedByMe: false,
  commentCount: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('피드 카드', () => {
  it('아이디, 본문, 좋아요·댓글 수', () => {
    wrap(<PostCard post={base} />)
    // 닉네임은 겹칠 수 있다. 댓글처럼 @아이디 로 적는다 (2026-09-29)
    expect(screen.getByText('@steel')).toBeTruthy()
    expect(screen.queryByText('김포항')).toBeNull()
    expect(screen.getByText('오늘 직관 최고')).toBeTruthy()
    expect(screen.getByLabelText('좋아요 3')).toBeTruthy()
    expect(screen.getByLabelText('댓글 2')).toBeTruthy()
  })

  /** 목록에서도 바로 누른다 (2026-09-29) */
  it('하트를 누르면 좋아요를 알린다', () => {
    const onToggleLike = jest.fn()
    wrap(<PostCard post={base} onToggleLike={onToggleLike} />)
    const heart = screen.getByRole('button', { name: '좋아요 3' })
    expect(heart.props.accessibilityState).toMatchObject({ selected: false })
    fireEvent.press(heart)
    expect(onToggleLike).toHaveBeenCalledWith(base)
  })

  it('누른 글은 하트가 채워져 있다', () => {
    wrap(<PostCard post={{ ...base, likedByMe: true }} onToggleLike={jest.fn()} />)
    expect(screen.getByRole('button', { name: '좋아요 3' }).props.accessibilityState).toMatchObject({
      selected: true,
    })
  })

  it('본문 속 @아이디 는 강조색이다', () => {
    wrap(<PostCard post={{ ...base, body: '@pohang_fan 반가워요' }} />)
    expect(StyleSheet.flatten(screen.getByText('@pohang_fan').props.style).color).toBe(homeTheme.accent)
  })

  it('아이디가 없으면 포항 팬', () => {
    wrap(<PostCard post={{ ...base, handle: null }} />)
    expect(screen.getByText('포항 팬')).toBeTruthy()
  })

  it('나만 보기 글에는 자물쇠가 붙는다', () => {
    wrap(<PostCard post={{ ...base, visibility: 'private' }} />)
    expect(screen.getByLabelText('나만 보기')).toBeTruthy()
  })

  it('공개 글에는 자물쇠가 없다', () => {
    wrap(<PostCard post={base} />)
    expect(screen.queryByLabelText('나만 보기')).toBeNull()
  })

  /** 세로·가로 사진이 섞여 올라온다. 1:1 이면 어느 쪽이든 4분의 1만 잘린다 (2026-09-29) */
  it('피드 사진은 정사각형 칸을 채운다', () => {
    wrap(<PostCard post={{ ...base, photos: [{ position: 0, path: 'u1/p1/a' }] }} />)
    const image = screen.UNSAFE_getByType(Image)
    expect(image.props.contentFit).toBe('cover')
    expect(StyleSheet.flatten(image.parent!.props.style).aspectRatio).toBe(1)
  })

  /** 피드에서도 옆으로 넘긴다 (2026-09-29). 몇 번째인지는 오른쪽 위 1/4 로 알린다 */
  it('사진이 여러 장이면 옆으로 넘기고 몇 번째인지 알린다', () => {
    const photos = [0, 1, 2, 3].map(position => ({ position, path: `u1/p1/${position}` }))
    wrap(<PostCard post={{ ...base, photos }} />)
    expect(screen.UNSAFE_getAllByType(Image)).toHaveLength(4)
    expect(screen.getByText('1/4')).toBeTruthy()
    const pager = screen.getByTestId('post-photo-pager')
    const width = StyleSheet.flatten(screen.UNSAFE_getAllByType(Image)[0]!.parent!.props.style)
      .width as number
    fireEvent(pager, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: width * 2 } } })
    expect(screen.getByText('3/4')).toBeTruthy()
  })

  it('사진이 한 장이면 몇 번째 표시가 없다', () => {
    wrap(<PostCard post={{ ...base, photos: [{ position: 0, path: 'u1/p1/a' }] }} />)
    expect(screen.queryByText('1/1')).toBeNull()
  })

  it('사진을 누르면 글을 연다', () => {
    const onOpen = jest.fn()
    wrap(<PostCard post={{ ...base, photos: [{ position: 0, path: 'u1/p1/a' }] }} onOpen={onOpen} />)
    fireEvent.press(screen.getByLabelText('사진 1/1'))
    expect(onOpen).toHaveBeenCalled()
  })

  /**
   * 사진 없는 직관 글도 피드에서는 글처럼 — 큰 스코어 카드 없이 경기 줄과 본문만 (2026-09-29).
   * 픽스처 경기는 대전 2:2 포항
   */
  it('사진 없는 직관 글은 스코어 카드 없이 경기 줄과 본문만', () => {
    wrap(
      <PostCard
        post={{ ...base, match: { year: 2026, leagueId: 1, gameId: mockMatchFinished.id } }}
        match={mockMatchFinished}
      />,
    )
    expect(screen.queryByLabelText('스코어 카드')).toBeNull()
    expect(screen.getByText(/vs 대전 2:2 무/)).toBeTruthy()
    expect(screen.getByText('오늘 직관 최고')).toBeTruthy()
  })

  it('사진 없는 자유 글은 본문만', () => {
    wrap(<PostCard post={base} />)
    expect(screen.queryByLabelText('스코어 카드')).toBeNull()
  })

  /** 닉네임을 아직 안 정한 사람의 글 */
  it('누르면 연다', () => {
    const onOpen = jest.fn()
    wrap(<PostCard post={base} onOpen={onOpen} />)
    fireEvent.press(screen.getByText('오늘 직관 최고'))
    expect(onOpen).toHaveBeenCalledWith(base)
  })
})

/** 모든 글에 ⋮ — 내 글은 수정·삭제, 남의 글은 신고·차단. 항목은 PostMenu 가 정한다(post-menu.test) */
describe('차림표', () => {
  const menu = {
    mine: false,
    isAdmin: false,
    signedIn: true,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onReport: jest.fn(),
    onBlock: jest.fn(),
    onAdminDelete: jest.fn(),
  }

  it('차림표를 받으면 남의 글에도 ⋮ 가 있고 신고가 뜬다', async () => {
    wrap(<PostCard post={base} menu={menu} />)
    fireEvent.press(screen.getByLabelText('글 더보기'))
    fireEvent.press(await screen.findByText('신고'))
    await waitFor(() => expect(menu.onReport).toHaveBeenCalledWith(base))
  })

  it('차림표가 없으면 ⋮ 도 없다', () => {
    wrap(<PostCard post={base} />)
    expect(screen.queryByLabelText('글 더보기')).toBeNull()
  })
})

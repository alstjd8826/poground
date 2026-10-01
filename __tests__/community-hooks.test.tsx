import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import {
  communityKeys,
  useCommunityFeed,
  useDeletePost,
  usePhotoAt,
  usePostLike,
  usePostModeration,
  useMyAttendancePosts,
  useSavePost,
} from '@/hooks/community/useCommunity'
import type { Post } from '@/models/community'

let mockSession: { user: { id: string } } | null = { user: { id: 'me' } }
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: mockSession }) }))
jest.mock('@/repositories/comment/remote', () => ({ listBlocked: jest.fn(), blockUser: jest.fn() }))
jest.mock('@/hooks/comment/useIsAdmin', () => ({
  useIsAdmin: () => mockIsAdmin,
  adminKey: (id: string | null) => ['admin', id],
}))
let mockIsAdmin = false
jest.mock('@/repositories/community/remote', () => ({
  listFeed: jest.fn(),
  getPost: jest.fn(),
  savePost: jest.fn(),
  deletePost: jest.fn(),
  likePost: jest.fn(),
  unlikePost: jest.fn(),
  reportPost: jest.fn(),
  adminDeletePost: jest.fn(),
  listMyAttendancePosts: jest.fn(async () => []),
}))
jest.mock('@/repositories/remote/privateImage', () => ({
  resolvePrivateImage: jest.fn(async () => null),
  adoptPrivateImage: jest.fn(),
  dropPrivateImage: jest.fn(),
}))

const remote = jest.requireMock('@/repositories/community/remote') as {
  listFeed: jest.Mock
  savePost: jest.Mock
  deletePost: jest.Mock
  likePost: jest.Mock
  unlikePost: jest.Mock
  reportPost: jest.Mock
  adminDeletePost: jest.Mock
  listMyAttendancePosts: jest.Mock
}
const images = jest.requireMock('@/repositories/remote/privateImage') as {
  resolvePrivateImage: jest.Mock
  adoptPrivateImage: jest.Mock
  dropPrivateImage: jest.Mock
}
const comments = jest.requireMock('@/repositories/comment/remote') as {
  listBlocked: jest.Mock
  blockUser: jest.Mock
}

const post = (id: string, authorId: string) => ({ id, authorId }) as Post

const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach(c => c.clear())
  clients.length = 0
})
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockSession = { user: { id: 'me' } }
  remote.listFeed.mockReset().mockResolvedValue([post('1', 'kim'), post('2', 'lee')])
  comments.listBlocked.mockReset().mockResolvedValue(['lee'])
  remote.savePost.mockReset()
  remote.deletePost.mockReset()
  images.adoptPrivateImage.mockReset()
  images.dropPrivateImage.mockReset()
})

describe('커뮤니티 피드', () => {
  it('차단한 사람의 글을 가린다', async () => {
    const { result } = renderHook(() => useCommunityFeed('all'), { wrapper })
    await waitFor(() => expect(result.current.posts.map(p => p.id)).toEqual(['1']))
  })

  /** 로그인 전에는 차단 목록이 없다. 그래도 피드는 읽혀야 한다 */
  it('로그인 전에도 읽고 차단 목록은 묻지 않는다', async () => {
    mockSession = null
    const { result } = renderHook(() => useCommunityFeed('all'), { wrapper })
    await waitFor(() => expect(result.current.posts).toHaveLength(2))
    expect(comments.listBlocked).not.toHaveBeenCalled()
  })

  it('거르개를 서버에 넘긴다', async () => {
    renderHook(() => useCommunityFeed('free'), { wrapper })
    await waitFor(() => expect(remote.listFeed).toHaveBeenCalledWith('free', null))
  })
})

describe('글 저장', () => {
  it('내 id 로 저장하고 올린 사진을 캐시에 넣는다', async () => {
    remote.savePost.mockResolvedValue({
      id: 'p',
      updatedAt: 't',
      uploaded: [{ path: 'me/p/n1', localUri: 'file:///a.jpg' }],
      removed: [],
    })
    const { result } = renderHook(() => useSavePost(), { wrapper })
    const draft = { photos: [], body: 'x', visibility: 'public' as const }
    await act(async () => {
      await result.current.mutateAsync({ postId: 'p', draft, previousPaths: [], match: null })
    })
    expect(remote.savePost).toHaveBeenCalledWith({
      postId: 'p',
      draft,
      previousPaths: [],
      match: null,
      userId: 'me',
    })
    expect(images.adoptPrivateImage).toHaveBeenCalledWith(
      { bucket: 'post-photos', path: 'me/p/n1', version: 'once' },
      'file:///a.jpg',
    )
  })

  /** 고치기에서 뺀 사진은 버킷에서 지워졌다. 기기 캐시에 남겨 둘 까닭이 없다 */
  it('고치기에서 뺀 사진은 캐시에서도 비운다', async () => {
    remote.savePost.mockResolvedValue({ id: 'p', updatedAt: 't', uploaded: [], removed: ['me/p/old'] })
    const { result } = renderHook(() => useSavePost(), { wrapper })
    const draft = { photos: [], body: 'x', visibility: 'public' as const }
    await act(async () => {
      await result.current.mutateAsync({ postId: 'p', draft, previousPaths: ['me/p/old'], match: null })
    })
    expect(images.dropPrivateImage).toHaveBeenCalledWith({ bucket: 'post-photos', path: 'me/p/old' })
  })

  it('캐시 정리가 실패해도 저장은 성공으로 끝난다', async () => {
    remote.savePost.mockResolvedValue({ id: 'p', updatedAt: 't', uploaded: [], removed: ['me/p/old'] })
    images.dropPrivateImage.mockImplementation(() => {
      throw new Error('disk')
    })
    const { result } = renderHook(() => useSavePost(), { wrapper })
    const draft = { photos: [], body: 'x', visibility: 'public' as const }
    await act(async () => {
      await expect(
        result.current.mutateAsync({ postId: 'p', draft, previousPaths: ['me/p/old'], match: null }),
      ).resolves.toMatchObject({ id: 'p' })
    })
  })

  it('로그인 전이면 저장하지 않는다', async () => {
    mockSession = null
    const { result } = renderHook(() => useSavePost(), { wrapper })
    const draft = { photos: [], body: 'x', visibility: 'public' as const }
    await expect(
      result.current.mutateAsync({ postId: 'p', draft, previousPaths: [], match: null }),
    ).rejects.toThrow('로그인이 필요합니다')
    expect(remote.savePost).not.toHaveBeenCalled()
  })
})

describe('글 지우기', () => {
  it('지우고 사진 캐시를 비운다', async () => {
    remote.deletePost.mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeletePost(), { wrapper })
    const target = { ...post('p', 'me'), photos: [{ position: 0, path: 'me/p/x' }] }
    await act(() => result.current.mutateAsync(target))
    expect(remote.deletePost).toHaveBeenCalledWith(target)
    expect(images.dropPrivateImage).toHaveBeenCalledWith({ bucket: 'post-photos', path: 'me/p/x' })
  })
})

describe('사진 한 장', () => {
  /** 사진 이름은 한 번 쓰고 안 바뀐다. 글을 고칠 때마다 버전을 바꾸면 사진을 다시 받는다 */
  it('고정 버전으로 캐시를 찾는다', async () => {
    images.resolvePrivateImage.mockResolvedValue('file:///cache/x')
    const { result } = renderHook(() => usePhotoAt('me/p/x'), { wrapper })
    await waitFor(() => expect(result.current).toBe('file:///cache/x'))
    expect(images.resolvePrivateImage).toHaveBeenCalledWith({
      bucket: 'post-photos',
      path: 'me/p/x',
      version: 'once',
    })
  })
})

/** 좋아요는 누르는 즉시 반영하고, 실패하면 되돌리고, 끝날 때까지 잠근다 (스펙 오류 처리) */
describe('좋아요', () => {
  const liked = (on: boolean, count: number) => ({ ...post('p1', 'u1'), likedByMe: on, likeCount: count })
  const seed = () => {
    const client = clients[clients.length - 1]!
    client.setQueryData(communityKeys.feed('all'), { pages: [[liked(false, 3)]], pageParams: [null] })
    client.setQueryData(communityKeys.post('p1'), liked(false, 3))
    return client
  }
  const read = (client: QueryClient) => ({
    feed: (client.getQueryData(communityKeys.feed('all')) as { pages: Post[][] }).pages[0]![0],
    post: client.getQueryData(communityKeys.post('p1')) as Post,
  })

  it('누르는 즉시 피드와 상세에 함께 반영한다', async () => {
    let finish: () => void = () => {}
    remote.likePost.mockReset().mockReturnValue(new Promise<void>(r => (finish = r)))
    const { result } = renderHook(() => usePostLike(), { wrapper })
    const client = seed()
    let done: Promise<void> = Promise.resolve()
    act(() => {
      done = result.current.toggle(liked(false, 3))
    })
    expect(read(client).feed).toMatchObject({ likedByMe: true, likeCount: 4 })
    expect(read(client).post).toMatchObject({ likedByMe: true, likeCount: 4 })
    expect(remote.likePost).toHaveBeenCalledWith('p1', 'me')
    finish()
    await act(() => done)
  })

  it('실패하면 되돌린다', async () => {
    remote.likePost.mockReset().mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => usePostLike(), { wrapper })
    const client = seed()
    await act(async () => {
      await expect(result.current.toggle(liked(false, 3))).rejects.toThrow('network')
    })
    expect(read(client).feed).toMatchObject({ likedByMe: false, likeCount: 3 })
    expect(read(client).post).toMatchObject({ likedByMe: false, likeCount: 3 })
  })

  it('끝나기 전에 또 누르면 한 번만 보낸다', async () => {
    let finish: () => void = () => {}
    remote.likePost.mockReset().mockReturnValue(new Promise<void>(r => (finish = r)))
    const { result } = renderHook(() => usePostLike(), { wrapper })
    seed()
    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.toggle(liked(false, 3))
      void result.current.toggle(liked(true, 4))
    })
    expect(remote.likePost).toHaveBeenCalledTimes(1)
    expect(remote.unlikePost).not.toHaveBeenCalled()
    finish()
    await act(() => first)
  })

  it('누른 글을 다시 누르면 푼다', async () => {
    remote.unlikePost.mockReset().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePostLike(), { wrapper })
    seed()
    await act(() => result.current.toggle(liked(true, 4)))
    expect(remote.unlikePost).toHaveBeenCalledWith('p1', 'me')
  })
})

/** 남의 글 신고·차단, 관리자 삭제 (3단계) */
describe('신고와 차단', () => {
  it('내 이름으로 신고한다', async () => {
    remote.reportPost.mockReset().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePostModeration(), { wrapper })
    await act(() => result.current.report(post('p1', 'u1'), '욕설'))
    expect(remote.reportPost).toHaveBeenCalledWith('p1', 'me', '욕설')
  })

  it('차단하면 글쓴이를 막고 피드와 차단 목록을 새로 받는다', async () => {
    comments.blockUser.mockReset().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePostModeration(), { wrapper })
    const client = clients[clients.length - 1]!
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    await act(() => result.current.block(post('p1', 'u1')))
    expect(comments.blockUser).toHaveBeenCalledWith('me', 'u1')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['community'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['blocked', 'me'] })
  })

  it('관리자 여부를 알려 주고, 관리자 삭제를 한다', async () => {
    mockIsAdmin = true
    remote.adminDeletePost.mockReset().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePostModeration(), { wrapper })
    expect(result.current.isAdmin).toBe(true)
    await act(() => result.current.adminDelete(post('p1', 'u1')))
    expect(remote.adminDeletePost).toHaveBeenCalledWith('p1')
    mockIsAdmin = false
  })
})

/** 직관 기록의 내 직관 글 (4단계) */
describe('내 직관 글', () => {
  it('내 id 로 묻는다', async () => {
    remote.listMyAttendancePosts.mockReset().mockResolvedValue([post('p1', 'me')])
    const { result } = renderHook(() => useMyAttendancePosts(), { wrapper })
    await waitFor(() => expect(result.current.posts.map(p => p.id)).toEqual(['p1']))
    expect(remote.listMyAttendancePosts).toHaveBeenCalledWith('me')
  })

  it('로그인 전이면 묻지 않고 비어 있다', async () => {
    mockSession = null
    remote.listMyAttendancePosts.mockReset()
    const { result } = renderHook(() => useMyAttendancePosts(), { wrapper })
    expect(result.current.posts).toEqual([])
    expect(remote.listMyAttendancePosts).not.toHaveBeenCalled()
  })
})

/** 직관 기록·경기 상세의 내 직관 글에서 누른 좋아요도 바로 반영된다 (4단계 검토 I1) */
it('내 직관 글 목록에서 누른 좋아요가 바로 반영된다', async () => {
  remote.listMyAttendancePosts
    .mockReset()
    .mockResolvedValue([{ ...post('p1', 'me'), likedByMe: false, likeCount: 0 }])
  let finish: () => void = () => {}
  remote.likePost.mockReset().mockReturnValue(new Promise<void>(r => (finish = r)))
  const { result } = renderHook(() => ({ mine: useMyAttendancePosts(), like: usePostLike() }), { wrapper })
  await waitFor(() => expect(result.current.mine.posts).toHaveLength(1))
  let done: Promise<void> = Promise.resolve()
  act(() => {
    done = result.current.like.toggle(result.current.mine.posts[0]!)
  })
  await waitFor(() => expect(result.current.mine.posts[0]).toMatchObject({ likedByMe: true, likeCount: 1 }))
  finish()
  await act(() => done)
})

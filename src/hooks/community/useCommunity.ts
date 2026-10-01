import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { useAuth } from '@/hooks/auth/useAuth'
import { commentKeys } from '@/hooks/comment/useComments'
import {
  type FeedCursor,
  type FeedFilter,
  nextCursor,
  type Post,
  POST_PHOTO_BUCKET,
  POST_PHOTO_VERSION,
  withoutBlocked,
} from '@/models/community'
import { blockUser, listBlocked } from '@/repositories/comment/remote'
import { useIsAdmin } from '@/hooks/comment/useIsAdmin'
import {
  deletePost,
  getPost,
  adminDeletePost,
  likePost,
  listFeed,
  listMyAttendancePosts,
  reportPost,
  savePost,
  type SavePostInput,
  unlikePost,
} from '@/repositories/community/remote'
import { adoptPrivateImage, dropPrivateImage, resolvePrivateImage } from '@/repositories/remote/privateImage'

export const communityKeys = {
  all: ['community'] as const,
  feed: (filter: FeedFilter) => ['community', 'feed', filter] as const,
  post: (id: string) => ['community', 'post', id] as const,
  mine: (userId: string | null) => ['community', 'mine', userId] as const,
}

const STALE = 30_000

/** 내 차단 목록. 댓글과 같은 캐시를 쓴다. 로그인 전에는 비어 있다 */
function useBlockedIds(): string[] {
  const { session } = useAuth()
  const me = session?.user.id ?? null
  const query = useQuery({
    queryKey: commentKeys.blocked(me),
    queryFn: listBlocked,
    enabled: me !== null,
    staleTime: STALE,
  })
  return (me !== null && query.data) || []
}

/** 공개 글 피드. 차단한 사람의 글은 앱이 거른다 */
export function useCommunityFeed(filter: FeedFilter) {
  const blocked = useBlockedIds()
  const query = useInfiniteQuery({
    queryKey: communityKeys.feed(filter),
    queryFn: ({ pageParam }) => listFeed(filter, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: last => nextCursor(last),
    staleTime: STALE,
  })
  const posts = useMemo(() => withoutBlocked(query.data?.pages.flat() ?? [], blocked), [query.data, blocked])
  return { posts, query }
}

/**
 * 내 직관 글(나만 보기 포함). 로그인 전이면 묻지 않는다. 커뮤니티 캐시 아래(communityKeys.all)에 두어
 * 글을 쓰고 고치고 지우고 좋아요를 누를 때 함께 새로 받는다.
 */
export function useMyAttendancePosts() {
  const { session } = useAuth()
  const me = session?.user.id ?? null
  const query = useQuery({
    queryKey: communityKeys.mine(me),
    queryFn: () => listMyAttendancePosts(me!),
    enabled: me !== null,
    staleTime: STALE,
  })
  return { posts: (me !== null && query.data) || [], query }
}

/** 글 하나. 볼 수 없거나 지워졌으면 null. 차단한 사람의 글이면 blocked */
export function usePost(id: string) {
  const blocked = useBlockedIds()
  // 새 글 화면은 id 없이 부른다(''). 그때는 묻지 않는다
  const query = useQuery({
    queryKey: communityKeys.post(id),
    queryFn: () => getPost(id),
    staleTime: STALE,
    enabled: id !== '',
  })
  const post = query.data
  return { post, blocked: post ? blocked.includes(post.authorId) : false, query }
}

/** 버킷 경로 하나를 기기 캐시 파일로. 없거나 못 받았으면 null */
export function usePhotoAt(path: string | null): string | null {
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setUri(null)
      return
    }
    let alive = true
    void resolvePrivateImage({ bucket: POST_PHOTO_BUCKET, path, version: POST_PHOTO_VERSION }).then(next => {
      if (alive) setUri(next)
    })
    return () => {
      alive = false
    }
  }, [path])

  return uri
}

/** 글의 사진 한 장 */
export function usePostPhoto(post: Post, position: number): string | null {
  return usePhotoAt(post.photos.find(p => p.position === position)?.path ?? null)
}

/**
 * 글을 만들거나 고친다. 끝나면 커뮤니티 캐시를 통째로 새로 받는다 — 피드 세 갈래와 상세가
 * 같은 글을 들고 있어 하나만 고치면 어긋난다.
 *
 * 올린 사진은 기기 파일을 그대로 캐시에 넣는다. 방금 고른 사진을 다시 내려받지 않는다.
 */
export function useSavePost() {
  const client = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useMutation({
    mutationFn: async (input: Omit<SavePostInput, 'userId'>) => {
      if (!userId) throw new Error('로그인이 필요합니다')
      return savePost({ ...input, userId })
    },
    onSuccess: saved => {
      for (const u of saved.uploaded) {
        try {
          adoptPrivateImage(
            { bucket: POST_PHOTO_BUCKET, path: u.path, version: POST_PHOTO_VERSION },
            u.localUri,
          )
        } catch {
          // 못 넣으면 다음에 열 때 내려받는다
        }
      }
      void client.invalidateQueries({ queryKey: communityKeys.all })
      // 캐시 정리는 실패해도 저장은 끝났다. 던지면 위의 다시 받기가 빠지므로 맨 뒤에서 삼킨다
      for (const path of saved.removed) {
        try {
          dropPrivateImage({ bucket: POST_PHOTO_BUCKET, path })
        } catch {
          // 남은 파일은 가리키는 글이 없어 화면에 나오지 않는다
        }
      }
    },
  })
}

/** 내 글을 지운다. 사진 캐시도 비운다 */
export function useDeletePost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (post: Post) => deletePost(post),
    onSuccess: (_, post) => {
      for (const p of post.photos) dropPrivateImage({ bucket: POST_PHOTO_BUCKET, path: p.path })
      void client.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}

/** 커뮤니티 캐시 어디에 있든 그 글을 고친다. 피드 세 갈래·상세·내 직관 글이 같은 글을 따로 들고 있다 */
function patchPost(client: QueryClient, postId: string, patch: (post: Post) => Post) {
  client.setQueriesData<unknown>({ queryKey: communityKeys.all }, (data: unknown) => {
    if (!data || typeof data !== 'object') return data
    // 내 직관 글(communityKeys.mine)은 글 배열이다. 빠뜨리면 직관 기록에서 누른 좋아요가 화면에 안 남고,
    // 다시 누르면 같은 좋아요를 또 넣다 막혔다 (4단계 검토)
    if (Array.isArray(data)) return (data as Post[]).map(p => (p.id === postId ? patch(p) : p))
    if ('pages' in data) {
      const feed = data as InfiniteData<Post[]>
      return { ...feed, pages: feed.pages.map(page => page.map(p => (p.id === postId ? patch(p) : p))) }
    }
    const one = data as Post
    return one.id === postId ? patch(one) : data
  })
}

/** 좋아요가 서버로 가는 중인 글. 화면 여러 곳(피드·상세)이 같은 글을 누를 수 있어 모듈에 둔다 */
const pendingLikes = new Set<string>()

/**
 * 좋아요 누르기·풀기.
 *
 * 누르는 즉시 캐시에 반영하고, 실패하면 되돌린다. 서버로 가는 동안 같은 글은 다시 누르지 못한다
 * — 끝나기 전에 또 누르면 누르기와 풀기가 함께 날아가 서버가 거꾸로 처리할 수 있다.
 * 새로 받아 오지 않는다. 수는 방금 고친 값이 맞고, 다음에 피드를 받을 때 서버 값으로 맞춰진다.
 */
export function usePostLike() {
  const client = useQueryClient()
  const { session } = useAuth()
  const me = session?.user.id ?? null

  const toggle = useCallback(
    async (post: Post) => {
      if (!me) throw new Error('로그인이 필요합니다')
      if (pendingLikes.has(post.id)) return
      pendingLikes.add(post.id)
      const on = !post.likedByMe
      const flip = (to: boolean) => (p: Post) => ({
        ...p,
        likedByMe: to,
        likeCount: Math.max(0, p.likeCount + (to ? 1 : -1)),
      })
      patchPost(client, post.id, flip(on))
      try {
        if (on) await likePost(post.id, me)
        else await unlikePost(post.id, me)
      } catch (e) {
        patchPost(client, post.id, flip(!on))
        throw e
      } finally {
        pendingLikes.delete(post.id)
      }
    },
    [client, me],
  )

  return { toggle, signedIn: me !== null }
}

/**
 * 남의 글 신고·차단, 관리자 삭제 (3단계).
 *
 * 차단과 삭제가 끝나면 커뮤니티 캐시와 차단 목록을 새로 받는다 — 피드·상세가 차단한 사람의 글을
 * 가리는 것은 차단 목록을 보고 한다(withoutBlocked).
 */
export function usePostModeration() {
  const client = useQueryClient()
  const { session } = useAuth()
  const me = session?.user.id ?? null
  const isAdmin = useIsAdmin()

  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: communityKeys.all })
    void client.invalidateQueries({ queryKey: commentKeys.blocked(me) })
  }, [client, me])

  const report = useCallback(
    async (post: Post, reason: string) => {
      if (!me) throw new Error('로그인이 필요합니다')
      await reportPost(post.id, me, reason)
    },
    [me],
  )

  const block = useCallback(
    async (post: Post) => {
      if (!me) throw new Error('로그인이 필요합니다')
      await blockUser(me, post.authorId)
      refresh()
    },
    [me, refresh],
  )

  const adminDelete = useCallback(
    async (post: Post) => {
      await adminDeletePost(post.id)
      refresh()
    },
    [refresh],
  )

  return { signedIn: me !== null, isAdmin, report, block, adminDelete }
}

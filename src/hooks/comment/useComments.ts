import { useCallback, useMemo } from 'react'
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  addComment,
  amIAdmin,
  blockUser,
  type Comment,
  type CommentPage,
  type CommentSubject,
  listBlocked,
  likeComment,
  listCommentPage,
  removeComment,
  reportComment,
  unblockUser,
  unlikeComment,
} from '@/repositories/comment/remote'
import { useAuth } from '@/hooks/auth/useAuth'
import { adminKey } from '@/hooks/comment/useIsAdmin'

/**
 * 경기 댓글.
 *
 * 수집 자료(useKleague)와 달리 사람들이 방금 쓴 것이라 오래 붙잡아 두지 않는다.
 * 화면에 들어올 때마다 다시 받고, 쓰거나 지우면 곧바로 다시 읽는다.
 */
const STALE = 30_000

/**
 * 질의 열쇠.
 *
 * 차단 목록과 관리자 여부는 **사람마다 다른 답**이라 열쇠에 누구인지를 넣는다. 안 넣으면
 * 로그아웃한 뒤에도 앞사람의 답이 캐시에 남아, 남의 차단 목록으로 글이 가려지거나
 * 관리자가 아닌 사람에게 삭제 차림표가 뜬다. 댓글은 누가 보든 같으므로 대상만 넣는다.
 */
export const commentKeys = {
  comments: (s: CommentSubject) => ['comments', s.type, s.id] as const,
  blocked: (userId: string | null) => ['blocked', userId] as const,
  admin: adminKey,
}

/** 맨 위 댓글 하나와 거기 달린 답글들 */
export interface CommentThread {
  root: Comment
  replies: Comment[]
}

/**
 * 평평한 목록을 부모-답글로 묶는다.
 *
 * 답글의 답글은 받지 않는다 — 서버 구조는 열려 있지만 여기서 한 단으로 눌러 둔다.
 * 부모가 없는 답글(부모가 통째로 사라진 경우)은 맨 위로 올려 보여 준다. 안 그러면
 * 목록에서 조용히 사라진다.
 */
export function toThreads(comments: Comment[]): CommentThread[] {
  const roots = new Map<string, CommentThread>()
  const orphans: Comment[] = []

  for (const c of comments) {
    if (c.parentId === null) roots.set(c.id, { root: c, replies: [] })
  }
  for (const c of comments) {
    if (c.parentId === null) continue
    const parent = roots.get(c.parentId)
    if (parent) parent.replies.push(c)
    else orphans.push(c)
  }

  return [...roots.values(), ...orphans.map(root => ({ root, replies: [] }))]
}

/**
 * 다음 쪽을 더 받을지 정한다.
 *
 * 받아 온 **맨 위 댓글** 수를 전체와 견준다. 답글까지 세면 답글이 많은 쪽에서 수가
 * 부풀어 아직 남았는데도 끝난 것으로 본다. 끊는 단위와 세는 단위가 같아야 한다.
 *
 * undefined 를 돌려주면 react-query 가 "더 없음" 으로 읽는다.
 */
export function nextCommentPage(pages: CommentPage[]): number | undefined {
  const total = pages[0]?.totalRoots ?? 0
  const loaded = pages.reduce((n, p) => n + p.comments.filter(c => c.parentId === null).length, 0)
  return loaded < total ? pages.length : undefined
}

export function useComments(subject: CommentSubject) {
  const { session } = useAuth()
  const me = session?.user.id ?? null
  const client = useQueryClient()

  /**
   * 댓글은 쪽으로 받는다. 한 경기에 수백 개가 쌓여도 처음에 받는 것은 스무 개다.
   *
   * 다음 쪽이 있는지는 **맨 위 댓글이 몇 개 왔는지**로 센다. 답글은 부모를 따라오는
   * 것이라 끊는 단위가 아니다.
   */
  const comments = useInfiniteQuery({
    queryKey: commentKeys.comments(subject),
    queryFn: ({ pageParam }) => listCommentPage(subject, pageParam),
    initialPageParam: 0,
    getNextPageParam: (_last, all) => nextCommentPage(all),
    staleTime: STALE,
  })

  // 차단 목록은 로그인했을 때만 있다. 남의 차단은 읽을 수 없다(RLS)
  const blocked = useQuery({
    queryKey: commentKeys.blocked(me),
    queryFn: listBlocked,
    enabled: me !== null,
    staleTime: STALE,
  })

  // 남의 글을 지울 수 있는지. 차림표에 "삭제" 를 띄울지 가른다
  const admin = useQuery({
    queryKey: commentKeys.admin(me),
    queryFn: amIAdmin,
    enabled: me !== null,
    staleTime: STALE,
  })

  const refresh = useCallback(() => {
    client.invalidateQueries({ queryKey: commentKeys.comments(subject) })
  }, [client, subject])

  const add = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId: string | null }) => {
      if (!me) throw new Error('로그인이 필요합니다')
      return addComment(subject, me, body, parentId)
    },
    onSuccess: refresh,
  })

  const remove = useMutation({ mutationFn: removeComment, onSuccess: refresh })

  const report = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => {
      if (!me) throw new Error('로그인이 필요합니다')
      return reportComment(id, me, reason)
    },
  })

  const block = useMutation({
    mutationFn: (userId: string) => {
      if (!me) throw new Error('로그인이 필요합니다')
      return blockUser(me, userId)
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: commentKeys.blocked(me) })
      refresh()
    },
  })

  // 가려 둔 글을 다시 보는 길. 차단만 있고 푸는 길이 없으면 막다른 자리가 된다
  const unblock = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: commentKeys.blocked(me) })
      refresh()
    },
  })

  /**
   * 차단한 사람의 글.
   *
   * 목록에서 빼지 않고 **자리만 남긴다.** 통째로 사라지면 답글이 달려 있던 자리에 구멍이
   * 나고, 대화가 어디서 끊겼는지 읽히지 않는다. 지워진 댓글을 다루는 방식과 같다.
   *
   * 서버에서 거르지 않는 이유는 차단이 **내 쪽 사정**이기 때문이다. 목록 질의에 넣으면
   * 내 차단이 남에게도 영향을 주는 모양이 되고, 차단당한 사람이 자기 글이 왜 안 보이는지
   * 유추할 여지도 생긴다.
   *
   * 신고는 아무것도 가리지 않는다. 신고는 "이 글을 봐 달라" 는 알림이지 "안 보겠다" 가
   * 아니다 — 안 보는 것은 차단이 맡는다.
   */
  const blockedIds = useMemo(() => new Set(blocked.data ?? []), [blocked.data])
  const pages = comments.data?.pages
  const threads = useMemo(() => toThreads(pages?.flatMap(p => p.comments) ?? []), [pages])

  /** 아직 안 받아 온 맨 위 댓글 수. "더 보기" 에 적는다 */
  const rest = (pages?.[0]?.totalRoots ?? 0) - threads.length

  return {
    threads,
    rest,
    blockedIds,
    comments,
    me,
    isAdmin: me !== null && admin.data === true,
    add,
    remove,
    report,
    block,
    unblock,
  }
}

/** 좋아요가 서버로 가는 중인 댓글. 같은 댓글을 두 번 보내지 않게 모듈에 둔다 */
const pendingCommentLikes = new Set<string>()

/**
 * 댓글·답글 좋아요. 게시글 좋아요(usePostLike)와 같은 틀이다.
 *
 * 누르는 즉시 이 대상의 댓글 캐시에 반영하고, 실패하면 되돌린다. 서버로 가는 동안 같은 댓글은
 * 다시 누르지 못한다 — 누르기와 풀기가 함께 날아가면 서버가 거꾸로 처리할 수 있다.
 */
export function useCommentLike(subject: CommentSubject) {
  const client = useQueryClient()
  const { session } = useAuth()
  const me = session?.user.id ?? null

  const toggle = useCallback(
    async (comment: Comment) => {
      if (!me) throw new Error('로그인이 필요합니다')
      if (pendingCommentLikes.has(comment.id)) return
      pendingCommentLikes.add(comment.id)
      const on = !comment.likedByMe
      const patch = (to: boolean) =>
        client.setQueryData<InfiniteData<CommentPage>>(commentKeys.comments(subject), data =>
          data
            ? {
                ...data,
                pages: data.pages.map(page => ({
                  ...page,
                  comments: page.comments.map(c =>
                    c.id === comment.id
                      ? { ...c, likedByMe: to, likeCount: Math.max(0, c.likeCount + (to ? 1 : -1)) }
                      : c,
                  ),
                })),
              }
            : data,
        )
      patch(on)
      try {
        if (on) await likeComment(comment.id, me)
        else await unlikeComment(comment.id, me)
      } catch (e) {
        patch(!on)
        throw e
      } finally {
        pendingCommentLikes.delete(comment.id)
      }
    },
    [client, me, subject],
  )

  return { toggle, signedIn: me !== null }
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/auth/useAuth'
import { commentKeys } from '@/hooks/comment/useComments'
import { listBlockedUsers, unblockUser } from '@/repositories/comment/remote'

/**
 * 차단한 사용자 목록과 풀기 (2026-09-29).
 *
 * 풀면 차단 목록·댓글·커뮤니티를 새로 받는다 — 피드와 상세, 댓글이 차단 목록을 보고 그 사람 글을 가린다.
 */
export function useBlockedUsers() {
  const client = useQueryClient()
  const { session } = useAuth()
  const me = session?.user.id ?? null

  const query = useQuery({
    queryKey: ['blocked-users', me],
    queryFn: listBlockedUsers,
    enabled: me !== null,
  })

  const unblock = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['blocked-users', me] })
      void client.invalidateQueries({ queryKey: commentKeys.blocked(me) })
      void client.invalidateQueries({ queryKey: ['comments'] })
      void client.invalidateQueries({ queryKey: ['community'] })
    },
  })

  return { people: query.data ?? [], isPending: me !== null && query.isPending, unblock }
}

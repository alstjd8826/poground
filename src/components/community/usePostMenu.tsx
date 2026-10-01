import { useCallback, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'

import { ReportSheet } from '@/components/comment/ReportSheet'
import type { PostMenuProps } from '@/components/community/PostMenu'
import { useAuth } from '@/hooks/auth/useAuth'
import { useDeletePost, usePostModeration } from '@/hooks/community/useCommunity'
import type { Post } from '@/models/community'

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * 게시글 ⋮ 에 걸 일과 신고 사유 시트. 피드와 글 상세가 같이 쓴다.
 *
 * 신고는 사유를 고른 **뒤에** 보내고, 보낸 뒤에 알린다 — 댓글 신고와 같다(서버가 거절해도 "신고했습니다"
 * 라고 말하면 무엇이 잘못됐는지 알 길이 없다). 글이 눈앞에서 사라지는 일(지우기·차단·관리자 삭제)이
 * 끝나면 onGone 으로 알린다 — 상세는 뒤로 간다.
 */
export function usePostMenu({
  onEdit,
  onRequireLogin,
  onGone,
}: {
  onEdit?: (post: Post) => void
  onRequireLogin?: () => void
  onGone?: (post: Post) => void
}) {
  const { session } = useAuth()
  const me = session?.user.id ?? null
  // 결과 객체는 렌더마다 새로 온다. 안의 함수(mutate, report…)는 그대로라 그것만 쥔다
  const { mutate: removePost } = useDeletePost()
  const { isAdmin, signedIn, report, block, adminDelete } = usePostModeration()
  const [reporting, setReporting] = useState<Post | null>(null)
  // 부르는 쪽은 렌더마다 새 화살표를 넘긴다. 그것에 기대면 차림표가 매번 새로 생겨 PostCard 의 memo 가
  // 헛돈다 — 최신 것을 ref 에 두고 누를 때 읽는다
  const latest = useRef({ onEdit, onRequireLogin, onGone })
  latest.current = { onEdit, onRequireLogin, onGone }

  // 차림표는 내 글용과 남의 글용 둘뿐이다. 글마다 새로 만들지 않는다
  const menus = useMemo(() => {
    const gone = (p: Post) => latest.current.onGone?.(p)
    const base: Omit<PostMenuProps, 'post' | 'mine'> = {
      isAdmin,
      signedIn,
      onEdit: p => latest.current.onEdit?.(p),
      onDelete: p =>
        removePost(p, {
          onSuccess: () => gone(p),
          onError: e => Alert.alert('지우지 못했습니다', messageOf(e)),
        }),
      onReport: setReporting,
      onBlock: p => {
        block(p).then(
          () => gone(p),
          e => Alert.alert('차단하지 못했습니다', messageOf(e)),
        )
      },
      onAdminDelete: p => {
        adminDelete(p).then(
          () => gone(p),
          e => Alert.alert('내리지 못했습니다', messageOf(e)),
        )
      },
      onRequireLogin: () => latest.current.onRequireLogin?.(),
    }
    return { mine: { ...base, mine: true }, others: { ...base, mine: false } }
  }, [adminDelete, block, isAdmin, removePost, signedIn])

  const menuFor = useCallback(
    (post: Post): Omit<PostMenuProps, 'post'> => (post.authorId === me ? menus.mine : menus.others),
    [me, menus],
  )

  const submitReport = useCallback(
    (reason: string) => {
      const target = reporting
      setReporting(null)
      if (!target) return
      report(target, reason).then(
        () => Alert.alert('신고했습니다', '확인 후 조치하겠습니다.'),
        e => Alert.alert('신고하지 못했습니다', messageOf(e)),
      )
    },
    [report, reporting],
  )

  const sheet = (
    <ReportSheet open={reporting !== null} onClose={() => setReporting(null)} onSubmit={submitReport} />
  )

  return { menuFor, sheet }
}

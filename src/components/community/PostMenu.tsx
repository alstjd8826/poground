import { useMemo, useState } from 'react'
import { Alert } from 'react-native'

import { DropdownMenu, type MenuAnchor, type MenuItem } from '@/components/foundation/DropdownMenu'
import { MoreDots } from '@/components/foundation/MoreDots'
import type { Post } from '@/models/community'

export interface PostMenuProps {
  post: Post
  mine: boolean
  isAdmin: boolean
  signedIn: boolean
  onEdit: (post: Post) => void
  onDelete: (post: Post) => void
  onReport: (post: Post) => void
  onBlock: (post: Post) => void
  onAdminDelete: (post: Post) => void
  onRequireLogin?: () => void
}

/**
 * 게시글 ⋮. 내 글은 수정·삭제, 남의 글은 신고·차단(심사 지침 1.2), 관리자는 남의 글도 내린다.
 *
 * 로그인 전이면 신고·차단을 누를 때 로그인부터 청한다 — 둘 다 누가 했는지 남아야 한다(댓글
 * 차림표와 같다). 되돌릴 수 없는 것(삭제·차단·관리자 삭제)은 한 번 묻는다.
 */
export function PostMenu({
  post,
  mine,
  isAdmin,
  signedIn,
  onEdit,
  onDelete,
  onReport,
  onBlock,
  onAdminDelete,
  onRequireLogin,
}: PostMenuProps) {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)
  const items = useMemo<MenuItem[]>(() => {
    if (mine) {
      return [
        { label: '수정', onPress: () => onEdit(post) },
        {
          label: '삭제',
          destructive: true,
          onPress: () =>
            confirm('글을 지울까요?', '지운 글은 되살릴 수 없습니다.', '지우기', () => onDelete(post)),
        },
      ]
    }
    const needLogin = (run: () => void) => (signedIn ? run : () => onRequireLogin?.())
    const list: MenuItem[] = [
      { label: '신고', onPress: needLogin(() => onReport(post)) },
      {
        label: '이 사용자 차단',
        onPress: needLogin(() =>
          confirm(
            '이 사용자를 차단할까요?',
            '이 사람의 글과 댓글이 나에게 안 보입니다. 마이 → 내 계정 → 차단한 사용자에서 풀 수 있습니다.',
            '차단',
            () => onBlock(post),
          ),
        ),
      },
    ]
    if (isAdmin) {
      list.push({
        label: '삭제',
        destructive: true,
        onPress: () =>
          confirm('이 글을 내릴까요?', '관리자 삭제입니다. 되살릴 수 없습니다.', '내리기', () =>
            onAdminDelete(post),
          ),
      })
    }
    return list
  }, [isAdmin, mine, onAdminDelete, onBlock, onDelete, onEdit, onReport, onRequireLogin, post, signedIn])

  return (
    <>
      <MoreDots onPress={setAnchor} accessibilityLabel="글 더보기" />
      <DropdownMenu anchor={anchor} items={items} onClose={() => setAnchor(null)} />
    </>
  )
}

function confirm(title: string, message: string, ok: string, run: () => void) {
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: run },
  ])
}

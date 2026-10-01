import { useCallback, useLayoutEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'

import { HeaderAction, type SaveAction } from '@/components/foundation/HeaderAction'
import { useRequireSession } from '@/hooks/auth/useRequireSession'
import { PostComposerScreen } from '@/screens/PostComposerScreen'
import type { PostMatchKey } from '@/models/community'
import type { DetailNavigation } from '../types'

/**
 * 글쓰기·고치기. 올리기는 헤더 오른쪽에 건다 — 카드 만들기의 저장과 같은 자리다.
 *
 * 새 글을 올리면 그 글 상세로 바꿔 연다. 나만 보기 글은 피드에 안 나오므로 돌아가기만 하면
 * 방금 쓴 글이 어디 갔는지 알 수 없다. 고치기는 온 자리로 돌아간다.
 */
export function PostComposerRoute({ postId, match }: { postId?: string; match?: PostMatchKey }) {
  useRequireSession()
  const navigation = useNavigation<DetailNavigation>()
  const [action, setAction] = useState<SaveAction | null>(null)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (action ? <HeaderAction label={postId ? '저장' : '올리기'} {...action} /> : null),
    })
  }, [navigation, action, postId])
  const onDone = useCallback(
    (id: string, created: boolean) => {
      if (created) navigation.replace('Post', { postId: id })
      else navigation.goBack()
    },
    [navigation],
  )
  return <PostComposerScreen postId={postId} match={match} onSaveAction={setAction} onDone={onDone} />
}

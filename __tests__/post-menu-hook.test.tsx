import { renderHook } from '@testing-library/react-native'

import { usePostMenu } from '@/components/community/usePostMenu'
import type { Post } from '@/models/community'

/**
 * PostCard 는 memo 다. 차림표가 렌더마다 새 객체면 피드의 모든 카드가 매번 다시 그려진다.
 * 훅들은 실제처럼 렌더마다 새 결과 객체를 주되 안의 함수는 그대로 둔다(react-query 의 mutate 가 그렇다)
 */
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'me' } } }) }))
const mockMutate = jest.fn()
const mockModeration = { report: jest.fn(), block: jest.fn(), adminDelete: jest.fn() }
jest.mock('@/hooks/community/useCommunity', () => ({
  useDeletePost: () => ({ mutate: mockMutate, isPending: false }),
  usePostModeration: () => ({ signedIn: true, isAdmin: false, ...mockModeration }),
}))
jest.mock('@/components/comment/ReportSheet', () => ({ ReportSheet: () => null }))

const post = (id: string, authorId: string) => ({ id, authorId }) as Post

it('다시 그려도 같은 글의 차림표는 같은 객체다', () => {
  // 부르는 쪽은 매번 새 화살표를 넘긴다(라우트 래퍼)
  const { result, rerender } = renderHook(() => usePostMenu({ onEdit: () => {}, onRequireLogin: () => {} }))
  const first = result.current.menuFor(post('p1', 'other'))
  rerender({})
  expect(result.current.menuFor(post('p1', 'other'))).toBe(first)
})

it('내 글과 남의 글은 mine 으로 가른다', () => {
  const { result } = renderHook(() => usePostMenu({}))
  expect(result.current.menuFor(post('p1', 'me')).mine).toBe(true)
  expect(result.current.menuFor(post('p2', 'other')).mine).toBe(false)
})

it('고치기는 마지막으로 넘긴 onEdit 을 부른다', () => {
  const edits: string[] = []
  const { result, rerender } = renderHook(
    ({ tag }: { tag: string }) => usePostMenu({ onEdit: p => edits.push(`${tag}:${p.id}`) }),
    { initialProps: { tag: 'a' } },
  )
  rerender({ tag: 'b' })
  result.current.menuFor(post('p1', 'me')).onEdit(post('p1', 'me'))
  expect(edits).toEqual(['b:p1'])
})

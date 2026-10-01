import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { CommentComposer } from '@/components/comment/CommentComposer'
import type { Comment } from '@/repositories/comment/remote'

/** 답글을 고르면 입력 맨 앞에 @아이디 가 들어간다 (2026-09-29) */

const mockSearch = jest.fn(async (_q: string) => [{ id: 'u1', handle: 'steel', avatarUrl: null }])
jest.mock('@/repositories/profile/search', () => ({
  MENTION_SUGGEST_LIMIT: 5,
  searchHandles: (q: string) => mockSearch(q),
}))
jest.mock('@/hooks/comment/useComments', () => ({
  useComments: () => ({ me: 'me', add: { mutateAsync: jest.fn(), isPending: false } }),
}))

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}
const subject = { type: 'match' as const, id: '180' }
const target = (handle: string | null) =>
  ({ id: 'c1', parentId: null, authorId: 'u1', handle, body: 'x' }) as unknown as Comment

const view = (replyTo: Comment | null) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider initialPreference="home">
      <CommentComposer subject={subject} replyTo={replyTo} onClearReply={jest.fn()} />
    </ThemeProvider>
  </SafeAreaProvider>
)

it('답글을 고르면 입력이 @아이디 로 시작한다', async () => {
  render(view(target('steel')))
  expect(await screen.findByDisplayValue('@steel ')).toBeTruthy()
})

it('답글 대상을 바꾸면 언급도 바뀐다', async () => {
  const { rerender } = render(view(target('steel')))
  await screen.findByDisplayValue('@steel ')
  rerender(view(target('pohang')))
  expect(await screen.findByDisplayValue('@pohang ')).toBeTruthy()
})

it('아이디가 없는 사람에게 답하면 언급을 넣지 않는다', async () => {
  render(view(target(null)))
  expect(screen.queryByDisplayValue(/@/)).toBeNull()
})

/** @ 를 치면 아이디 후보를 띄운다 (2026-09-29) */
describe('언급 후보', () => {
  it('@글자 를 치면 후보가 뜨고, 고르면 @아이디 로 바뀐다', async () => {
    render(view(null))
    fireEvent.press(screen.getByLabelText('댓글 쓰기'))
    fireEvent.changeText(await screen.findByLabelText('댓글 입력'), '안녕 @st')
    fireEvent.press(await screen.findByLabelText('@steel 고르기'))
    expect(mockSearch).toHaveBeenLastCalledWith('st')
    expect(await screen.findByDisplayValue('안녕 @steel')).toBeTruthy()
    expect(screen.queryByLabelText('@steel 고르기')).toBeNull()
  })

  it('@ 없이 치면 찾지 않는다', async () => {
    mockSearch.mockClear()
    render(view(null))
    fireEvent.press(screen.getByLabelText('댓글 쓰기'))
    fireEvent.changeText(await screen.findByLabelText('댓글 입력'), '그냥 댓글')
    await new Promise(r => setTimeout(r, 250))
    expect(mockSearch).not.toHaveBeenCalled()
  })
})

/** 갤럭시에서 "댓글을 남겨보세요" 칸 아래 테두리가 하단 내비게이션 바에 붙어 묻혔다 (2026-09-30) */
it('안드로이드에서는 하단 바 위에 틈을 더 둔다', () => {
  const { Platform, StyleSheet, View } = jest.requireActual('react-native')
  const os = Platform.OS
  Platform.OS = 'android'
  render(view(null))
  const opener = screen.getByRole('button', { name: '댓글 쓰기' })
  let dock = opener.parent
  while (dock && !(dock.type === View && dock.props.onLayout)) dock = dock.parent
  expect(StyleSheet.flatten(dock!.props.style).paddingBottom).toBeGreaterThan(34)
  Platform.OS = os
})

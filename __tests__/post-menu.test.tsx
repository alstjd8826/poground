import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { PostMenu, type PostMenuProps } from '@/components/community/PostMenu'
import type { Post } from '@/models/community'

/**
 * 게시글 ⋮. 내 글은 수정·삭제, 남의 글은 신고·차단(심사 지침 1.2), 관리자는 남의 글도 내린다
 * (3단계, 2026-09-29). 로그인 전이면 신고·차단은 로그인부터.
 */

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

const post = { id: 'p1', authorId: 'u1' } as Post
const handlers = () => ({
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onReport: jest.fn(),
  onBlock: jest.fn(),
  onAdminDelete: jest.fn(),
  onRequireLogin: jest.fn(),
})
const open = (props: Partial<PostMenuProps> & ReturnType<typeof handlers>) => {
  render(
    <ThemeProvider initialPreference="home">
      <PostMenu post={post} mine={false} isAdmin={false} signedIn {...props} />
    </ThemeProvider>,
  )
  fireEvent.press(screen.getByLabelText('글 더보기'))
}
/** Alert 의 파괴 단추를 누른 것으로 친다 */
const confirmAlerts = () =>
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find(b => b.style === 'destructive')?.onPress?.()
  })

afterEach(() => jest.restoreAllMocks())

it('내 글이면 수정·삭제만 있다', async () => {
  const h = handlers()
  open({ ...h, mine: true })
  expect(await screen.findByText('수정')).toBeTruthy()
  expect(screen.getByText('삭제')).toBeTruthy()
  expect(screen.queryByText('신고')).toBeNull()
})

it('남의 글이면 신고·이 사용자 차단이 있고 수정은 없다', async () => {
  const h = handlers()
  open(h)
  expect(await screen.findByText('신고')).toBeTruthy()
  expect(screen.getByText('이 사용자 차단')).toBeTruthy()
  expect(screen.queryByText('수정')).toBeNull()
  expect(screen.queryByText('삭제')).toBeNull()
})

it('신고를 누르면 알린다', async () => {
  const h = handlers()
  open(h)
  fireEvent.press(await screen.findByText('신고'))
  await waitFor(() => expect(h.onReport).toHaveBeenCalledWith(post))
})

it('차단은 한 번 묻고 한다', async () => {
  const alert = confirmAlerts()
  const h = handlers()
  open(h)
  fireEvent.press(await screen.findByText('이 사용자 차단'))
  await waitFor(() => expect(h.onBlock).toHaveBeenCalledWith(post))
  expect(alert).toHaveBeenCalledWith('이 사용자를 차단할까요?', expect.any(String), expect.any(Array))
})

it('관리자면 남의 글에 삭제가 더 있고, 한 번 묻고 내린다', async () => {
  confirmAlerts()
  const h = handlers()
  open({ ...h, isAdmin: true })
  fireEvent.press(await screen.findByText('삭제'))
  await waitFor(() => expect(h.onAdminDelete).toHaveBeenCalledWith(post))
})

it('로그인 전이면 신고·차단을 누를 때 로그인부터', async () => {
  const h = handlers()
  open({ ...h, signedIn: false })
  fireEvent.press(await screen.findByText('신고'))
  await waitFor(() => expect(h.onRequireLogin).toHaveBeenCalled())
  expect(h.onReport).not.toHaveBeenCalled()
})

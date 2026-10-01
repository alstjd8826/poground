import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { BlockedUsersScreen } from '@/screens/BlockedUsersScreen'

/**
 * 차단한 사용자 목록 (2026-09-29). 전에는 가려진 댓글의 ⋮ 에서만 풀 수 있어, 그 사람 글이 피드에서 다 빠지면
 * 풀 길이 없었다.
 */

const mockUnblock = jest.fn()
let mockState: {
  people: { id: string; handle: string | null; avatarUrl: string | null }[]
  isPending: boolean
} = {
  people: [],
  isPending: false,
}
jest.mock('@/hooks/comment/useBlockedUsers', () => ({
  useBlockedUsers: () => ({ ...mockState, unblock: { mutate: mockUnblock, isPending: false } }),
}))

const wrap = () =>
  render(
    <ThemeProvider initialPreference="home">
      <BlockedUsersScreen />
    </ThemeProvider>,
  )

beforeEach(() => {
  mockUnblock.mockClear()
  mockState = { people: [], isPending: false }
})

it('차단한 사람을 @아이디 로 보여 주고 풀 수 있다', async () => {
  mockState.people = [{ id: 'u1', handle: 'test_fan', avatarUrl: null }]
  wrap()
  expect(screen.getByText('@test_fan')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('@test_fan 차단 풀기'))
  await waitFor(() => expect(mockUnblock).toHaveBeenCalledWith('u1'))
})

it('아이디가 없는 사람은 포항 팬으로 적는다', () => {
  mockState.people = [{ id: 'u2', handle: null, avatarUrl: null }]
  wrap()
  expect(screen.getByText('포항 팬')).toBeTruthy()
})

it('아무도 없으면 안내한다', () => {
  wrap()
  expect(screen.getByText('차단한 사용자가 없습니다')).toBeTruthy()
})

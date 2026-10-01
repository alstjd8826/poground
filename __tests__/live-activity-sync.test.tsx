import { Platform } from 'react-native'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { useLiveActivitySync } from '@/liveActivity/useLiveActivitySync'
import { KickoffCountdownButton } from '@/liveActivity/KickoffCountdownButton'
import { readActive } from '@/liveActivity/state'
import { resetNotificationPrefsForTest } from '@/notifications/prefs'
import { attendanceKeyOf } from '@/models/attendance'
import { mockMatchScheduled } from '@/utils/fixtures'

/** 잠금 화면 킥오프 카운트다운을 실제로 띄우고 내린다 (2026-09-30). iOS 에서만 */

const mockStart = jest.fn(async (..._args: unknown[]) => 'activity-1')
const mockEndAll = jest.fn(async () => {})
jest.mock('@use-voltra/ios-client', () => ({
  startLiveActivity: (...args: unknown[]) => mockStart(...args),
  endAllLiveActivities: () => mockEndAll(),
}))
jest.mock('@use-voltra/ios', () => {
  const { createElement } = jest.requireActual('react')
  const tag = (name: string) => (props: object) => createElement(name, props)
  return {
    Voltra: {
      VStack: tag('VStack'),
      HStack: tag('HStack'),
      Text: tag('Text'),
      Timer: tag('Timer'),
      Spacer: tag('Spacer'),
    },
  }
})

// 두 시간 뒤 킥오프하는 직관 경기
const mockSoon = { ...mockMatchScheduled, id: 700, kickoffAtMs: Date.now() + 2 * 3_600_000 }
let mockRows: unknown[] = []
jest.mock('@/hooks/attendance/useAttendances', () => ({ useAttendances: () => ({ rows: mockRows }) }))
jest.mock('@/hooks/query/useKleague', () => ({ useMatches: () => ({ data: [mockSoon] }) }))

const os = Platform.OS
beforeEach(async () => {
  Platform.OS = 'ios'
  await AsyncStorage.clear()
  resetNotificationPrefsForTest()
  mockStart.mockClear()
  mockEndAll.mockClear()
  mockRows = []
})
afterAll(() => {
  Platform.OS = os
})

it('직관 경기 당일이면 앱을 열 때 카운트다운을 띄우고 기억한다', async () => {
  mockRows = [{ ...attendanceKeyOf(mockSoon), updatedAt: 'x' }]
  renderHook(() => useLiveActivitySync())
  await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1))
  // 누르면 그 경기 상세로 — 알림·댓글 딥링크와 같은 주소
  expect(mockStart.mock.calls[0]![1]).toMatchObject({ deepLinkUrl: 'poground://comment?type=match&id=700' })
  await waitFor(async () => expect(await readActive()).toEqual({ gameId: 700, manual: false }))
})

it('직관 체크를 풀면 내리고 잊는다', async () => {
  mockRows = [{ ...attendanceKeyOf(mockSoon), updatedAt: 'x' }]
  const { rerender } = renderHook(() => useLiveActivitySync())
  await waitFor(() => expect(mockStart).toHaveBeenCalled())
  mockRows = []
  rerender({})
  await waitFor(() => expect(mockEndAll).toHaveBeenCalled())
  await waitFor(async () => expect(await readActive()).toBeNull())
})

it('안드로이드에서는 아무것도 하지 않는다', async () => {
  Platform.OS = 'android'
  mockRows = [{ ...attendanceKeyOf(mockSoon), updatedAt: 'x' }]
  renderHook(() => useLiveActivitySync())
  await act(async () => {})
  expect(mockStart).not.toHaveBeenCalled()
})

describe('경기 상세의 잠금 화면에 띄우기', () => {
  const wrap = () =>
    render(
      <ThemeProvider initialPreference="home">
        <KickoffCountdownButton match={mockSoon} />
      </ThemeProvider>,
    )

  it('킥오프 24시간 안의 예정 경기면 직접 띄울 수 있고, 직접 띄운 것으로 기억한다', async () => {
    wrap()
    fireEvent.press(screen.getByRole('button', { name: '잠금 화면에 띄우기' }))
    await waitFor(() => expect(mockStart).toHaveBeenCalled())
    await waitFor(async () => expect(await readActive()).toEqual({ gameId: 700, manual: true }))
  })

  it('안드로이드와 먼 경기에는 두지 않는다', () => {
    Platform.OS = 'android'
    const { unmount } = wrap()
    expect(screen.queryByRole('button', { name: '잠금 화면에 띄우기' })).toBeNull()
    unmount()
    Platform.OS = 'ios'
    render(
      <ThemeProvider initialPreference="home">
        <KickoffCountdownButton match={{ ...mockSoon, kickoffAtMs: Date.now() + 3 * 86_400_000 }} />
      </ThemeProvider>,
    )
    expect(screen.queryByRole('button', { name: '잠금 화면에 띄우기' })).toBeNull()
  })
})

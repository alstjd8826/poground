import { Switch } from 'react-native'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { NotificationSettingsScreen } from '@/screens/NotificationSettingsScreen'
import { resetNotificationPrefsForTest, useNotificationPrefs } from '@/notifications/prefs'
import { resyncNotifications, useNotificationSync } from '@/notifications/useNotificationSync'
import { attendanceKeyOf } from '@/models/attendance'
import { mockMatchScheduled } from '@/utils/fixtures'

/** 알림 설정 (2026-09-30). 직관 경기 알림(기본 켜짐)과 모든 경기 킥오프 알림(기본 꺼짐)을 따로 켜고 끈다 */

let mockAllowed = true
const mockEnsure = jest.fn(async () => mockAllowed)
const mockSync = jest.fn(async () => {})
jest.mock('@/notifications/scheduler', () => ({
  ensurePermission: () => mockEnsure(),
  syncScheduled: (...args: unknown[]) => mockSync(...(args as [])),
  permissionGranted: async () => mockAllowed,
}))
let mockRows: unknown[] = []
jest.mock('@/hooks/attendance/useAttendances', () => ({ useAttendances: () => ({ rows: mockRows }) }))
// 사흘 뒤 경기. 픽스처의 예정 경기(9월 20일)는 오늘보다 앞일 수 있다
const mockFuture = { ...mockMatchScheduled, id: 500, kickoffAtMs: Date.now() + 3 * 86_400_000 }
jest.mock('@/hooks/query/useKleague', () => ({ useMatches: () => ({ data: [mockFuture] }) }))

const wrap = () =>
  render(
    <ThemeProvider initialPreference="home">
      <NotificationSettingsScreen />
    </ThemeProvider>,
  )
const toggle = (label: string) =>
  screen.UNSAFE_getAllByType(Switch).find(s => s.props.accessibilityLabel === label)!

beforeEach(async () => {
  await AsyncStorage.clear()
  resetNotificationPrefsForTest()
  mockAllowed = true
  mockEnsure.mockClear()
  mockSync.mockClear()
  mockRows = []
})

it('기본은 직관 경기 알림 켜짐, 모든 경기 알림 꺼짐', async () => {
  wrap()
  await waitFor(() => expect(toggle('직관 경기 알림').props.value).toBe(true))
  expect(toggle('모든 경기 킥오프 알림').props.value).toBe(false)
})

it('켤 때 알림 허락을 받고, 설정을 기기에 남긴다', async () => {
  wrap()
  await act(async () => fireEvent(toggle('모든 경기 킥오프 알림'), 'valueChange', true))
  expect(mockEnsure).toHaveBeenCalled()
  expect(toggle('모든 경기 킥오프 알림').props.value).toBe(true)
  expect(JSON.parse((await AsyncStorage.getItem('notificationPrefs'))!)).toMatchObject({ allKickoffs: true })
})

it('허락을 못 받으면 설정 앱으로 가라고 안내한다', async () => {
  mockAllowed = false
  wrap()
  await waitFor(() => expect(screen.getByText(/설정에서 포그라운드 알림을 켜 주세요/)).toBeTruthy())
})

it('직관 표시나 설정이 바뀌면 다시 계획해 예약한다', async () => {
  const { result } = renderHook(() => useNotificationPrefs())
  const { rerender } = renderHook(() => useNotificationSync())
  await waitFor(() => expect(mockSync).toHaveBeenCalled())
  // 아직 직관 표시가 없고 모든 경기 알림은 꺼져 있다 — 잡을 것이 없다
  expect(mockSync).toHaveBeenLastCalledWith([])

  mockRows = [{ ...attendanceKeyOf(mockFuture), updatedAt: 'x' }]
  mockSync.mockClear()
  rerender({})
  await waitFor(() => expect(mockSync).toHaveBeenCalled())
  const plan = (mockSync.mock.calls.at(-1) as unknown as [{ id: string }[]])[0]
  expect(plan.map(n => n.id)).toEqual(['eve-500', 'kick-500'])

  mockSync.mockClear()
  await act(async () => result.current.setPrefs({ attended: false }))
  rerender({})
  await waitFor(() => expect(mockSync).toHaveBeenCalledWith([]))
})

/** 허락을 받은 순간 바로 잡는다. 허락 창에서 돌아오는 것만 믿으면 기기에 따라 다음에 앱을 열 때까지 비어 있다 */
it('다시 잡아 달라고 하면 곧바로 다시 잡는다', async () => {
  renderHook(() => useNotificationSync())
  await waitFor(() => expect(mockSync).toHaveBeenCalled())
  mockSync.mockClear()
  act(() => resyncNotifications())
  await waitFor(() => expect(mockSync).toHaveBeenCalled())
})

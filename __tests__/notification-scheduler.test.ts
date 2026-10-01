import { ensurePermission, syncScheduled, urlOfResponse } from '@/notifications/scheduler'
import type { PlannedNotification } from '@/models/notificationPlan'

/**
 * 계획을 기기에 예약한다 (2026-09-30). 예약은 통째로 새로 한다 — 우리가 잡은 알림을 지우고 다시 잡으면
 * 킥오프 시간이 바뀌거나 직관 표시를 풀었을 때 옛 알림이 남지 않는다
 */

const mockCalls: string[] = []
let mockStatus: 'granted' | 'denied' | 'undetermined' = 'granted'
let mockCanAskAgain = true
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: async () => ({ status: mockStatus, canAskAgain: mockCanAskAgain }),
  requestPermissionsAsync: async () => {
    mockCalls.push('request')
    mockStatus = 'granted'
    return { status: mockStatus }
  },
  setNotificationChannelAsync: async (id: string) => void mockCalls.push(`channel ${id}`),
  cancelAllScheduledNotificationsAsync: async () => void mockCalls.push('cancelAll'),
  scheduleNotificationAsync: async (req: { identifier: string; trigger: { date: Date } }) =>
    void mockCalls.push(`schedule ${req.identifier} ${req.trigger.date.toISOString()}`),
}))

const plan: PlannedNotification[] = [
  { id: 'eve-1', at: Date.UTC(2026, 8, 19, 11), title: '내일 직관이에요', body: 'b', gameId: 1 },
  { id: 'kick-1', at: Date.UTC(2026, 8, 20, 9), title: '1시간 뒤 킥오프', body: 'b', gameId: 1 },
]

beforeEach(() => {
  mockCalls.length = 0
  mockStatus = 'granted'
  mockCanAskAgain = true
})

it('허락됐으면 우리 알림을 모두 지우고 계획대로 다시 잡는다', async () => {
  await syncScheduled(plan)
  const i = mockCalls.indexOf('cancelAll')
  expect(i).toBeGreaterThanOrEqual(0)
  expect(mockCalls.slice(i + 1)).toEqual([
    'schedule eve-1 2026-09-19T11:00:00.000Z',
    'schedule kick-1 2026-09-20T09:00:00.000Z',
  ])
})

it('허락되지 않았으면 묻지도 잡지도 않는다 — 묻는 것은 사용자가 켤 때', async () => {
  mockStatus = 'undetermined'
  await syncScheduled(plan)
  expect(mockCalls.filter(c => c.startsWith('schedule') || c === 'request')).toEqual([])
})

it('아직 안 물었으면 묻고, 거절했으면 다시 묻지 않는다', async () => {
  mockStatus = 'undetermined'
  expect(await ensurePermission()).toBe(true)
  expect(mockCalls).toContain('request')

  mockCalls.length = 0
  mockStatus = 'denied'
  mockCanAskAgain = false
  expect(await ensurePermission()).toBe(false)
  expect(mockCalls).not.toContain('request')
})

it('알림을 누르면 그 경기 상세 주소를 돌려준다', () => {
  const response = { notification: { request: { content: { data: { gameId: 178 } } } } }
  expect(urlOfResponse(response as never)).toBe('poground://comment?type=match&id=178')
  expect(urlOfResponse({ notification: { request: { content: { data: {} } } } } as never)).toBeNull()
})

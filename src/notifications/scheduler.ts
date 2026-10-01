import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

import { commentUrl } from '@/navigation/deepLink'
import type { PlannedNotification } from '@/models/notificationPlan'

/**
 * 계획을 기기에 예약한다 (2026-09-30). 기기가 스스로 울리는 로컬 알림이라 서버·푸시 자격이 필요 없다
 * (withoutPushEntitlement).
 *
 * 예약은 통째로 새로 한다 — 우리가 잡은 알림을 모두 지우고 다시 잡는다. 킥오프 시간이 바뀌거나 직관 표시를
 * 풀었을 때 옛 알림이 남지 않고, 무엇이 잡혀 있는지 따로 기억할 필요도 없다. 이 앱이 잡는 예약 알림은 이것뿐이다.
 */

/** 안드로이드 알림 채널. 설정 앱에서 사용자가 이 이름으로 끄고 켠다 */
const CHANNEL = 'matches'

/** 허락됐는지. 묻지는 않는다 — 앱을 켜자마자 묻지 않고, 사용자가 알림을 켤 때 묻는다(ensurePermission) */
export async function permissionGranted(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync()
  return status === 'granted'
}

/**
 * 알림 허락을 받는다. 아직 안 물었으면 묻고, 이미 거절해 다시 물을 수 없으면 false — 그때는 설정 앱으로
 * 안내한다(알림 설정 화면).
 */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.status === 'granted') return true
  if (current.status === 'denied' && !current.canAskAgain) return false
  const next = await Notifications.requestPermissionsAsync()
  return next.status === 'granted'
}

export async function syncScheduled(plan: PlannedNotification[]): Promise<void> {
  if (!(await permissionGranted())) return
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: '경기 알림',
      importance: Notifications.AndroidImportance.HIGH,
    })
  }
  await Notifications.cancelAllScheduledNotificationsAsync()
  for (const n of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { gameId: n.gameId } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(n.at),
        channelId: CHANNEL,
      },
    })
  }
}

/** 알림을 누르면 열 주소. 경기 상세로 — 댓글 딥링크와 같은 길이라 탭 첫 화면을 밑에 깔고 연다 */
export function urlOfResponse(response: Notifications.NotificationResponse): string | null {
  const gameId = (response.notification.request.content.data as { gameId?: unknown } | undefined)?.gameId
  if (typeof gameId !== 'number') return null
  return commentUrl({ type: 'match', id: String(gameId) })
}

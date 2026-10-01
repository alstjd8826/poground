import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'

import { openFromUrl } from '@/navigation/deepLink'
import { urlOfResponse } from './scheduler'

/**
 * 앱이 떠 있을 때 온 알림도 배너로 보인다. 기본값이면 앞에 떠 있는 동안 온 알림은 조용히 사라진다.
 * 소리는 내지 않는다 — 킥오프 알림이 경기 화면을 보는 도중에 울릴 까닭은 없다.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

/**
 * 알림을 누르면 그 경기 상세로 (2026-09-30). 댓글 딥링크와 같은 길(openFromUrl)을 타서 탭 첫 화면을 밑에
 * 깐다. 앱이 꺼져 있다 알림으로 켜진 경우도 받는다 — 그때는 내비게이터가 늦게 서므로 한 박자 뒤에 한 번 더 본다.
 */
export function useNotificationTaps(): void {
  useEffect(() => {
    let alive = true
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!alive || !response) return
      const url = urlOfResponse(response)
      if (!url || openFromUrl(url)) return
      setTimeout(() => {
        if (alive) openFromUrl(url)
      }, 300)
    }
    // 알림으로 켜진 게 아니면 null 이다. 이 조회가 실패해도 앱을 켜는 일을 막지 않는다
    Promise.resolve()
      .then(() => Notifications.getLastNotificationResponseAsync())
      .then(open)
      .catch(() => {})
    const sub = Notifications.addNotificationResponseReceivedListener(open)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
}

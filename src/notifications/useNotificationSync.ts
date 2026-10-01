import { useEffect, useMemo } from 'react'
import { AppState } from 'react-native'

import { useAttendances } from '@/hooks/attendance/useAttendances'
import { useMatches } from '@/hooks/query/useKleague'
import { planNotifications } from '@/models/notificationPlan'
import { useNotificationPrefs } from './prefs'
import { syncScheduled } from './scheduler'

/**
 * 예약 알림을 지금 상태에 맞춘다 (2026-09-30). 앱 전체에 한 번 건다.
 *
 * 직관 표시, 경기 일정(킥오프 변경 포함), 알림 설정이 바뀔 때마다, 그리고 앱으로 돌아올 때마다 다시 잡는다.
 * 알림 허락이 없으면 scheduler 가 아무것도 하지 않는다 — 여기서 묻지 않는다.
 */
/** 지금 걸린 동기화들. 허락을 받은 순간 곧바로 다시 잡게 한다(resyncNotifications) */
const resyncers = new Set<() => void>()

/**
 * 곧바로 다시 잡아 달라고 한다. 알림 허락을 받은 직후에 부른다 — 허락 창에서 돌아올 때의 active 신호만 믿으면
 * 기기에 따라 다음에 앱을 열 때까지 아무것도 안 잡혀 있다.
 */
export function resyncNotifications(): void {
  resyncers.forEach(sync => sync())
}

export function useNotificationSync(): void {
  const { rows } = useAttendances()
  const { data: matches } = useMatches()
  const { prefs } = useNotificationPrefs()

  // 같은 계획이면 다시 잡지 않도록 글자로 비교한다. 목록 객체는 받을 때마다 새로 온다
  const signature = useMemo(
    () =>
      JSON.stringify({
        attended: rows.map(r => [r.year, r.leagueId, r.gameId]),
        matches: (matches ?? []).map(m => [m.id, m.status, m.kickoffAtMs]),
        prefs,
      }),
    [rows, matches, prefs],
  )

  useEffect(() => {
    const sync = () =>
      void syncScheduled(
        planNotifications({ matches: matches ?? [], attended: rows, prefs, now: Date.now() }),
      ).catch(() => {})
    sync()
    resyncers.add(sync)
    // 앱으로 돌아오면 한 번 더 — 그사이 허락을 켰거나 시간이 지나 지난 알림이 생겼을 수 있다
    const sub = AppState.addEventListener('change', s => s === 'active' && sync())
    return () => {
      resyncers.delete(sync)
      sub.remove()
    }
    // signature 가 바뀔 때만 다시 잡는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}

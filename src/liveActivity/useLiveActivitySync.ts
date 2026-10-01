import { useEffect, useMemo } from 'react'
import { AppState } from 'react-native'

import { useAttendances } from '@/hooks/attendance/useAttendances'
import { useMatches } from '@/hooks/query/useKleague'
import { liveActivityDecision } from '@/models/liveActivityPlan'
import { useNotificationPrefs } from '@/notifications/prefs'
import { endKickoff, liveActivitySupported, startKickoff } from './kickoff'
import { readActive } from './state'

/**
 * 잠금 화면 카운트다운을 지금 상태에 맞춘다 (2026-09-30). 앱 전체에 한 번 건다.
 *
 * iOS 는 앱이 켜져 있을 때만 새로 띄울 수 있다. 그래서 직관 표시·경기 일정·설정이 바뀔 때와 앱으로 돌아올 때마다
 * 무엇을 띄우고 내릴지 다시 정한다(liveActivityDecision). 전날 저녁·1시간 전 알림을 눌러 앱을 열면 그때 뜬다.
 */
export function useLiveActivitySync(): void {
  const { rows } = useAttendances()
  const { data: matches } = useMatches()
  const { prefs } = useNotificationPrefs()

  const signature = useMemo(
    () =>
      JSON.stringify({
        attended: rows.map(r => [r.year, r.leagueId, r.gameId]),
        matches: (matches ?? []).map(m => [m.id, m.status, m.kickoffAtMs]),
        enabled: prefs.liveActivity,
      }),
    [rows, matches, prefs.liveActivity],
  )

  useEffect(() => {
    if (!liveActivitySupported()) return
    const sync = async () => {
      const list = matches ?? []
      const decision = liveActivityDecision({
        matches: list,
        attended: rows,
        enabled: prefs.liveActivity,
        active: await readActive(),
        now: Date.now(),
      })
      if (decision.end) await endKickoff()
      const match = decision.start !== undefined ? list.find(m => m.id === decision.start) : undefined
      if (match) await startKickoff(match, false)
    }
    const run = () => void sync().catch(() => {})
    run()
    const sub = AppState.addEventListener('change', s => s === 'active' && run())
    return () => sub.remove()
    // signature 가 바뀔 때만 다시 정한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}

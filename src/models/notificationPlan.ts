import { type AttendanceKey, attendanceKeyOf, sameKey } from '@/models/attendance'
import type { Match } from '@/models/kleague'

/**
 * 기기가 스스로 울리는 알림의 계획 (2026-09-30). 서버 없이 예약해 둔다 — 서버 푸시는 유료 계정 뒤에.
 *
 * - 직관 경기 알림(기본 켜짐): 직관 가요 경기에 전날 저녁 8시 + 킥오프 1시간 전
 * - 모든 경기 킥오프 알림(기본 꺼짐): 포항 모든 예정 경기에 1시간 전. 직관 경기와 겹치면 한 번만
 *
 * 시각은 한국 시간으로 센다. 경기가 한국에서 열리고, 기기 시간대가 달라도 "전날 저녁 8시" 가 흔들리지 않게.
 */

export interface NotificationPrefs {
  /** 직관 경기 알림 — 전날 저녁과 1시간 전 */
  attended: boolean
  /** 모든 경기 킥오프 1시간 전 */
  allKickoffs: boolean
  /** 잠금 화면 킥오프 카운트다운(Live Activity, iOS). 알림은 아니지만 같은 화면에서 켜고 끈다 */
  liveActivity: boolean
}

export const DEFAULT_PREFS: NotificationPrefs = { attended: true, allKickoffs: false, liveActivity: true }

/** iOS 는 예약 알림을 64개까지 든다. 조금 남겨 둔다 */
export const MAX_SCHEDULED = 60

export interface PlannedNotification {
  /** 같은 알림을 다시 잡아도 겹치지 않게 경기와 종류로 짓는다 */
  id: string
  at: number
  title: string
  body: string
  gameId: number
}

const KST_MS = 9 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

/** 한국 시각의 연·월·일·시·분 */
function kst(ms: number) {
  const d = new Date(ms + KST_MS)
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    day: d.getUTCDate(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes(),
  }
}

const hhmm = (ms: number) => {
  const { h, min } = kst(ms)
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** 킥오프 전날 한국 시각 저녁 8시 */
function eveOf(kickoffMs: number): number {
  const { y, m, day } = kst(kickoffMs)
  return Date.UTC(y, m, day - 1, 20) - KST_MS
}

export function planNotifications({
  matches,
  attended,
  prefs,
  now,
}: {
  matches: Match[]
  attended: AttendanceKey[]
  prefs: Pick<NotificationPrefs, 'attended' | 'allKickoffs'>
  now: number
}): PlannedNotification[] {
  const out: PlannedNotification[] = []
  for (const match of matches) {
    if (match.status !== 'scheduled' || match.kickoffAtMs <= now) continue
    const going = attended.some(k => sameKey(k, attendanceKeyOf(match)))
    const names = `${match.home.name} vs ${match.away.name}`
    const place = match.stadium ? ` ${match.stadium}` : ''

    if (going && prefs.attended) {
      out.push({
        id: `eve-${match.id}`,
        at: eveOf(match.kickoffAtMs),
        title: '내일 직관이에요',
        body: `${names} · ${hhmm(match.kickoffAtMs)}${place}`,
        gameId: match.id,
      })
    }
    if ((going && prefs.attended) || prefs.allKickoffs) {
      out.push({
        id: `kick-${match.id}`,
        at: match.kickoffAtMs - HOUR_MS,
        title: '1시간 뒤 킥오프',
        body: match.stadium ? `${names} · ${match.stadium}` : names,
        gameId: match.id,
      })
    }
  }
  return out
    .filter(n => n.at > now)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_SCHEDULED)
}

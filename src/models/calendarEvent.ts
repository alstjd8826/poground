import type { Match } from '@/models/kleague'

/** 경기 한 판을 캘린더에 잡아 둘 길이. 킥오프부터 하프타임을 넣어 두 시간 */
const DURATION_MS = 2 * 60 * 60 * 1000

/** 미리 알림. 킥오프 1시간 전 (분, 음수가 앞) */
const REMIND_BEFORE_MIN = 60

export interface CalendarEvent {
  title: string
  startDate: Date
  endDate: Date
  location: string | undefined
  notes: string
  alarms: { relativeOffset: number }[]
}

/**
 * 예정 경기를 캘린더 일정으로 (2026-09-30). 제목은 홈 팀 먼저 — K리그 일정표와 같은 순서라 캘린더에서 보고
 * 헷갈리지 않는다. 알림은 iOS 는 그대로 걸리고, 안드로이드는 캘린더 앱에 따라 다를 수 있다.
 */
export function calendarEventOf(match: Match): CalendarEvent {
  const startDate = new Date(match.kickoffAtMs)
  return {
    title: `${match.home.name} vs ${match.away.name}`,
    startDate,
    endDate: new Date(match.kickoffAtMs + DURATION_MS),
    location: match.stadium ?? undefined,
    notes: match.round ? `K리그1 ${match.round}R · 포그라운드에서 추가` : 'K리그1 · 포그라운드에서 추가',
    alarms: [{ relativeOffset: -REMIND_BEFORE_MIN }],
  }
}

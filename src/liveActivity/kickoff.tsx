import { Platform } from 'react-native'
import { endAllLiveActivities, startLiveActivity } from '@use-voltra/ios-client'
import { Voltra } from '@use-voltra/ios'

import { commentUrl } from '@/navigation/deepLink'
import type { Match } from '@/models/kleague'
import type { ActiveCountdown } from '@/models/liveActivityPlan'
import { writeActive } from './state'

/**
 * 잠금 화면·다이내믹 아일랜드 킥오프 카운트다운 (2026-09-30, Voltra).
 *
 * 카운트다운은 iOS 가 스스로 센다(Timer = SwiftUI 타이머 글자). 앱이 꺼져도, 서버가 없어도 흘러간다. 킥오프가
 * 되면 "킥오프!" 로 바꾸는데, 그 글자는 iOS 가 위젯을 다시 그릴 때 바뀌어서 잠깐 0:00 에 머물 수 있다.
 * 누르면 그 경기 상세로 — 알림·댓글 딥링크와 같은 주소다.
 */

const RED = '#FB342E'
const WHITE = '#FFFFFF'
const FAINT = 'rgba(255,255,255,0.78)'
const TEMPLATES = JSON.stringify({ completed: '킥오프!' })

export const liveActivitySupported = () => Platform.OS === 'ios'

function variants(match: Match) {
  const title = `${match.home.name} vs ${match.away.name}`
  const countdown = (fontSize: number) => (
    <Voltra.Timer
      endAtMs={match.kickoffAtMs}
      direction="down"
      textStyle="timer"
      showHours
      textTemplates={TEMPLATES}
      style={{ color: WHITE, fontSize, fontWeight: '700' }}
    />
  )
  return {
    lockScreen: {
      activityBackgroundTint: RED,
      content: (
        <Voltra.VStack style={{ padding: 16 }}>
          <Voltra.Text style={{ color: FAINT, fontSize: 13 }}>포그라운드 · 킥오프까지</Voltra.Text>
          <Voltra.Text style={{ color: WHITE, fontSize: 20, fontWeight: '700' }}>
            {match.stadium ? `${title} · ${match.stadium}` : title}
          </Voltra.Text>
          {countdown(32)}
        </Voltra.VStack>
      ),
    },
    island: {
      keylineTint: RED,
      compact: {
        leading: <Voltra.Text style={{ color: RED, fontWeight: '700' }}>포항</Voltra.Text>,
        trailing: (
          <Voltra.Timer
            endAtMs={match.kickoffAtMs}
            direction="down"
            textStyle="timer"
            showHours
            textTemplates={TEMPLATES}
            style={{ color: WHITE }}
          />
        ),
      },
      minimal: <Voltra.Text style={{ color: RED, fontWeight: '700' }}>포</Voltra.Text>,
      expanded: {
        center: <Voltra.Text style={{ color: WHITE, fontWeight: '700' }}>{title}</Voltra.Text>,
        bottom: countdown(28),
      },
    },
  }
}

/** 한 번에 하나만 돈다. 앱을 열 때의 동기화와 경기 상세의 단추가 겹쳐도 차례로 */
let queue: Promise<unknown> = Promise.resolve()
const serial = <T,>(job: () => Promise<T>): Promise<T> => {
  const next = queue.then(job, job)
  queue = next.catch(() => {})
  return next
}

/** 떠 있는 카운트다운을 내리고 이 경기로 새로 띄운다. 기억해 둔다 */
export function startKickoff(match: Match, manual: boolean): Promise<void> {
  return serial(async () => {
    if (!liveActivitySupported()) return
    await endAllLiveActivities().catch(() => {})
    await startLiveActivity(variants(match), {
      activityName: `kickoff-${match.id}`,
      deepLinkUrl: commentUrl({ type: 'match', id: String(match.id) }),
    })
    const active: ActiveCountdown = { gameId: match.id, manual }
    await writeActive(active)
  })
}

export function endKickoff(): Promise<void> {
  return serial(async () => {
    if (!liveActivitySupported()) return
    await endAllLiveActivities().catch(() => {})
    await writeActive(null)
  })
}

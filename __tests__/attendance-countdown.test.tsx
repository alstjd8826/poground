import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AttendanceCountdown } from '@/components/match/AttendanceCountdown'
import { SEASON_YEAR } from '@/config/env'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'

/**
 * 직관 예정으로 표시해 둔 다음 경기는 홈 카드에 D-day 가 뜬다 (2026-09-29).
 * 카드 아래 한 줄이 어수선해 오른쪽 위 모서리에 걸친 테이프로 바꿨다 (2026-09-30)
 */

let mockRows: unknown[] = []
jest.mock('@/hooks/attendance/useAttendances', () => ({
  useAttendances: () => ({ rows: mockRows }),
}))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
const marked = (gameId: number) => [{ year: SEASON_YEAR, leagueId: 1, gameId, updatedAt: 'x' }]

beforeEach(() => {
  mockRows = []
})

it('직관 예정으로 표시한 경기면 D-day 를 띄운다', () => {
  mockRows = marked(mockMatchScheduled.id)
  const day = 86_400_000
  wrap(<AttendanceCountdown match={mockMatchScheduled} now={mockMatchScheduled.kickoffAtMs - 3 * day} />)
  expect(screen.getByText('D-3')).toBeTruthy()
  // 글자는 D-3 뿐이라 읽어 줄 때는 무엇의 D-day 인지 붙인다
  expect(screen.getByLabelText('직관 가요 D-3')).toBeTruthy()
})

it('카드 오른쪽 위 모서리에 걸치게 비스듬히 붙는다', () => {
  mockRows = marked(mockMatchScheduled.id)
  wrap(<AttendanceCountdown match={mockMatchScheduled} now={mockMatchScheduled.kickoffAtMs} />)
  const style = StyleSheet.flatten(screen.getByLabelText('직관 가요 D-DAY').props.style)
  expect(style.position).toBe('absolute')
  expect(style.right).toBeGreaterThan(0)
  // 위로 삐져나와야 카드 안과 밖에 걸친다
  expect(style.top).toBeLessThan(0)
  expect(style.transform).toEqual(
    expect.arrayContaining([expect.objectContaining({ rotate: expect.any(String) })]),
  )
})

it('표시하지 않은 경기면 아무것도 없다', () => {
  wrap(<AttendanceCountdown match={mockMatchScheduled} />)
  expect(screen.queryByText(/D-/)).toBeNull()
})

it('끝난 경기에는 띄우지 않는다', () => {
  mockRows = marked(mockMatchFinished.id)
  wrap(<AttendanceCountdown match={mockMatchFinished} />)
  expect(screen.queryByText(/D-/)).toBeNull()
})

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { MatchCard, MatchCardSkeleton } from '@/components/match/MatchCard'
import { StandingsTable } from '@/components/standings/StandingsTable'
import { InlineState } from '@/components/feedback/States'
import { mockMatchFinished, mockMatchScheduled, mockStandings } from '@/utils/fixtures'

/** 컴포넌트는 ThemeProvider 만 있으면 서버 없이 그려진다. */
const wrap = (ui: React.ReactElement, theme: 'home' | 'away' = 'home') =>
  render(<ThemeProvider initialPreference={theme}>{ui}</ThemeProvider>)

describe('MatchCard', () => {
  it('종료 경기는 스코어를 보여준다', () => {
    wrap(<MatchCard match={mockMatchFinished} />)
    // 스코어는 공유 전환 때문에 세 조각이다. 화면 낭독기에는 한 덩어리로 읽힌다
    expect(screen.getByLabelText('2 대 2')).toBeTruthy()
    expect(screen.queryByText('VS')).toBeNull()
    expect(screen.getByText('대전')).toBeTruthy()
  })

  it('미시작 경기는 0-0 대신 VS 를 보여준다', () => {
    wrap(<MatchCard match={mockMatchScheduled} />)
    expect(screen.getByText('VS')).toBeTruthy()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('두 테마 모두에서 그려진다', () => {
    expect(() => wrap(<MatchCard match={mockMatchFinished} />, 'home')).not.toThrow()
    expect(() => wrap(<MatchCard match={mockMatchFinished} />, 'away')).not.toThrow()
  })
})

describe('스켈레톤', () => {
  it('스크린리더에 노출되지 않는다', () => {
    const { toJSON } = wrap(<MatchCardSkeleton />)
    expect(JSON.stringify(toJSON())).toContain('accessibilityElementsHidden')
  })
})

describe('StandingsTable', () => {
  it('모든 구단 행을 그린다', () => {
    wrap(<StandingsTable standings={mockStandings} />)
    for (const s of mockStandings) expect(screen.getByText(s.teamName)).toBeTruthy()
  })
})

describe('홈 섹션 빈 상태', () => {
  it('데이터가 없어도 섹션마다 안내 문구가 남는다', () => {
    wrap(<InlineState message="예정된 경기가 없습니다" />)
    expect(screen.getByText('예정된 경기가 없습니다')).toBeTruthy()
  })

  it('에러일 때는 다시 시도를 함께 보여준다', () => {
    const onRetry = jest.fn()
    wrap(<InlineState tone="error" message="불러오지 못했습니다" onRetry={onRetry} />)
    expect(screen.getByText('불러오지 못했습니다')).toBeTruthy()
    fireEvent.press(screen.getByText('다시 시도'))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('InlineState 진행 중 표시', () => {
  it('busy 면 문구가 바뀌고 다시 시도가 사라진다', () => {
    wrap(<InlineState tone="error" message="불러오지 못했습니다" onRetry={() => {}} busy />)
    expect(screen.getByText('불러오는 중…')).toBeTruthy()
    expect(screen.queryByText('다시 시도')).toBeNull()
  })

  it('busy 중에는 눌러도 재시도가 다시 불리지 않는다', () => {
    const onRetry = jest.fn()
    wrap(<InlineState tone="error" message="불러오지 못했습니다" onRetry={onRetry} busy />)
    // 버튼이 없으므로 연타로 요청이 쌓이지 않는다
    expect(screen.queryByRole('button')).toBeNull()
    expect(onRetry).not.toHaveBeenCalled()
  })
})

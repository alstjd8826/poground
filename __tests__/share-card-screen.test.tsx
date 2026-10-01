import type React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { FairyCard } from '@/components/share/FairyCard'
import { MatchProofCard } from '@/components/share/MatchProofCard'
import { ShareCardScreen } from '@/screens/ShareCardScreen'
import type { FairyCardData, MatchProofData } from '@/models/shareCard'

/** 승리요정 공유 카드 (2026-09-30). 미리 보고, 공유하기를 누르면 카드를 찍어 시스템 공유 창을 연다 */

const mockCapture = jest.fn(async () => 'file:///tmp/card.png')
jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCapture(...(args as [])),
}))
const mockShare = jest.fn(async () => {})
let mockCanShare = true
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => mockCanShare,
  shareAsync: (...args: unknown[]) => mockShare(...(args as [])),
}))

const data: FairyCardData = {
  rate: '67%',
  played: 3,
  wins: 2,
  draws: 0,
  losses: 1,
  recent: [
    { gameId: 1, date: '9.20', opponent: '서울', score: '2:1', outcome: 'win' },
    { gameId: 2, date: '9.13', opponent: '울산', score: '0:1', outcome: 'loss' },
  ],
}
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}
const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider initialPreference="home">{ui}</ThemeProvider>
    </SafeAreaProvider>,
  )

beforeEach(() => {
  mockCapture.mockClear()
  mockShare.mockClear()
  mockCanShare = true
})

it('카드에 승률, 경기 수와 승무패, 최근 직관, 아이디와 앱 이름을 싣는다', () => {
  wrap(<FairyCard data={data} handle="fan" season={2026} />)
  expect(screen.getByText('67%')).toBeTruthy()
  expect(screen.getByText('직관 3경기 · 2승 0무 1패')).toBeTruthy()
  expect(screen.getByText('서울')).toBeTruthy()
  expect(screen.getByText('2:1')).toBeTruthy()
  expect(screen.getByText('@fan')).toBeTruthy()
  expect(screen.getByText(/포그라운드/)).toBeTruthy()
  expect(screen.getByText(/2026/)).toBeTruthy()
  // 비공식 문구는 싣지 않는다(2026-09-30 결정). 엠블럼·구단명을 쓰지 않아 공식 카드로 읽히지 않는다
  expect(screen.queryByText(/비공식/)).toBeNull()
})

/** 승률이 세 자리면(100%) 두 줄로 접혔다 (2026-09-30, 갤럭시). 한 줄에 두고 넘치면 글자를 줄인다 */
it('승률은 한 줄로, 넘치면 글자를 줄여 맞춘다', () => {
  wrap(<FairyCard data={{ ...data, rate: '100%' }} handle="fan" season={2026} />)
  const rate = screen.getByText('100%')
  expect(rate.props.numberOfLines).toBe(1)
  expect(rate.props.adjustsFontSizeToFit).toBe(true)
})

it('공유하기를 누르면 카드를 PNG 로 찍어 공유 창에 넘긴다', async () => {
  wrap(
    <ShareCardScreen
      title="승리요정 카드"
      renderCard={ref => <FairyCard ref={ref} data={data} handle="fan" season={2026} />}
    />,
  )
  fireEvent.press(screen.getByRole('button', { name: '공유하기' }))
  await waitFor(() => expect(mockShare).toHaveBeenCalled())
  expect(mockCapture).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ format: 'png', result: 'tmpfile' }),
  )
  expect(mockShare).toHaveBeenCalledWith(
    'file:///tmp/card.png',
    expect.objectContaining({ mimeType: 'image/png' }),
  )
})

it('공유를 쓸 수 없는 기기면 알린다', async () => {
  mockCanShare = false
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  wrap(
    <ShareCardScreen
      title="승리요정 카드"
      renderCard={ref => <FairyCard ref={ref} data={data} handle="fan" season={2026} />}
    />,
  )
  fireEvent.press(screen.getByRole('button', { name: '공유하기' }))
  await waitFor(() => expect(alert).toHaveBeenCalled())
  expect(mockShare).not.toHaveBeenCalled()
  alert.mockRestore()
})

const proof: MatchProofData = {
  us: '포항',
  them: '서울',
  ourGoal: 2,
  theirGoal: 1,
  outcome: 'win',
  date: '9.20 (일)',
  stadium: '포항 스틸야드',
  side: '홈',
}

describe('직관 인증 카드', () => {
  it('우리 팀 먼저 스코어, 결과, 날짜·경기장, 아이디를 싣는다', () => {
    wrap(<MatchProofCard data={proof} handle="fan" photoUri={null} />)
    expect(screen.getByText('포항')).toBeTruthy()
    expect(screen.getByText('서울')).toBeTruthy()
    expect(screen.getByText('2 : 1')).toBeTruthy()
    expect(screen.getByText('승')).toBeTruthy()
    expect(screen.getByText('9.20 (일) · 포항 스틸야드')).toBeTruthy()
    expect(screen.getByText('@fan')).toBeTruthy()
    expect(screen.getByText('직관 인증')).toBeTruthy()
  })

  it('내 직관 글 사진이 있으면 배경으로 깐다', () => {
    wrap(<MatchProofCard data={proof} handle="fan" photoUri="file:///photo.jpg" />)
    expect(screen.getByLabelText('직관 사진').props.source).toEqual({ uri: 'file:///photo.jpg' })
  })

  it('사진이 없으면 배경 사진을 두지 않는다', () => {
    wrap(<MatchProofCard data={proof} handle="fan" photoUri={null} />)
    expect(screen.queryByLabelText('직관 사진')).toBeNull()
  })
})

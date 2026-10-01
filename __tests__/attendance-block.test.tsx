import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AttendanceBlock } from '@/components/match/AttendanceBlock'
import { SEASON_YEAR } from '@/config/env'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'

/**
 * 경기 상세의 직관 표시. 끝난 경기든 예정 경기든 체크 칸 한 줄이다 (2026-09-29) — 강조 단추와
 * 큰 상자는 한 번 누르는 표시에 비해 자리를 너무 먹었다. 예매할 수 있으면 [티켓 예매] 가 위에 선다.
 */

const mockState = {
  rows: [] as unknown[],
  signedIn: true,
  toggle: jest.fn(),
}
const mockEnsure = jest.fn(async () => true)
jest.mock('@/notifications/scheduler', () => ({ ensurePermission: () => mockEnsure() }))
jest.mock('@/hooks/attendance/useAttendances', () => ({
  useAttendances: () => mockState,
}))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
const attended = (gameId: number) => ({
  year: SEASON_YEAR,
  leagueId: 1,
  gameId,
  updatedAt: 'x',
})
const box = (name: string) => screen.getByRole('checkbox', { name })

beforeEach(() => {
  mockState.rows = []
  mockState.signedIn = true
  mockState.toggle.mockReset().mockResolvedValue(undefined)
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('직관 체크 칸', () => {
  it('끝난 경기는 직관했어요, 예정 경기는 직관 가요', () => {
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    expect(box('이 경기 직관했어요')).toBeTruthy()
    screen.unmount()
    wrap(<AttendanceBlock match={mockMatchScheduled} />)
    expect(box('이 경기 직관 가요')).toBeTruthy()
  })

  it('큰 단추나 상자 없이 한 줄이다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    expect(screen.queryByText('직관했어요')).toBeNull()
    expect(screen.queryByText(/직관한 경기/)).toBeNull()
    expect(screen.queryByText('직관 취소')).toBeNull()
  })

  it('표시 전에는 비어 있고, 누르면 표시한다', async () => {
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    expect(box('이 경기 직관했어요').props.accessibilityState).toMatchObject({ checked: false })
    fireEvent.press(box('이 경기 직관했어요'))
    await waitFor(() => expect(mockState.toggle).toHaveBeenCalledWith(mockMatchFinished))
  })

  it('표시한 경기는 채워지고, 다시 누르면 푼다', async () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    expect(box('이 경기 직관했어요').props.accessibilityState).toMatchObject({ checked: true })
    fireEvent.press(box('이 경기 직관했어요'))
    await waitFor(() => expect(mockState.toggle).toHaveBeenCalledWith(mockMatchFinished))
  })

  it('로그인 전이면 로그인부터 청한다', () => {
    mockState.signedIn = false
    const onRequireLogin = jest.fn()
    wrap(<AttendanceBlock match={mockMatchFinished} onRequireLogin={onRequireLogin} />)
    fireEvent.press(box('이 경기 직관했어요'))
    expect(onRequireLogin).toHaveBeenCalled()
    expect(mockState.toggle).not.toHaveBeenCalled()
  })

  it('표시가 실패하면 알린다', async () => {
    mockState.toggle.mockRejectedValue(new Error('network'))
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    fireEvent.press(box('이 경기 직관했어요'))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('저장하지 못했습니다', 'network'))
  })

  /** 표시가 끝나기 전에 또 누르면 표시와 취소가 동시에 날아가 의도와 반대로 끝날 수 있다 */
  it('표시 저장 중에는 다시 눌러도 한 번만 보낸다', async () => {
    mockState.toggle.mockReturnValue(new Promise<void>(() => {}))
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    fireEvent.press(box('이 경기 직관했어요'))
    fireEvent.press(box('이 경기 직관했어요'))
    await waitFor(() => expect(mockState.toggle).toHaveBeenCalledTimes(1))
    expect(mockState.toggle).toHaveBeenCalledTimes(1)
  })

  it('위에 설 것(티켓 예매)을 받으면 체크 칸 위에 둔다', () => {
    const { Text } = jest.requireActual('react-native')
    wrap(<AttendanceBlock match={mockMatchScheduled} beside={<Text>티켓 예매</Text>} />)
    expect(screen.getByText('티켓 예매')).toBeTruthy()
    expect(box('이 경기 직관 가요')).toBeTruthy()
  })
})

/** 사진은 커뮤니티 글로 남긴다. 글쓰기 화면이 그 경기의 #직관·경기 태그를 채운다 (2026-09-29) */
describe('직관 글 쓰기', () => {
  it('표시하면 뜨고 그 경기로 글쓰기를 연다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    const onWritePost = jest.fn()
    wrap(<AttendanceBlock match={mockMatchFinished} onWritePost={onWritePost} />)
    fireEvent.press(screen.getByText('직관 글 쓰기'))
    expect(onWritePost).toHaveBeenCalledWith(mockMatchFinished)
  })

  it('예정 경기도 표시하면 뜬다', () => {
    mockState.rows = [attended(mockMatchScheduled.id)]
    const onWritePost = jest.fn()
    wrap(<AttendanceBlock match={mockMatchScheduled} onWritePost={onWritePost} />)
    fireEvent.press(screen.getByText('직관 글 쓰기'))
    expect(onWritePost).toHaveBeenCalledWith(mockMatchScheduled)
  })

  it('표시 전에는 없다', () => {
    wrap(<AttendanceBlock match={mockMatchFinished} onWritePost={jest.fn()} />)
    expect(screen.queryByText('직관 글 쓰기')).toBeNull()
  })
})

/** 직관 인증 카드 (2026-09-30). 끝난 경기를 직관했다고 표시했을 때만 */
describe('인증 카드', () => {
  it('끝난 경기를 직관 표시했으면 인증 카드를 누를 수 있다', () => {
    mockState.rows = [attended(mockMatchFinished.id)]
    const onShareProof = jest.fn()
    wrap(<AttendanceBlock match={mockMatchFinished} onShareProof={onShareProof} />)
    fireEvent.press(screen.getByRole('button', { name: '인증 카드' }))
    expect(onShareProof).toHaveBeenCalledWith(mockMatchFinished)
  })

  it('예정 경기와 표시 전에는 없다', () => {
    mockState.rows = [attended(mockMatchScheduled.id)]
    const { unmount } = wrap(<AttendanceBlock match={mockMatchScheduled} onShareProof={jest.fn()} />)
    expect(screen.queryByRole('button', { name: '인증 카드' })).toBeNull()
    unmount()
    mockState.rows = []
    wrap(<AttendanceBlock match={mockMatchFinished} onShareProof={jest.fn()} />)
    expect(screen.queryByRole('button', { name: '인증 카드' })).toBeNull()
  })
})

/** 직관 가요를 처음 체크할 때 알림 허락을 받는다 — 앱을 켜자마자 묻지 않고, 알림이 쓸모 있어지는 순간에 (2026-09-30) */
describe('알림 허락', () => {
  beforeEach(() => mockEnsure.mockClear())

  it('예정 경기를 직관 가요로 체크하면 알림 허락을 받는다', async () => {
    wrap(<AttendanceBlock match={mockMatchScheduled} />)
    fireEvent.press(box('이 경기 직관 가요'))
    await waitFor(() => expect(mockState.toggle).toHaveBeenCalled())
    expect(mockEnsure).toHaveBeenCalled()
  })

  it('끝난 경기를 체크하거나 체크를 풀 때는 묻지 않는다', async () => {
    wrap(<AttendanceBlock match={mockMatchFinished} />)
    fireEvent.press(box('이 경기 직관했어요'))
    await waitFor(() => expect(mockState.toggle).toHaveBeenCalled())
    expect(mockEnsure).not.toHaveBeenCalled()
  })
})

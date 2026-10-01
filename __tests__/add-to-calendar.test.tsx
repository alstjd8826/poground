import type React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AddToCalendar } from '@/components/match/AddToCalendar'
import { calendarEventOf } from '@/models/calendarEvent'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'

/**
 * 예정 경기를 폰 캘린더에 넣는다 (2026-09-30). 앱이 캘린더를 직접 쓰지 않고 운영체제의 "일정 추가" 화면을 연다
 * — 권한을 묻지 않고, 사용자가 내용을 보고 직접 저장한다
 */

const mockCreate = jest.fn(async () => ({ action: 'saved' }))
jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: (...args: unknown[]) => mockCreate(...(args as [])),
}))

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

beforeEach(() => mockCreate.mockClear())

describe('캘린더 일정', () => {
  // 픽스처 예정 경기: 포항(홈) vs 서울, 2026-09-20 19:00, 포항 스틸야드
  const event = calendarEventOf(mockMatchScheduled)

  it('제목은 홈 팀 먼저 — K리그 표기와 같다', () => {
    expect(event.title).toBe('포항 vs 서울')
  })

  it('킥오프부터 두 시간, 경기장, 1시간 전 알림', () => {
    expect(event.startDate.getTime()).toBe(mockMatchScheduled.kickoffAtMs)
    expect(event.endDate.getTime() - event.startDate.getTime()).toBe(2 * 60 * 60 * 1000)
    expect(event.location).toBe('포항 스틸야드')
    expect(event.alarms).toEqual([{ relativeOffset: -60 }])
  })

  it('메모에 라운드와 앱 이름을 적는다', () => {
    expect(event.notes).toBe(`K리그1 ${mockMatchScheduled.round}R · 포그라운드에서 추가`)
  })
})

describe('캘린더에 추가 단추', () => {
  it('누르면 운영체제의 일정 추가 화면을 그 경기로 연다', async () => {
    wrap(<AddToCalendar match={mockMatchScheduled} />)
    fireEvent.press(screen.getByRole('button', { name: '캘린더에 추가' }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ title: '포항 vs 서울' }))
  })

  it('끝난 경기에는 두지 않는다', () => {
    wrap(<AddToCalendar match={mockMatchFinished} />)
    expect(screen.queryByRole('button', { name: '캘린더에 추가' })).toBeNull()
  })

  it('열지 못하면 알린다', async () => {
    mockCreate.mockRejectedValueOnce(new Error('no calendar'))
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    wrap(<AddToCalendar match={mockMatchScheduled} />)
    fireEvent.press(screen.getByRole('button', { name: '캘린더에 추가' }))
    await waitFor(() => expect(alert).toHaveBeenCalledWith('캘린더를 열지 못했습니다', 'no calendar'))
    alert.mockRestore()
  })
})

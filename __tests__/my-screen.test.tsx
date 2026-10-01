import { fireEvent, render, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { MyScreen } from '@/screens/MyScreen'

jest.mock('@/hooks/useTabScrollTop', () => ({ useTabScrollTop: () => undefined }))
jest.mock('@/hooks/fanCard/useFanCards', () => ({ useFanCards: () => ({ cards: [], loaded: true }) }))
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: null, ready: true }) }))
jest.mock('@/hooks/auth/useProfile', () => ({ useProfile: () => ({ profile: null }) }))
jest.mock('@/hooks/comment/useIsAdmin', () => ({ useIsAdmin: () => false }))
const mockAttendance = { rows: [] as unknown[] }
jest.mock('@/hooks/attendance/useAttendances', () => ({ useAttendances: () => mockAttendance }))
jest.mock('@/hooks/query/useKleague', () => ({ useMatches: () => ({ data: [] }) }))

// 크기를 안 주면 SafeAreaProvider 가 재기 전까지 아무것도 그리지 않는다
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

/**
 * 연맹에 데이터 이용 허락을 청하면서 앱 안에 출처를 밝히겠다고 약속했다(2026-09-28).
 * 비공식이라는 안내와 함께 마이 탭 아래에 둔다.
 */
describe('마이 탭 안내', () => {
  it('자료 출처를 밝힌다', () => {
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider initialPreference="home">
          <MyScreen />
        </ThemeProvider>
      </SafeAreaProvider>,
    )
    expect(screen.getByText(/자료 제공: 한국프로축구연맹/)).toBeTruthy()
    expect(screen.getByText(/비공식 앱/)).toBeTruthy()
  })
  it('직관 기록 줄이 있다', () => {
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider initialPreference="home">
          <MyScreen />
        </ThemeProvider>
      </SafeAreaProvider>,
    )
    expect(screen.getByText('직관 기록')).toBeTruthy()
  })
  /** 동의한 약관을 언제든 다시 읽을 수 있어야 한다. 로그인 전에도 (2026-09-30) */
  it('이용약관 줄을 누르면 약관을 연다', () => {
    const onOpenTerms = jest.fn()
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider initialPreference="home">
          <MyScreen onOpenTerms={onOpenTerms} />
        </ThemeProvider>
      </SafeAreaProvider>,
    )
    fireEvent.press(screen.getByText('이용약관'))
    expect(onOpenTerms).toHaveBeenCalled()
  })
  /** 개인정보 처리방침도 앱 안에서 읽는다 (2026-09-30) */
  it('개인정보 처리방침 줄을 누르면 방침을 연다', () => {
    const onOpenPrivacy = jest.fn()
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider initialPreference="home">
          <MyScreen onOpenPrivacy={onOpenPrivacy} />
        </ThemeProvider>
      </SafeAreaProvider>,
    )
    fireEvent.press(screen.getByText('개인정보 처리방침'))
    expect(onOpenPrivacy).toHaveBeenCalled()
  })
  it('알림 줄을 누르면 알림 설정을 연다', () => {
    const onOpenNotifications = jest.fn()
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider initialPreference="home">
          <MyScreen onOpenNotifications={onOpenNotifications} />
        </ThemeProvider>
      </SafeAreaProvider>,
    )
    fireEvent.press(screen.getByText('알림'))
    expect(onOpenNotifications).toHaveBeenCalled()
  })
})

import { ScrollView, StyleSheet } from 'react-native'
import { render, renderHook, screen } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { AccountScreen } from '@/screens/AccountScreen'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'

/**
 * 안드로이드는 화면이 하단 내비게이션 바 밑까지 그려진다(edge-to-edge). 탭바가 없는 스택 화면이 그 높이를
 * 비우지 않아, 내 계정 맨 아래 "계정 삭제" 가 바 뒤에 깔렸다 (2026-09-30, 갤럭시)
 */

jest.mock('@/hooks/comment/useIsAdmin', () => ({ useIsAdmin: () => false }))
jest.mock('@/hooks/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'me' } }, signOut: jest.fn() }),
  isAppleAvailable: async () => false,
}))
jest.mock('@/hooks/auth/useProfile', () => ({
  useProfile: () => ({
    profile: { id: 'me', nickname: '팬', handle: 'fan', avatarUrl: null, termsVersion: 1 },
    saveAvatar: jest.fn(),
    clearAvatar: jest.fn(),
  }),
}))
jest.mock('@/components/auth/LinkedAccounts', () => ({ LinkedAccounts: () => null }))

const NAV_BAR = 48
const metrics = {
  frame: { x: 0, y: 0, width: 412, height: 915 },
  insets: { top: 32, left: 0, right: 0, bottom: NAV_BAR },
}

it('내 계정은 하단 바 높이만큼 더 비운다', () => {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider initialPreference="home">
        <AccountScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
  const style = StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle)
  expect(style.paddingBottom).toBeGreaterThanOrEqual(NAV_BAR)
})

it('안전 영역을 모르는 곳(테스트 등)에서는 0 으로 둔다 — 없다고 화면이 죽지 않게', () => {
  const { result } = renderHook(() => useBottomSafeGap())
  expect(result.current).toBe(0)
})

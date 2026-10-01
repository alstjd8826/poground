import { readFileSync } from 'fs'
import { join } from 'path'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { ProfileGate } from '@/navigation/ProfileGate'
import { TERMS, TERMS_VERSION } from '@/content/terms'

/**
 * 글·댓글을 올리는 앱은 불쾌한 콘텐츠와 악용을 받아 주지 않는다는 약관에 동의를 받아야 한다(지침 1.2).
 * 프로필을 만든 뒤, 지금 판에 동의하지 않았으면 앱 위에 약관을 덮는다 (2026-09-30)
 */

const mockAgree = jest.fn(async () => {})
const mockSignOut = jest.fn(async () => {})
let mockProfile: {
  id: string
  nickname: string
  handle: string
  avatarUrl: null
  termsVersion: number
} | null
jest.mock('@/hooks/auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'me' } }, signOut: mockSignOut }),
}))
jest.mock('@/hooks/auth/useProfile', () => ({
  suggestedNickname: () => '',
  useProfile: () => ({ profile: mockProfile, loaded: true, save: jest.fn(), agreeTerms: mockAgree }),
}))

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}
const wrap = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider initialPreference="home">
        <ProfileGate />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
const profile = (termsVersion: number) => ({
  id: 'me',
  nickname: '팬',
  handle: 'fan',
  avatarUrl: null,
  termsVersion,
})

beforeEach(() => {
  mockAgree.mockClear()
  mockSignOut.mockClear()
})

it('지금 판에 동의하지 않았으면 약관을 덮고, 동의하면 부른다', async () => {
  mockProfile = profile(0)
  wrap()
  expect(screen.getByText(TERMS[0]!.title)).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: '동의하고 계속하기' }))
  await waitFor(() => expect(mockAgree).toHaveBeenCalled())
})

it('동의하지 않으려면 로그아웃으로 나간다 — 앱이 잠기지 않게', () => {
  mockProfile = profile(0)
  wrap()
  fireEvent.press(screen.getByRole('button', { name: '동의하지 않고 로그아웃' }))
  expect(mockSignOut).toHaveBeenCalled()
})

it('지금 판에 동의했으면 덮지 않는다', () => {
  mockProfile = profile(TERMS_VERSION)
  wrap()
  expect(screen.queryByText(TERMS[0]!.title)).toBeNull()
})

it('불쾌한 콘텐츠와 악용 무관용, 올리는 것의 권리를 적는다', () => {
  const all = TERMS.map(s => s.body.join('\n')).join('\n')
  expect(all).toMatch(/받아 주지 않습니다/)
  expect(all).toMatch(/권리/)
})

/** 웹에 올리는 약관(docs/terms.md)과 앱 안 약관이 같은 말을 한다 */
it('docs/terms.md 에 앱 안 약관의 모든 조항이 그대로 있다', () => {
  const doc = readFileSync(join(__dirname, '..', 'docs', 'terms.md'), 'utf8')
  for (const section of TERMS) {
    expect(doc).toContain(section.title)
    for (const line of section.body) expect(doc).toContain(line)
  }
})

/** supabase 의 오류는 Error 가 아닌 객체로 온다. String() 으로 바꾸면 '[object Object]' 만 떴다 (2026-09-30) */
it('동의 저장이 실패하면 서버가 준 까닭을 그대로 보인다', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockAgree.mockRejectedValueOnce({ code: '42501', message: 'permission denied for table profiles' })
  mockProfile = profile(0)
  wrap()
  fireEvent.press(screen.getByRole('button', { name: '동의하고 계속하기' }))
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith('동의를 저장하지 못했습니다', 'permission denied for table profiles'),
  )
  alert.mockRestore()
})

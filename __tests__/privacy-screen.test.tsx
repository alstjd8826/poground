import { render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { PrivacyScreen } from '@/screens/PrivacyScreen'

/** 방침을 앱 안에서 그린다. 표는 폰 폭에 맞춰 줄마다 묶음으로 푼다 (2026-09-30) */
it('제목과 표의 내용, 굵은 글씨를 그린다', () => {
  render(
    <ThemeProvider initialPreference="home">
      <PrivacyScreen />
    </ThemeProvider>,
  )
  expect(screen.getByText('포그라운드 개인정보처리방침')).toBeTruthy()
  // 1-1 표의 한 줄 — 첫 칸이 이름, 나머지는 머리 줄 이름과 함께
  expect(screen.getByText('이메일 주소')).toBeTruthy()
  expect(screen.getByText('마이 → 내 계정 → 계정 삭제')).toBeTruthy()
  // 굵게 쓴 곳은 ** 가 보이지 않는다
  expect(screen.queryByText(/\*\*/)).toBeNull()
})

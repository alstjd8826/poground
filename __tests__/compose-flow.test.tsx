import { StyleSheet } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { RootNavigator } from '@/navigation/RootNavigator'
import {
  mockMatchFinishedRow,
  mockMatchScheduledRow,
  mockNewsRows,
  mockStandingRows,
  mockVideoRows,
} from '@/utils/fixtures'

/**
 * Supabase 를 타지 않도록 리포지토리 계층만 대체한다.
 * 서비스(다음 경기 고르기, 우리 팀 주변 자르기 등)는 실제로 돌아 함께 검증된다.
 */
jest.mock('@/repositories/kleague/matchRepository', () => ({
  matchRepository: { findByTeam: jest.fn(async () => [mockMatchFinishedRow, mockMatchScheduledRow]) },
}))
jest.mock('@/repositories/kleague/standingRepository', () => ({
  standingRepository: { findAll: jest.fn(async () => mockStandingRows) },
}))
jest.mock('@/repositories/kleague/newsRepository', () => ({
  newsRepository: {
    findRecent: jest.fn(async () => mockNewsRows),
    findBySeq: jest.fn(async () => mockNewsRows[0]),
  },
}))
jest.mock('@/repositories/kleague/videoRepository', () => ({
  videoRepository: {
    findRecent: jest.fn(async () => mockVideoRows),
    findByRound: jest.fn(async () => mockVideoRows),
  },
}))
jest.mock('@/repositories/community/remote', () => ({
  listFeed: jest.fn(async () => []),
  getPost: jest.fn(async () => null),
  savePost: jest.fn(),
  deletePost: jest.fn(),
}))
// 로그인한 사람. [글쓰기] 는 로그인해야 글쓰기 화면으로 간다
jest.mock('@/hooks/auth/useAuth', () => ({
  ...jest.requireActual('@/hooks/auth/useAuth'),
  useAuth: () => ({ session: { user: { id: 'me', user_metadata: {} } }, ready: true }),
}))
jest.mock('@/repositories/kleague/clubRepository', () => ({
  clubRepository: { findAll: jest.fn(async () => []), findSquad: jest.fn(async () => []) },
}))

// 테스트가 끝나도 캐시가 타이머를 물고 있으면 jest 가 종료되지 않는다
const clients: QueryClient[] = []
afterEach(() => {
  clients.forEach(c => c.clear())
  clients.length = 0
})

const renderApp = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider initialPreference="away">
        <RootNavigator />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

/** 폰에서 [글쓰기] 를 누르면 앱이 꺼졌다(2026-09-29). 화면 경계 밖에서 던지면 Release 는 그대로 죽는다 */
describe('글쓰기로 가기', () => {
  /** 글쓰기는 커뮤니티 헤더 오른쪽의 연필이다 (2026-09-29) */
  it('커뮤니티 헤더의 [글쓰기] 를 누르면 글쓰기 화면이 뜬다', async () => {
    renderApp()
    await waitFor(() => expect(screen.getByText('다음 경기')).toBeTruthy())
    const tabs = screen.getAllByText('커뮤니티')
    fireEvent.press(tabs[tabs.length - 1]!)
    const compose = await screen.findByLabelText('글쓰기')
    // 목록 위에 떠 있는 단추가 아니라 헤더 안의 단추다
    expect(StyleSheet.flatten(compose.props.style)?.position).not.toBe('absolute')
    fireEvent.press(compose)
    expect(await screen.findByPlaceholderText('경기장 이야기를 남겨 보세요')).toBeTruthy()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { RootNavigator } from '@/navigation/RootNavigator'
import { MatchCard } from '@/components/match/MatchCard'
import { TagScopeProvider } from '@/utils/sharedTransition'
import {
  mockMatchFinished,
  mockMatchFinishedRow,
  mockMatchLive,
  mockMatchScheduledRow,
  mockNews,
  mockNewsRows,
  mockStandingRows,
  mockVideoRows,
  mockVideos,
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

describe('홈의 이동 버튼', () => {
  /**
   * 일정과 순위가 한 탭으로 합쳐졌으므로 탭만 바꿔서는 부족하다. 탭 안의 어느 갈래가
   * 펼쳐졌는지까지 봐야 "전체 순위" 를 눌렀는데 일정이 뜨는 일을 잡는다.
   * 두 갈래 모두 마운트된 채 한쪽만 display:none 이라, 글자가 아니라 탭의 선택 상태로 본다.
   */
  /** 커뮤니티 탭에는 커뮤니티만 있다. 소식·영상은 홈의 "더 보기" 로 들어간다 (2026-09-28) */
  it('커뮤니티 탭은 전체 글부터 편다', async () => {
    renderApp()
    await waitFor(() => expect(screen.getByText('다음 경기')).toBeTruthy())

    const tabs = screen.getAllByText('커뮤니티')
    fireEvent.press(tabs[tabs.length - 1]!)

    await waitFor(() => expect(screen.getByRole('tab', { name: '전체', selected: true })).toBeTruthy())
  })

  it('경기 탭은 일정부터 편다', async () => {
    // 홈이 좁아지며 "일정 전체" 링크를 뺐다. 일정은 경기 탭의 기본 갈래로 닿는다
    renderApp()
    await waitFor(() => expect(screen.getByText('다음 경기')).toBeTruthy())

    const tabs = screen.getAllByText('경기')
    fireEvent.press(tabs[tabs.length - 1]!)

    await waitFor(() => expect(screen.queryByText('다음 경기')).toBeNull())
    expect(screen.getByRole('tab', { name: '일정', selected: true })).toBeTruthy()
  })

  /**
   * 예전에는 제목 옆 "전체 순위" 링크였다. 같은 곳으로 가는 길을 둘 두지 않으려고
   * 카드 자체를 누르게 바꿨다 — 그래서 이름이 아니라 역할로 찾는다.
   */
  it('순위 카드를 누르면 경기 탭의 순위가 펼쳐진다', async () => {
    renderApp()
    await waitFor(() => expect(screen.getByText('우리 순위')).toBeTruthy())

    await pressStandingsCard()

    await waitFor(() => expect(screen.queryByText('우리 순위')).toBeNull())
    expect(screen.getByRole('tab', { name: '순위', selected: true })).toBeTruthy()
  })

  /** 소식·영상은 탭에서 빠졌다. "더 보기" 가 홈 위에 전체 목록을 연다 (2026-09-28) */
  it('"더 보기" 로 영상 전체 목록이 열린다', async () => {
    renderApp()
    await waitFor(() => expect(screen.getAllByText('더 보기').length).toBe(2))

    // 소식과 영상 섹션이 같은 라벨을 쓴다. 트리 순서상 영상이 뒤다
    const more = screen.getAllByText('더 보기')
    fireEvent.press(more[more.length - 1]!)

    // 영상 목록에만 있는 분류 거르개
    await waitFor(() => expect(screen.getByRole('tab', { name: '하이라이트' })).toBeTruthy())
  })

  it('뉴스 카드를 누르면 상세로 간다', async () => {
    renderApp()
    const title = mockNews[0]!.title
    await waitFor(() => expect(screen.getAllByText(title).length).toBeGreaterThan(0))

    fireEvent.press(screen.getAllByText(title)[0]!)

    /*
      상세에서만 나오는 것. 본문은 우리가 그리지 않는다 — 기사를 우리 서버에 담아 우리
      화면에 띄우면 인용이 아니라 복제·전송이다. 원문으로 가는 길만 둔다.
    */
    await waitFor(() => expect(screen.getByText('원문 보기')).toBeTruthy())
  })
})

describe('영상 재생', () => {
  it('영상 탭의 카드를 누르면 앱 안 플레이어로 간다', async () => {
    renderApp()

    // "영상" 은 홈 섹션 제목에도 있다. 탭바는 트리 마지막에 그려지므로 마지막 것을 누른다.
    const tabs = screen.getAllByText('영상')
    fireEvent.press(tabs[tabs.length - 1]!)
    const title = mockVideos[0]!.title
    await waitFor(() => expect(screen.getAllByText(title).length).toBeGreaterThan(0))

    fireEvent.press(screen.getAllByText(title)[0]!)

    // 플레이어 화면에만 있는 액션
    await waitFor(() => expect(screen.getByText('유튜브에서 열기')).toBeTruthy())
  })

  it('홈의 영상 카드도 같은 플레이어로 간다', async () => {
    renderApp()
    const title = mockVideos[0]!.title
    await waitFor(() => expect(screen.getAllByText(title).length).toBeGreaterThan(0))

    fireEvent.press(screen.getAllByText(title)[0]!)

    await waitFor(() => expect(screen.getByText('유튜브에서 열기')).toBeTruthy())
  })
})

describe('경기 카드 이동', () => {
  it('끝난 경기를 누르면 경기 상세로 간다', async () => {
    renderApp()
    // 홈의 "최근 경기" 는 종료된 경기(29R 대전 2-2 포항).
    // 섹션 제목은 즉시 뜨지만 카드는 쿼리가 끝나야 나오므로 카드 자체를 기다린다.
    await waitFor(() => expect(screen.getAllByLabelText(/대전 대 포항 경기/).length).toBeGreaterThan(0))
    fireEvent.press(screen.getAllByLabelText(/대전 대 포항 경기/)[0]!)

    // 상세에만 있는 탭으로 이동을 확인한다 ("영상" 은 탭바에도 있어 라인업으로 본다)
    await waitFor(() => expect(screen.getByText('라인업')).toBeTruthy())
  })
})

/**
 * 홈의 순위 카드를 누른다.
 *
 * 카드는 순위 쿼리가 끝난 뒤에야 그려진다 — 그전에는 스켈레톤이다. 예전 "전체 순위"
 * 링크는 제목 줄에 있어서 바로 잡혔지만 카드는 기다려야 한다.
 * 라벨에 등수가 섞이므로 모양으로 찾는다.
 */
async function pressStandingsCard() {
  fireEvent.press(await screen.findByLabelText(/^우리 순위 \d+위\. 전체 순위 보기$/))
}

describe('홈의 이동 버튼을 다시 누를 때', () => {
  /**
   * 갈래를 옮긴 뒤 홈으로 돌아와 같은 버튼을 다시 누르는 경우.
   * 라우트 파라미터 값이 직전과 같으면 화면이 "바뀐 게 없다" 고 보고 갈래를 되돌리지 않을 수 있다.
   */
  it('갈래를 바꾼 뒤 다시 순위 카드를 누르면 순위로 돌아온다', async () => {
    renderApp()
    await waitFor(() => expect(screen.getByText('우리 순위')).toBeTruthy())

    await pressStandingsCard()
    await waitFor(() => expect(screen.getByRole('tab', { name: '순위', selected: true })).toBeTruthy())

    // 손으로 일정 갈래로 옮긴다
    fireEvent.press(screen.getByRole('tab', { name: '일정' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: '일정', selected: true })).toBeTruthy())

    // 홈으로 돌아가 같은 버튼을 다시 누른다
    const homeTabs = screen.getAllByText('홈')
    fireEvent.press(homeTabs[homeTabs.length - 1]!)
    await waitFor(() => expect(screen.getByText('우리 순위')).toBeTruthy())

    await pressStandingsCard()
    await waitFor(() => expect(screen.getByRole('tab', { name: '순위', selected: true })).toBeTruthy())
  })
})

/**
 * 공유 전환 태그는 앱 전체에서 유일해야 한다.
 *
 * 하단 탭은 한 번 연 화면을 계속 띄워 둔다. 홈의 "다음 경기" 와 경기 탭의 일정 목록에
 * 같은 경기가 들어 있으면 같은 태그를 단 뷰가 두 화면에 동시에 존재하게 되고, 공유 전환이
 * 원본을 숨긴 채 되돌리지 못해 카드가 사라진다 — 실제로 탭을 몇 번 오가니 홈의 경기
 * 카드가 안 보였다.
 *
 * 눈으로만 잡히던 것이라 여기서 못 박는다.
 */
describe('공유 전환 태그', () => {
  const tagsIn = (root: ReturnType<typeof renderApp>) => {
    const found: string[] = []
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return
      const tag = node.props?.sharedTransitionTag
      if (typeof tag === 'string') found.push(tag)
      for (const child of node.children ?? []) walk(child)
    }
    walk(root.toJSON())
    return found
  }

  it('여러 탭을 열어 둬도 같은 태그가 두 번 나오지 않는다', async () => {
    const app = renderApp()
    await waitFor(() => expect(screen.getAllByText('포항').length).toBeGreaterThan(0))

    // 경기 탭을 연다. 탭바는 트리 마지막에 그려지므로 마지막 것을 누른다
    const matchTabs = screen.getAllByText('경기')
    fireEvent.press(matchTabs[matchTabs.length - 1]!)
    await waitFor(() => expect(screen.getAllByText('포항').length).toBeGreaterThan(0))

    // 홈으로 돌아온다. 이제 두 탭이 함께 떠 있다
    const homeTabs = screen.getAllByText('홈')
    fireEvent.press(homeTabs[homeTabs.length - 1]!)
    await waitFor(() => expect(screen.getAllByText('포항').length).toBeGreaterThan(0))

    const tags = tagsIn(app)
    const duplicated = tags.filter((t, i) => tags.indexOf(t) !== i)
    expect(duplicated).toEqual([])
  })

  /**
   * 카드의 **보이는 조각마다** 태그가 있어야 한다.
   *
   * 전환이 시작되면 태그 붙은 뷰는 자식 없는 복제본이 날아가고 원본은 숨는다. 그래서 카드
   * 면에만 태그가 있고 안쪽 글자에 없으면, 그 글자는 전환 내내 사라졌다가 끝에서 튀어나온다.
   * 실제로 날짜가 그랬다 — 카드의 다른 조각은 다 태그가 있는데 날짜만 빠져 있었다.
   *
   * 태그가 없어도 에러가 나지 않으니 눈으로만 잡힌다. 그래서 여기서 못 박는다.
   */
  it('카드 안의 글자에도 태그가 붙는다', () => {
    const card = render(
      <ThemeProvider initialPreference="home">
        <TagScopeProvider value="test">
          <MatchCard match={mockMatchFinished} shared />
        </TagScopeProvider>
      </ThemeProvider>,
    )

    const tagged = new Set<string>()
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return
      const tag = node.props?.sharedTransitionTag
      // 글자 노드는 children 에 문자열로 들어온다
      if (typeof tag === 'string') {
        for (const child of node.children ?? []) {
          if (typeof child === 'string') tagged.add(child.trim())
        }
      }
      for (const child of node.children ?? []) walk(child)
    }
    walk(card.toJSON())

    // 날짜는 "9.12(금) 19:00" 꼴이다. 형식을 박지 않고 숫자와 요일만 본다
    const hasKickoff = [...tagged].some(t => /^\d{1,2}\.\d{1,2}\([월화수목금토일]\)/.test(t))
    expect(hasKickoff).toBe(true)
  })

  /**
   * LIVE 배지도 같은 함정에 빠져 있었다.
   *
   * 배지는 점과 글자 둘로 이루어져 있어서 감싸는 뷰에 태그를 붙이면 아무것도 그리지 않는
   * 빈 상자가 날아간다. 조각마다 붙여야 하고, 점(LivePulse)은 제 컴포넌트라 태그를 받아
   * 안쪽까지 넘겨야 한다 — 안 넘기면 태그가 거기서 멈춘다.
   */
  it('라이브 배지의 점과 글자에도 태그가 붙는다', () => {
    const card = render(
      <ThemeProvider initialPreference="home">
        <TagScopeProvider value="test">
          <MatchCard match={mockMatchLive} shared />
        </TagScopeProvider>
      </ThemeProvider>,
    )

    const tags: string[] = []
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (typeof node.props?.sharedTransitionTag === 'string') tags.push(node.props.sharedTransitionTag)
      for (const child of node.children ?? []) walk(child)
    }
    walk(card.toJSON())

    expect(tags.some(t => t.endsWith('-live-dot'))).toBe(true)
    expect(tags.some(t => t.endsWith('-live-label'))).toBe(true)
  })
})

import Animated from 'react-native-reanimated'
import { render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { MatchCard } from '@/components/match/MatchCard'
import { NewsCard } from '@/components/news/NewsCard'
import { mockMatchFinished, mockNews } from '@/utils/fixtures'

/**
 * FlashList 안의 카드는 레이아웃 애니메이션(entering)을 쓰지 않는다 (2026-09-30).
 * 안드로이드에서 entering 은 시작할 때 자리를 붙잡아, 그 사이 FlashList 가 자리를 옮기면 카드가 옛 자리에
 * 멈췄다 — 갤럭시에서 경기 카드가 앞 카드에 올라탔다. 등장은 useAppear(투명도·위치 스타일)로 한다.
 *
 * 등장 값이 재활용 때 되돌아가는지는 여기서 가릴 수 없다 — 테스트용 Reanimated 는 애니메이션을 곧바로 끝낸다.
 * 그건 기기에서 본다.
 */

const withEntering = () => screen.UNSAFE_queryAllByType(Animated.View).filter(n => n.props.entering)

it('경기 카드는 레이아웃 애니메이션을 쓰지 않는다', () => {
  render(
    <ThemeProvider initialPreference="home">
      <MatchCard match={mockMatchFinished} />
    </ThemeProvider>,
  )
  expect(withEntering()).toHaveLength(0)
})

it('소식 카드는 레이아웃 애니메이션을 쓰지 않는다', () => {
  render(
    <ThemeProvider initialPreference="home">
      <NewsCard article={mockNews[0]!} />
    </ThemeProvider>,
  )
  expect(withEntering()).toHaveLength(0)
})

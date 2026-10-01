import { StyleSheet, View } from 'react-native'

import { useTheme } from '@/hooks/theme/ThemeProvider'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { MatchesScreen } from './MatchesScreen'
import { StandingsScreen } from './StandingsScreen'
import type { Match } from '@/models/kleague'

export type CompetitionTab = 'matches' | 'standings'

const TABS = [
  { key: 'matches', label: '일정' },
  { key: 'standings', label: '순위' },
]

export interface CompetitionScreenProps {
  onOpenMatch?: (match: Match) => void
  /**
   * 어느 갈래를 펼지. 화면이 스스로 들고 있지 않고 라우트 파라미터가 정한다.
   *
   * 로컬 state 로 들면 홈의 "전체 보기" 를 두 번째 누를 때 값이 직전과 같아 아무 일도
   * 일어나지 않는다 — 손으로 옮겨 둔 갈래에 그대로 머문다. 파라미터를 유일한 출처로 둔다.
   */
  tab: CompetitionTab
  onTabChange: (tab: CompetitionTab) => void
}

/**
 * 경기 탭.
 *
 * 일정과 순위는 둘 다 리그가 어떻게 굴러가는지 보는 화면이라 한 탭에 둔다.
 * 안 보이는 쪽은 언마운트하지 않는다 — 다시 눌렀을 때 스켈레톤이 한 번 더 번쩍이지 않게.
 */
export function CompetitionScreen({ onOpenMatch, tab, onTabChange }: CompetitionScreenProps) {
  const theme = useTheme()
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <CategoryTabs tabs={TABS} value={tab} onChange={key => onTabChange(key as CompetitionTab)} />
      <View style={[styles.fill, tab !== 'matches' && styles.hidden]}>
        <MatchesScreen onOpenMatch={onOpenMatch} />
      </View>
      <View style={[styles.fill, tab !== 'standings' && styles.hidden]}>
        <StandingsScreen />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  hidden: { display: 'none' },
})

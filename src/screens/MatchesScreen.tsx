import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { FlashListRef } from '@shopify/flash-list'

import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useTabScrollTop } from '@/hooks/useTabScrollTop'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { QueryList } from '@/components/foundation/QueryList'
import { MatchCard, MatchCardSkeleton } from '@/components/match/MatchCard'
import { useMatches } from '@/hooks/query/useKleague'
import {
  defaultMonthOf,
  type MatchMonth,
  matchesInMonth,
  monthLabelOf,
  monthsOf,
  seasonMonthsOf,
} from '@/services/kleague/matchService'
import type { Match } from '@/models/kleague'

export interface MatchesScreenProps {
  /** 예정 경기는 예매로, 끝난 경기는 그 경기 영상으로. 판단은 내비게이션 쪽에서 한다 */
  onOpenMatch?: (match: Match) => void
}

export function MatchesScreen({ onOpenMatch }: MatchesScreenProps) {
  // 하단 탭을 다시 누르면 맨 위로
  const listRef = useTabScrollTop<FlashListRef<Match>>()
  const theme = useTheme()
  const query = useMatches()
  const onPress = useCallback((match: Match) => onOpenMatch?.(match), [onOpenMatch])

  // 경기가 있는 달과, 시즌이 걸쳐 있는 달 전체. 후자를 늘어놓고 전자에 없는 달을 잠근다
  const played = useMemo(() => monthsOf(query.data), [query.data])
  const months = useMemo(() => seasonMonthsOf(query.data), [query.data])

  /**
   * 고른 적이 없으면 다음 경기가 있는 달을 연다.
   *
   * 경기가 아직 안 왔을 때 초기값을 박아 두면 데이터가 도착해도 엉뚱한 달에 머문다.
   * 그래서 "고른 적 없음" 을 따로 두고 매번 계산한다 — 라인업의 팀 탭과 같은 방식이다.
   */
  const [picked, setPicked] = useState<MatchMonth | null>(null)
  const month = picked && played.includes(picked) ? picked : defaultMonthOf(query.data)

  const tabs = useMemo(
    () => months.map(m => ({ key: m, label: monthLabelOf(m), disabled: !played.includes(m) })),
    [months, played],
  )
  const shown = useMemo(() => (month ? matchesInMonth(query.data, month) : []), [query.data, month])

  // 달을 고른 뒤에는 그 달의 목록만 QueryList 에 넘긴다. 원래 쿼리 상태는 그대로 쓴다
  const monthQuery = useMemo(() => ({ ...query, data: shown }), [query, shown])

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {months.length > 1 && month && (
        <CategoryTabs tabs={tabs} value={month} onChange={setPicked} variant="subtle" />
      )}
      <QueryList
        listRef={listRef}
        query={monthQuery}
        keyExtractor={m => String(m.id)}
        renderItem={({ item, index }) => <MatchCard match={item} index={index} shared onPress={onPress} />}
        skeleton={<MatchCardSkeleton />}
        skeletonCount={5}
        emptyTitle="이 달에는 경기가 없습니다"
        emptyDescription="위에서 다른 달을 골라보세요."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})

import { StyleSheet, View } from 'react-native'
import type { FlashListRef } from '@shopify/flash-list'

import { cornerRadius, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useTabScrollTop } from '@/hooks/useTabScrollTop'
import { QueryList } from '@/components/foundation/QueryList'
import {
  StandingRow,
  StandingRowSkeleton,
  StandingsHeaderRow,
  StandingsLegend,
} from '@/components/standings/StandingsTable'
import { useStandingsList } from '@/hooks/query/useKleague'
import type { Standing } from '@/models/kleague'

/** 표는 행마다 아래 구분선이 있으므로 항목 사이에 간격을 두지 않는다 */
const NoGap = () => null

export function StandingsScreen() {
  // 하단 탭을 다시 누르면 맨 위로
  const listRef = useTabScrollTop<FlashListRef<Standing>>()
  const theme = useTheme()
  const query = useStandingsList()

  // 카드 테두리는 목록의 콘텐츠 컨테이너가 직접 두른다. 그래야 행이 카드 안에 들어간 모양이 된다.
  const card = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: cornerRadius['200'],
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['100'],
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <QueryList
        listRef={listRef}
        query={query}
        keyExtractor={s => s.teamId}
        renderItem={({ item, index }) => <StandingRow standing={item} index={index} />}
        ListHeaderComponent={<StandingsHeaderRow />}
        // 범례는 표 안에 두어야 카드 테두리 안에서 순위표의 일부로 읽힌다
        ListFooterComponent={<StandingsLegend />}
        ItemSeparatorComponent={NoGap}
        contentContainerStyle={card}
        skeleton={<StandingRowSkeleton />}
        skeletonCount={12}
        emptyTitle="순위 정보가 없습니다"
        emptyDescription="시즌이 시작되면 여기에 표시됩니다."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  // 화면 여백은 바깥에서 준다. 카드 모양은 목록의 콘텐츠 컨테이너가 맡는다.
  root: { flex: 1, padding: spacing['200'] },
})

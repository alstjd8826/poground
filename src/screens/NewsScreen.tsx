import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { FlashListRef } from '@shopify/flash-list'

import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useTabScrollTop } from '@/hooks/useTabScrollTop'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { QueryList } from '@/components/foundation/QueryList'
import { NewsCard, NewsCardSkeleton } from '@/components/news/NewsCard'
import { useNews } from '@/hooks/query/useKleague'
import { filterNews, type NewsFilter, NEWS_FILTERS, newsFilterCounts } from '@/services/kleague/newsService'
import type { NewsArticle } from '@/models/kleague'

export interface NewsScreenProps {
  onOpenArticle?: (article: NewsArticle) => void
}

export function NewsScreen({ onOpenArticle }: NewsScreenProps) {
  // 하단 탭을 다시 누르면 맨 위로
  const listRef = useTabScrollTop<FlashListRef<NewsArticle>>()
  const theme = useTheme()
  const query = useNews(40)
  const onPress = useCallback((a: NewsArticle) => onOpenArticle?.(a), [onOpenArticle])

  const [filter, setFilter] = useState<NewsFilter>('all')

  /**
   * 영상 탭과 달리 서버를 다시 부르지 않는다.
   *
   * 영상은 카테고리마다 수집 범위가 달라 쿼리를 나눠야 하지만, 소식은 한 번 받아 둔 수십 건을
   * 나누기만 하면 된다. 네트워크를 타지 않으니 탭 전환에 지연이 없고 useDeferredValue 도 필요 없다.
   */
  const counts = useMemo(() => newsFilterCounts(query.data), [query.data])
  const tabs = useMemo(() => NEWS_FILTERS.map(f => ({ ...f, disabled: counts[f.key] === 0 })), [counts])
  const shown = useMemo(() => filterNews(query.data, filter), [query.data, filter])
  const filtered = useMemo(() => ({ ...query, data: shown }), [query, shown])

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <CategoryTabs
        tabs={tabs}
        value={filter}
        onChange={key => setFilter(key as NewsFilter)}
        variant="subtle"
      />
      <QueryList
        listRef={listRef}
        query={filtered}
        keyExtractor={a => String(a.id)}
        renderItem={({ item, index }) => <NewsCard article={item} index={index} onPress={onPress} />}
        skeleton={<NewsCardSkeleton />}
        skeletonCount={6}
        emptyTitle="해당하는 소식이 없습니다"
        emptyDescription="위에서 다른 분류를 골라보세요."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})

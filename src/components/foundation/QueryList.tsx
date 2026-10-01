import React, { useCallback, useState } from 'react'
import { RefreshControl, StyleSheet, View, type ViewStyle } from 'react-native'
import { FlashList, type FlashListRef, type FlashListProps } from '@shopify/flash-list'

import { spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { EmptyState, ErrorState } from '@/components/feedback/States'

/**
 * 목록이 실제로 보는 쿼리의 조각.
 *
 * UseQueryResult 를 통째로 받으면 화면이 목록을 걸러 낸 뒤 넘길 수 없다 — 그 타입은
 * 상태별로 갈린 유니온이라 data 만 바꿔 끼우면 조합이 깨진다. 쓰는 것만 받는다.
 */
export interface ListQuery<T> {
  data: T[] | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

export interface QueryListProps<T> extends Omit<
  FlashListProps<T>,
  'data' | 'refreshing' | 'onRefresh' | 'ListEmptyComponent'
> {
  query: ListQuery<T>
  /** 로딩 중 보여줄 자리표시자. 실제 항목과 높이가 같아야 데이터 도착 때 튀지 않는다 */
  skeleton: React.ReactNode
  skeletonCount?: number
  emptyTitle?: string
  emptyDescription?: string
  /**
   * 목록을 밖에서 다룰 때 쓴다. 지금은 하단 탭을 다시 눌렀을 때 맨 위로 올리는 데 쓴다.
   *
   * useScrollToTop 을 여기서 직접 부르지 않는다. 이건 기반 컴포넌트라 내비게이션을 알면
   * 내비게이터 밖에서는 쓸 수 없는 물건이 된다 — 참조만 내주고 이어 붙이는 일은 화면이 한다.
   *
   * 로딩·에러일 때는 목록 대신 다른 것을 그리므로 이 참조가 비어 있다. 받는 쪽이 견뎌야 한다.
   */
  listRef?: React.Ref<FlashListRef<T>>
}

/**
 * 목록 화면의 공통 뼈대.
 *
 * 로딩/에러/빈 상태와 당겨서 새로고침을 한곳에 모아, 화면마다 다르게 처리되는 걸 막는다.
 * 첫 로딩은 스켈레톤, 새로고침은 스피너로 나눠서 이미 본 목록이 사라지지 않게 한다.
 *
 * 목록은 FlashList(v2) 를 쓴다. 화면 밖 항목을 실제로 재활용해서, 카드가 큰 목록에서
 * FlatList 보다 마운트 비용이 훨씬 적다. v2 는 항목 높이를 자동으로 재므로
 * estimatedItemSize 를 넘길 필요가 없고, 네이티브 모듈이 없어 prebuild 도 필요 없다.
 * FlatList 전용 튜닝 props(windowSize, initialNumToRender 등)는 쓰지 않는다.
 */
export function QueryList<T>({
  query,
  skeleton,
  skeletonCount = 5,
  emptyTitle = '아직 표시할 내용이 없습니다',
  emptyDescription,
  listRef,
  contentContainerStyle,
  // 표처럼 행마다 구분선이 있는 목록은 간격을 0 으로 바꿔 끼울 수 있게 열어둔다
  ItemSeparatorComponent = Separator,
  ...rest
}: QueryListProps<T>) {
  const theme = useTheme()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await query.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [query])

  /**
   * 첫 로딩: 목록 대신 스켈레톤을 같은 레이아웃으로 깐다.
   *
   * contentContainerStyle 을 여기에도 씌운다. 순위표처럼 목록이 카드 안에 들어가는 화면은
   * 그 카드 모양이 이 스타일에 들어 있어서, 빼먹으면 로딩 중에만 흰 바탕이 사라진다.
   * 스켈레톤 색은 카드 위에서 읽히도록 잡혀 있으므로 회색 배경 위에 놓이면 거의 안 보인다.
   */
  if (query.isPending) {
    return (
      <View style={[styles.skeletonWrap, contentContainerStyle as ViewStyle]}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <View key={i}>{skeleton}</View>
        ))}
      </View>
    )
  }

  // ErrorState 가 flex:1 로 스스로 채우고 가운데 선다. 여기서 감싸지 않아야 탭마다 높이가 같다.
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} message={(query.error as Error)?.message} />
  }

  return (
    <FlashList
      {...rest}
      ref={listRef}
      data={query.data ?? []}
      contentContainerStyle={{ padding: spacing['200'], ...contentContainerStyle }}
      // FlashList 는 contentContainerStyle 의 gap 을 적용하지 않는다. 항목 사이는 구분자로 띄운다.
      ItemSeparatorComponent={ItemSeparatorComponent}
      ListEmptyComponent={<EmptyState title={emptyTitle} description={emptyDescription} />}
      /**
       * v2 는 maintainVisibleContentPosition 이 기본 켜짐이다.
       * 항목이 앞뒤로 추가되는 목록(채팅 등)에는 좋지만, 여기처럼 카테고리를 바꿔
       * 데이터가 통째로 갈리는 목록에서는 이전 항목을 붙잡으려다 스크롤 위치와
       * 콘텐츠 높이가 어긋난다. 필터가 바뀌면 맨 위에서 시작하는 게 맞다.
       */
      maintainVisibleContentPosition={{ disabled: true }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
          colors={[theme.accent]}
          progressBackgroundColor={theme.surface}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  )
}

const Separator = () => <View style={styles.separator} />

const styles = StyleSheet.create({
  skeletonWrap: { padding: spacing['200'], gap: spacing['150'] },
  separator: { height: spacing['150'] },
})

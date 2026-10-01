import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

import { InlineState } from '@/components/feedback/States'

/**
 * 받아오는 것의 네 갈래를 한자리에서 다룬다 — 기다림 · 실패 · 빈 것 · 있음.
 *
 * 이 갈래는 화면마다 똑같이 반복된다. 손으로 적으면 조건이 네 겹으로 겹쳐서, 정작
 * 보여줄 것이 제일 안쪽에 파묻히고 어느 조건에 딸린 것인지 눈으로 좇기 어렵다.
 *
 * 목록은 QueryList 가 맡는다. 이쪽은 목록이 아닌 것 — 라인업 한 벌, 영상 몇 개처럼
 * 통째로 하나인 자료다.
 */
export function QueryState<T>({
  query,
  skeleton,
  empty,
  emptyMessage = '아직 표시할 내용이 없습니다',
  errorMessage = '불러오지 못했습니다',
  children,
}: {
  query: Pick<UseQueryResult<T>, 'isPending' | 'isError' | 'data' | 'refetch'>
  /** 기다리는 동안 자리를 잡아 둘 것. 없으면 안내 문구를 쓴다 */
  skeleton?: ReactNode
  /**
   * 왔지만 비어 있는지. 비었다는 판단이 자료마다 달라서(배열 길이, 명단 유무)
   * 부르는 쪽이 정한다
   */
  empty?: (data: T) => boolean
  emptyMessage?: string
  errorMessage?: string
  children: (data: T) => ReactNode
}) {
  if (query.isPending) {
    return <>{skeleton ?? <InlineState message="불러오는 중입니다" />}</>
  }
  if (query.isError) {
    return <InlineState tone="error" message={errorMessage} onRetry={() => query.refetch()} />
  }
  if (query.data === undefined) {
    return <InlineState message={emptyMessage} />
  }
  if (empty?.(query.data)) {
    return <InlineState message={emptyMessage} />
  }
  return <>{children(query.data)}</>
}

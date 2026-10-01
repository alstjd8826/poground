import { useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { listReports, REPORT_PAGE, type Report, resolveReport } from '@/repositories/comment/reports'
import { adminDeleteComment } from '@/repositories/comment/remote'
import { adminDeletePost } from '@/repositories/community/remote'

/** 신고는 사람이 방금 누른 것이라 오래 붙잡아 두지 않는다 */
const STALE = 15_000

/**
 * 신고함.
 *
 * 기본은 **미처리만** 보여 준다. 할 일 목록이므로 끝난 것까지 섞여 있으면 무엇이 남았는지
 * 세어야 한다. 지난 것을 보려면 손으로 켠다.
 */
export function useReports() {
  const client = useQueryClient()
  const [onlyOpen, setOnlyOpen] = useState(true)

  const query = useInfiniteQuery({
    queryKey: ['reports', onlyOpen],
    queryFn: ({ pageParam }) => listReports(pageParam, onlyOpen),
    initialPageParam: 0,
    // 한 쪽을 다 채워 왔으면 다음이 있을 수 있다. 덜 왔으면 거기가 끝이다
    getNextPageParam: (last, all) => (last.length < REPORT_PAGE ? undefined : all.length),
    staleTime: STALE,
  })

  const refresh = () => client.invalidateQueries({ queryKey: ['reports'] })

  const resolve = useMutation({ mutationFn: resolveReport, onSuccess: refresh })

  /**
   * 글을 지우면 신고도 함께 끝난 것으로 둔다.
   *
   * 지우는 것이 곧 처리다. 두 번 눌러야 하면 지우고 나서 미처리로 남은 줄을 다시 보게
   * 되고, 그것이 아직 할 일이 있다는 뜻인지 헷갈린다.
   */
  const removeAndResolve = useMutation({
    mutationFn: async (report: Report) => {
      // 둘 다 관리자 함수로 — 나만 보기 글의 것은 관리자도 읽기 정책에 걸려 update 가 조용히 0 행이 된다
      if (report.kind === 'post') await adminDeletePost(report.targetId)
      else await adminDeleteComment(report.targetId)
      await resolveReport(report)
    },
    onSuccess: () => {
      refresh()
      client.invalidateQueries({ queryKey: ['comments'] })
      client.invalidateQueries({ queryKey: ['community'] })
    },
  })

  const pages = query.data?.pages
  const reports = useMemo<Report[]>(() => pages?.flat() ?? [], [pages])

  return { reports, query, onlyOpen, setOnlyOpen, resolve, removeAndResolve }
}

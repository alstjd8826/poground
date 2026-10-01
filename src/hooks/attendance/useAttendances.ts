import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/auth/useAuth'
import { type AttendanceRow, attendanceKeyOf, sameKey } from '@/models/attendance'
import type { Match } from '@/models/kleague'
import { listMine, mark, unmark } from '@/repositories/attendance/remote'

/**
 * 내 직관 기록의 질의 열쇠. 누구의 답인지 담는다 (adminKey 와 같은 이유).
 * 목록에는 주소가 없어 기기에 저장돼도 만료될 것이 없다.
 */
export const attendancesKey = (userId: string | null) => ['myAttendances', userId] as const

const EMPTY: AttendanceRow[] = []

export function useAttendances() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  const queryKey = attendancesKey(userId)

  const query = useQuery({
    queryKey,
    queryFn: listMine,
    enabled: userId !== null,
    staleTime: 60_000,
  })
  const rows = (userId !== null && query.data) || EMPTY

  const write = useCallback(
    (update: (prev: AttendanceRow[]) => AttendanceRow[]) =>
      queryClient.setQueryData<AttendanceRow[]>(queryKey, prev => update(prev ?? [])),
    // queryKey 는 userId 로만 바뀐다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId],
  )

  /**
   * 표시와 취소를 오간다. 누르는 즉시 화면에 반영하고, 실패하면 되돌리고 오류를 던진다 —
   * 알림은 부르는 화면이 띄운다. 끝나면 서버 목록으로 다시 맞춘다. 빠르게 두 번 눌러도
   * 마지막 상태가 서버와 같아진다.
   */
  const toggle = useCallback(
    async (match: Match) => {
      if (!userId) throw new Error('로그인이 필요합니다')
      const key = attendanceKeyOf(match)
      // 이미 날아가던 다시 받기가 방금 반영한 것을 덮지 않게 먼저 거둔다
      await queryClient.cancelQueries({ queryKey })
      const before = queryClient.getQueryData<AttendanceRow[]>(queryKey) ?? []
      const had = before.some(r => sameKey(r, key))
      write(prev =>
        had ? prev.filter(r => !sameKey(r, key)) : [...prev, { ...key, updatedAt: new Date().toISOString() }],
      )
      try {
        if (had) await unmark(key)
        else await mark(userId, key)
      } catch (e) {
        write(() => before)
        throw e
      } finally {
        // 서버 목록으로 다시 맞출 때까지 기다린다. 끝난 뒤의 상태가 곧 서버 상태가 되고,
        // 늦게 도착한 응답이 다음 누름의 반영을 덮지 않는다. 다시 받기가 실패해도 던지지 않는다
        await queryClient.invalidateQueries({ queryKey })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId, write],
  )

  return { rows, signedIn: userId !== null, query, toggle }
}

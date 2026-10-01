/**
 * "방금 / N분 전 / N시간 전 / N일 전", 일주일이 넘으면 "M.D".
 *
 * 댓글과 게시글은 방금 쓴 것이 대부분이라 날짜보다 이쪽이 읽힌다.
 */
export function relativeTime(iso: string, now = Date.now()): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}일 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()}`
}

import { relativeTime } from '@/utils/relativeTime'

const NOW = new Date('2026-09-28T12:00:00+09:00').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('상대 시간', () => {
  it.each([
    [30_000, '방금'],
    [5 * 60_000, '5분 전'],
    [3 * 3_600_000, '3시간 전'],
    [2 * 86_400_000, '2일 전'],
  ])('%p ms 전은 %s', (ms, text) => {
    expect(relativeTime(ago(ms), NOW)).toBe(text)
  })

  it('일주일이 넘으면 날짜로', () => {
    expect(relativeTime('2026-09-10T12:00:00+09:00', NOW)).toBe('9.10')
  })
})

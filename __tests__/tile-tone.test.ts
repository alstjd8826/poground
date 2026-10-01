import { tileTone } from '@/components/community/AttendanceTile'
import { awayTheme, homeTheme } from '@/styles/colors/theme'

/**
 * 글만 있는 직관 칸의 색. 지금 색(테마 강조색 + 옅은 바탕)을 하나로 두고 몇 가지를 더 돌린다 (2026-09-29).
 * 글마다 정해진 색이다 — 다시 그릴 때마다 바뀌면 같은 글이 볼 때마다 다른 칸처럼 보인다.
 */

const ids = Array.from({ length: 30 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)

it('같은 글은 늘 같은 색이다', () => {
  expect(tileTone(ids[3]!, homeTheme)).toEqual(tileTone(ids[3]!, homeTheme))
})

it('여러 글이면 여러 색으로 흩어진다', () => {
  const tones = new Set(ids.map(id => tileTone(id, homeTheme).quote))
  expect(tones.size).toBeGreaterThanOrEqual(4)
})

it('지금 색(테마 강조색과 그 옅은 바탕)도 그중 하나다', () => {
  const tones = ids.map(id => tileTone(id, homeTheme))
  expect(tones).toContainEqual({ quote: homeTheme.accent, background: homeTheme.accentSoft })
})

/** 어두운 테마는 짙은 바탕, 밝은 테마는 옅은 바탕 — 지금 accentSoft 가 테마마다 그렇듯이 */
it('밝은 테마에서는 바탕이 밝다', () => {
  const light = (hex: string) =>
    parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)
  for (const id of ids) {
    expect(light(tileTone(id, awayTheme).background)).toBeGreaterThan(600)
    expect(light(tileTone(id, homeTheme).background)).toBeLessThan(400)
  }
})

import { MinimalTextEncoder } from '@/repositories/remote/webcrypto'

/**
 * 손으로 짠 UTF-8 인코더라 플랫폼이 주는 것과 한 바이트도 다르면 안 된다.
 * 어긋나면 PKCE 챌린지 해시가 달라져 로그인이 통째로 막힌다.
 */
describe('MinimalTextEncoder', () => {
  const cases = [
    'abc123',
    '0f3a9c', // 실제로 넣는 값은 이 모양의 16진수 문자열이다
    '포그라운드',
    'Pohang 포항 축구',
    '😀🔥', // 대리쌍
    // 각 바이트 길이의 경계값
    String.fromCodePoint(0x7f, 0x80, 0x7ff, 0x800, 0xffff, 0x10000, 0x10ffff),
  ]

  it.each(cases)('플랫폼 TextEncoder 와 같은 바이트를 낸다: %s', input => {
    const mine = new MinimalTextEncoder().encode(input)
    const theirs = new TextEncoder().encode(input)
    expect(Array.from(mine)).toEqual(Array.from(theirs))
  })

  it('빈 문자열과 인자 없음은 둘 다 빈 배열이다', () => {
    expect(new MinimalTextEncoder().encode('')).toEqual(new Uint8Array([]))
    expect(new MinimalTextEncoder().encode()).toEqual(new Uint8Array([]))
  })
})

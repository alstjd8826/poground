import { sharedGroup } from '@/utils/sharedTransition'

/**
 * 공유 전환은 태그가 어긋나도 에러가 나지 않는다. 조각 하나가 조용히 대열에서 빠질 뿐이라
 * 눈으로만 잡힌다. 그래서 태그를 만들어 내는 규칙만이라도 여기서 못 박아 둔다.
 */
describe('sharedGroup', () => {
  it('scope · id · 조각 이름을 이어 붙인다', () => {
    const sharedTag = sharedGroup('match', 172)
    expect(sharedTag('card')).toBe('match-172-card')
    expect(sharedTag('home-name')).toBe('match-172-home-name')
  })

  it('같은 화면에 놓인 다른 경기끼리는 태그가 겹치지 않는다', () => {
    expect(sharedGroup('match', 172)('card')).not.toBe(sharedGroup('match', 178)('card'))
  })

  it('한 카드 안에서도 조각마다 태그가 다르다', () => {
    const sharedTag = sharedGroup('match', 172)
    const tags = ['card', 'stripe', 'meta', 'score', 'home-emblem', 'home-name'].map(sharedTag)
    expect(new Set(tags).size).toBe(tags.length)
  })

  it('두 화면에서 같은 경기·같은 조각이면 값이 같아야 짝이 맞는다', () => {
    expect(sharedGroup('match', 172)('score')).toBe(sharedGroup('match', 172)('score'))
  })

  it('꺼 두면 태그를 내주지 않아 목록에서 태그가 충돌하지 않는다', () => {
    expect(sharedGroup('match', 172, false)('card')).toBeUndefined()
  })
})

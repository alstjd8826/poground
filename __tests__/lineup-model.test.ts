import { cardOf, hasLineup, type LineupPlayer, recordTally, wasSubstituted } from '@/models/kleague'

const player = (records: string[], extra: Partial<LineupPlayer> = {}): LineupPlayer => ({
  playerId: '20170097',
  side: 'home',
  teamId: 'K03',
  backNo: 44,
  position: 'MF',
  name: '이순민',
  isCaptain: false,
  isStarter: true,
  order: 5,
  records,
  substitutedAt: null,
  substitutedWith: null,
  ...extra,
})

describe('cardOf', () => {
  it('경고 한 장은 노란 카드', () => {
    expect(cardOf(player(['파울', '경고']))).toBe('경고')
  })

  /**
   * 아래 두 케이스는 2026 시즌 56경기를 훑어 확인한 실제 표기다.
   * 원본은 스트레이트 레드에만 '퇴장' 라벨을 주고, 경고 누적에는 주지 않는다.
   * 둘을 빨간 카드 하나로 뭉치면 "왜 나갔는지" 가 사라진다.
   */
  it('경고 두 장은 누적 퇴장 (168 이정택)', () => {
    expect(cardOf(player(['파울', '경고', '파울', '경고']))).toBe('누적 퇴장')
  })

  it('퇴장 라벨은 스트레이트 레드 (150 홍철)', () => {
    expect(cardOf(player(['파울', '파울', '파울', '퇴장']))).toBe('퇴장')
  })

  it('경고와 퇴장이 함께 있으면 퇴장이 이긴다', () => {
    // 관측되진 않았지만 원본이 그렇게 주면 스트레이트 레드로 본다
    expect(cardOf(player(['경고', '퇴장']))).toBe('퇴장')
  })

  it('기록이 없으면 카드도 없다', () => {
    expect(cardOf(player([]))).toBeNull()
  })
})

describe('recordTally', () => {
  it('같은 기록이 반복되면 횟수로 접는다', () => {
    // 원본은 파울 2회를 "파울|파울" 로 준다. 그대로 두면 같은 뱃지가 두 번 뜬다
    expect(recordTally(player(['파울', '파울', '유효슈팅']))).toEqual([
      { label: '파울', count: 2 },
      { label: '유효슈팅', count: 1 },
    ])
  })

  it('카드와 교체는 따로 그리므로 뱃지에서 뺀다', () => {
    expect(recordTally(player(['경고', '퇴장', '교체', '파울']))).toEqual([{ label: '파울', count: 1 }])
  })

  it('처음 나온 순서를 지킨다', () => {
    expect(recordTally(player(['유효슈팅', '파울', '유효슈팅'])).map(r => r.label)).toEqual([
      '유효슈팅',
      '파울',
    ])
  })
})

describe('wasSubstituted', () => {
  it('교체 시각이 있으면 교체된 선수', () => {
    expect(wasSubstituted(player([], { substitutedAt: 45 }))).toBe(true)
    expect(wasSubstituted(player([]))).toBe(false)
  })
})

describe('hasLineup', () => {
  const team = (starters: LineupPlayer[]) => ({
    side: 'home' as const,
    teamId: 'K03',
    coach: null,
    starters,
    bench: [],
  })

  it('아직 안 받았으면 없다', () => {
    expect(hasLineup(undefined)).toBe(false)
  })

  it('양 팀 다 비어 있으면 없다', () => {
    expect(hasLineup({ home: team([]), away: team([]) })).toBe(false)
  })

  it('한쪽이라도 선발이 있으면 있다', () => {
    expect(hasLineup({ home: team([player([])]), away: team([]) })).toBe(true)
  })
})

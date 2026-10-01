import {
  CLUB_TICKET_URL,
  type Match,
  POHANG,
  POHANG_TICKET_URL,
  RANK_TIERS,
  outcomeOf,
  sideOf,
  ticketUrlOf,
  tierOfRank,
} from '@/models/kleague'
import {
  defaultMonthOf,
  hasLiveMatch,
  lastMatchOf,
  matchesInMonth,
  monthLabelOf,
  monthsOf,
  nextMatchOf,
  seasonMonthsOf,
} from '@/services/kleague/matchService'
import { mockMatchFinished, mockMatchLive, mockMatchScheduled } from '@/utils/fixtures'

describe('경기 모델', () => {
  it('홈/원정을 구분한다', () => {
    expect(sideOf(mockMatchScheduled)).toBe('home')
    expect(sideOf(mockMatchFinished)).toBe('away')
  })

  it('종료 경기만 승패를 판정한다', () => {
    expect(outcomeOf(mockMatchFinished)).toBe('draw')
    // 미시작 경기는 점수가 null 이라 결과가 없다
    expect(outcomeOf(mockMatchScheduled)).toBeNull()
    // 진행 중에도 아직 확정이 아니다
    expect(outcomeOf(mockMatchLive)).toBeNull()
  })

  it('승패를 우리 팀 기준으로 계산한다', () => {
    // mockMatchFinished 는 포항이 원정
    const won = {
      ...mockMatchFinished,
      home: { ...mockMatchFinished.home, goal: 0 },
      away: { ...mockMatchFinished.away, goal: 3 },
    }
    expect(outcomeOf(won, POHANG)).toBe('win')
    const lost = {
      ...mockMatchFinished,
      home: { ...mockMatchFinished.home, goal: 3 },
      away: { ...mockMatchFinished.away, goal: 0 },
    }
    expect(outcomeOf(lost, POHANG)).toBe('loss')
  })

  it('티켓링크 예매 링크는 모바일 도메인을 쓴다', () => {
    // www 쪽 경로는 휴대폰에서 열면 종목 목록으로 리다이렉트돼 구단 페이지를 잃는다
    expect(POHANG_TICKET_URL).toMatch(/^https:\/\/m\.ticketlink\.co\.kr\//)
    for (const url of Object.values(CLUB_TICKET_URL)) {
      if (url.includes('ticketlink')) expect(url).toMatch(/^https:\/\/m\.ticketlink\.co\.kr\//)
    }
  })

  it('티켓링크 구단은 구단 고정 URL 로 대체한다', () => {
    // 수집 단계에서 ticket_url 이 null (goodsCode 가 없어서)
    expect(ticketUrlOf(mockMatchScheduled)).toBe(POHANG_TICKET_URL)
    // 끝난 경기는 예매 링크를 주지 않는다
    expect(ticketUrlOf(mockMatchFinished)).toBeNull()
  })

  /**
   * 원정 경기에서 예매 길이 끊기지 않는지 본다.
   *
   * 표를 파는 쪽은 홈 구단이라 링크도 홈 구단 것이어야 한다. 예전에는 포항 홈경기만
   * 채워 둬서 원정 경기 카드를 눌러도 아무 일이 없었다.
   */
  it('원정 경기는 홈 구단 예매 페이지로 보낸다', () => {
    const away: Match = {
      ...mockMatchScheduled,
      home: { ...mockMatchScheduled.home, id: 'K18', name: '인천' },
      away: { ...mockMatchScheduled.away, id: POHANG, name: '포항' },
    }
    expect(sideOf(away)).toBe('away')
    expect(ticketUrlOf(away)).toBe(CLUB_TICKET_URL.K18)
    expect(ticketUrlOf(away)).not.toBe(POHANG_TICKET_URL)
  })

  it('예매처를 모르는 구단은 링크를 만들지 않는다', () => {
    const unknown: Match = {
      ...mockMatchScheduled,
      home: { ...mockMatchScheduled.home, id: 'K99', name: '없는구단' },
    }
    expect(ticketUrlOf(unknown)).toBeNull()
  })

  it('인터파크 딥링크가 있으면 그걸 우선한다', () => {
    const interpark = { ...mockMatchScheduled, ticketUrl: 'https://tickets.interpark.com/goods/123' }
    expect(ticketUrlOf(interpark)).toBe('https://tickets.interpark.com/goods/123')
  })
})

describe('경기 목록 파생', () => {
  const list = [mockMatchFinished, mockMatchScheduled]

  it('다음 경기는 아직 안 끝난 것 중 가장 이른 경기', () => {
    expect(nextMatchOf(list, new Date('2026-09-15T00:00:00+09:00'))?.id).toBe(mockMatchScheduled.id)
  })

  it('최근 경기는 끝난 것 중 가장 늦은 경기', () => {
    expect(lastMatchOf(list)?.id).toBe(mockMatchFinished.id)
  })

  it('라이브 경기 유무를 알려준다', () => {
    expect(hasLiveMatch(list)).toBe(false)
    expect(hasLiveMatch([...list, mockMatchLive])).toBe(true)
  })
})

describe('월 필터', () => {
  const at = (iso: string, id: number, status: Match['status'] = 'finished'): Match => ({
    ...mockMatchFinished,
    id,
    status,
    kickoffAtMs: new Date(iso).getTime(),
  })

  const season = [
    at('2026-03-01T14:00:00+09:00', 1),
    at('2026-09-12T19:00:00+09:00', 2),
    at('2026-09-20T19:00:00+09:00', 3, 'scheduled'),
    at('2026-11-30T14:00:00+09:00', 4, 'scheduled'),
  ]

  it('경기가 있는 달만 시간 순으로 준다', () => {
    // 비어 있는 달까지 넣으면 누를 수 없는 탭이 생긴다
    expect(monthsOf(season)).toEqual(['2026-03', '2026-09', '2026-11'])
  })

  it('같은 달 경기를 킥오프 순으로 모은다', () => {
    expect(matchesInMonth(season, '2026-09').map(m => m.id)).toEqual([2, 3])
  })

  it('없는 달이면 빈 목록', () => {
    expect(matchesInMonth(season, '2026-07')).toEqual([])
  })

  it('처음 열 달은 다음 경기가 있는 달', () => {
    expect(defaultMonthOf(season, new Date('2026-09-16T12:00:00+09:00'))).toBe('2026-09')
  })

  it('다음 경기가 없으면 마지막으로 치른 달로 떨어진다', () => {
    // 12월에는 앞으로 올 경기가 없다. 이때 빈 화면을 여느니 마지막으로 치른 9월을 연다
    expect(defaultMonthOf(season, new Date('2026-12-25T12:00:00+09:00'))).toBe('2026-09')
  })

  it('경기가 없으면 고를 달도 없다', () => {
    expect(defaultMonthOf([])).toBeUndefined()
    expect(monthsOf(undefined)).toEqual([])
  })

  it('라벨은 월만 뽑는다', () => {
    expect(monthLabelOf('2026-09')).toBe('9월')
    expect(monthLabelOf('2026-11')).toBe('11월')
  })
})

describe('시즌 월 범위', () => {
  const at = (iso: string, id: number): Match => ({
    ...mockMatchFinished,
    id,
    kickoffAtMs: new Date(iso).getTime(),
  })
  const months = (year: number) =>
    Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  it('경기가 몇 달에 몰려 있어도 그 해 열두 달을 모두 준다', () => {
    // 비어 있는 달도 자리를 지켜야 "쉬는 달" 로 읽힌다
    const season = [at('2026-04-05T19:00:00+09:00', 1), at('2026-08-01T19:00:00+09:00', 2)]
    expect(seasonMonthsOf(season)).toEqual(months(2026))
  })

  it('시즌이 해를 넘기면 두 해를 모두 준다', () => {
    const season = [at('2026-11-30T14:00:00+09:00', 1), at('2027-02-01T14:00:00+09:00', 2)]
    expect(seasonMonthsOf(season)).toEqual([...months(2026), ...months(2027)])
  })

  it('경기가 없으면 빈 목록', () => {
    expect(seasonMonthsOf([])).toEqual([])
    expect(seasonMonthsOf(undefined)).toEqual([])
  })

  it('경기가 있는 달만 따로 가려낸다', () => {
    // 화면은 seasonMonthsOf 를 늘어놓고 여기 없는 달을 잠근다
    const season = [at('2026-04-05T19:00:00+09:00', 1), at('2026-08-01T19:00:00+09:00', 2)]
    expect(monthsOf(season)).toEqual(['2026-04', '2026-08'])
  })
})

describe('순위 자격', () => {
  /**
   * 대회 규정이라 수집되지 않고 코드에 박혀 있다. 시즌이 바뀌면 여기가 먼저 틀어지므로
   * 어느 순위가 어느 등급인지 못 박아 둔다.
   */
  it('1~2위는 ACLE, 3위는 ACL2, 12위는 강등 PO', () => {
    expect(tierOfRank(1)).toBe('acle')
    expect(tierOfRank(2)).toBe('acle')
    expect(tierOfRank(3)).toBe('acl2')
    expect(tierOfRank(12)).toBe('relegation')
  })

  it('중위권은 등급이 없다', () => {
    for (const rank of [4, 5, 6, 7, 8, 9, 10, 11]) expect(tierOfRank(rank)).toBeNull()
  })

  it('규정마다 설명 문구가 있다', () => {
    // 색만 칠하고 설명이 없으면 파란 줄이 무슨 뜻인지 알 수 없다
    expect(RANK_TIERS.every(r => r.note.length > 0)).toBe(true)
    expect(RANK_TIERS.map(r => r.tier)).toEqual(['acle', 'acl2', 'relegation'])
  })
})

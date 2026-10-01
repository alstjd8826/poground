import { toMatch, toStanding, toVideoClips } from '@/services/kleague/mappers'
import type { MatchRow, StandingRow, VideoRow } from '@/repositories/kleague/rows'
import { mockMatchFinished, mockNews, mockStandings, mockVideos } from '@/utils/fixtures'

const matchRow: MatchRow = {
  year: 2026,
  league_id: 1,
  game_id: 172,
  round_id: 29,
  kickoff_at: '2026-09-12T19:00:00+09:00',
  match_date: '2026-09-12',
  home_team_id: 'K10',
  home_team_name: '대전',
  away_team_id: 'K03',
  away_team_name: '포항',
  home_goal: 2,
  away_goal: 2,
  status: 'finished',
  field_name: '대전 월드컵',
  field_name_full: '대전 월드컵 경기장',
  audience_qty: 14231,
  broadcast: 'COUPANGPLAY',
  ticket_company: 'E',
  ticket_url: null,
}

describe('경기 매퍼', () => {
  it('평평한 컬럼을 홈/원정 객체로 묶는다', () => {
    const m = toMatch(matchRow)
    expect(m.id).toBe(172)
    expect(m.home).toEqual({
      id: 'K10',
      name: '대전',
      goal: 2,
      emblemUrl: 'https://www.kleague.com/assets/images/emblem/emblem_K10@3x.png',
    })
    expect(m.away.id).toBe('K03')
  })

  /**
   * 밀리초로 든다. Date 객체로 들면 쿼리 캐시를 기기에 저장할 때 문자열이 되고,
   * 복원한 뒤 .getTime() 을 부르는 자리에서 죽는다 — Match.kickoffAtMs 주석 참고.
   */
  it('킥오프를 밀리초로 바꾼다 (KST 오프셋 보존)', () => {
    const m = toMatch(matchRow)
    expect(typeof m.kickoffAtMs).toBe('number')
    expect(new Date(m.kickoffAtMs).toISOString()).toBe('2026-09-12T10:00:00.000Z')
  })

  /** JSON 을 오가도 값이 그대로여야 한다. 이것이 Date 를 버린 이유다 */
  it('JSON 을 오가도 킥오프가 그대로다', () => {
    const m = toMatch(matchRow)
    const restored = JSON.parse(JSON.stringify(m)) as typeof m
    expect(restored.kickoffAtMs).toBe(m.kickoffAtMs)
  })

  it('미시작 경기의 골은 null 로 남긴다', () => {
    const m = toMatch({ ...matchRow, status: 'scheduled', home_goal: null, away_goal: null })
    expect(m.home.goal).toBeNull()
    expect(m.away.goal).toBeNull()
  })
})

describe('순위 매퍼', () => {
  const row: StandingRow = {
    year: 2026,
    team_id: 'K03',
    team_name: '포항',
    rank: 8,
    points: 37,
    played: 29,
    win: 10,
    draw: 7,
    loss: 12,
    goals_for: 35,
    goals_against: 40,
    goal_diff: -5,
    recent_form: ['무', '패', '승'],
  }

  it('컬럼명을 도메인 이름으로 바꾼다', () => {
    const s = toStanding(row)
    expect(s.teamId).toBe('K03')
    expect(s.goalDiff).toBe(-5)
    expect(s.recentForm).toEqual(['무', '패', '승'])
  })

  it('알 수 없는 폼 값은 버린다', () => {
    // 원본이 예상 밖 문자열을 주면 화면이 그리지 못한다
    const s = toStanding({ ...row, recent_form: ['승', 'X', '', '패'] })
    expect(s.recentForm).toEqual(['승', '패'])
  })
})

describe('영상 매퍼', () => {
  const row: VideoRow = {
    seq: 1,
    round_id: 29,
    category: 'goal',
    title: 'R29 골',
    published_on: '2026-09-12',
    view_count: 10,
    youtube_id: 'abc12345678',
    thumbnail_url: null,
  }

  it('재생 불가한 영상은 도메인에 들이지 않는다', () => {
    const out = toVideoClips([row, { ...row, seq: 2, youtube_id: null }])
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe(1)
  })

  it('썸네일이 없으면 유튜브 ID 로 만들어 채운다', () => {
    expect(toVideoClips([row])[0]!.thumbnailUrl).toBe('https://i.ytimg.com/vi/abc12345678/hqdefault.jpg')
  })
})

/**
 * 쿼리 캐시는 기기에 **JSON 으로** 저장된다 (App.tsx 의 PersistQueryClientProvider).
 *
 * 그래서 캐시에 담기는 모양은 JSON 을 오간 뒤에도 값이 같아야 한다. Date 객체가 대표적인
 * 예외다 — 저장할 때 문자열이 되고 복원하면 문자열로 돌아와, .getTime() 을 부르는 자리에서
 * 앱을 껐다 켠 첫 화면이 죽는다. 실제로 Match.kickoffAt 이 그랬고 그래서 밀리초로 바꿨다.
 *
 * 값이 같은지만 보면 Date 는 못 잡는다(문자열끼리 같아진다). 그래서 **모양이 바뀌지
 * 않았는지** 를 본다 — 원본을 JSON 으로 한 번 돌린 것과 두 번 돌린 것이 같아야 한다.
 * Date 가 섞이면 첫 왕복에서 문자열로 바뀌므로 둘이 어긋난다.
 */
describe('캐시에 담기는 모양', () => {
  const survivesJson = (value: unknown) => {
    const once = JSON.parse(JSON.stringify(value))
    // 한 번 더 돌려도 그대로면 JSON 이 표현할 수 있는 값만 들어 있다는 뜻이다
    expect(once).toEqual(value)
  }

  it('경기', () => survivesJson(mockMatchFinished))
  it('순위', () => survivesJson(mockStandings))
  it('소식', () => survivesJson(mockNews))
  it('영상', () => survivesJson(mockVideos))
})

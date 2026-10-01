/**
 * 도메인 모델.
 *
 * 화면과 서비스가 쓰는 모양이다. DB 컬럼(snake_case)과 일부러 다르게 둔다 —
 * 스키마가 바뀌어도 services/kleague/mappers.ts 만 고치면 화면은 그대로다.
 * DB 행 타입은 repositories/kleague/rows.ts 에 있고 매퍼 밖으로 나오지 않는다.
 */

export const POHANG = 'K03'

/**
 * 구단별 예매 페이지.
 *
 * K리그 API 는 예매처 코드(company)만 주고 경기별 상품코드(goodsCode)는 대체로 비워 둔다 —
 * 수집한 199경기 중 경기 딥링크가 잡힌 것은 3건뿐이었다. 그래서 딥링크가 없을 때 갈 곳을
 * 구단마다 손으로 적어 둔다. **원정 응원석은 홈 구단이 팔기 때문에** 포항 홈경기만 채워
 * 두면 원정 경기에서는 예매로 가는 길이 아예 없다.
 *
 * 티켓링크는 반드시 모바일 도메인(m.)의 이 경로를 쓴다. www 쪽 /sports/football/{id} 는
 * 휴대폰에서 열면 m.ticketlink.co.kr/sports?null 로 리다이렉트되면서 구단 페이지를 잃어버리고
 * 종목 목록으로 떨어진다. (138 = 축구, 뒤 숫자 = 구단)
 *
 * 2026-09-17 에 각 구단 공식 사이트와 티켓링크에서 확인했다. 예매처를 갈아타면 조용히
 * 엉뚱한 곳으로 보내게 되므로, 시즌이 바뀌면 다시 훑어야 한다.
 * 부천(K26)은 인터파크 판매인데 구단이 상시 페이지를 걸어 두지 않아 비워 뒀다. K리그2라
 * 포항의 원정 상대가 되지 않는다.
 */
export const CLUB_TICKET_URL: Readonly<Record<string, string>> = {
  K01: 'https://m.ticketlink.co.kr/sports/138/66', // 울산 HD
  K03: 'https://m.ticketlink.co.kr/sports/138/74', // 포항 스틸러스
  K04: 'https://www.jejuskfc.com/reservation/ticketInfo', // 제주SK — 구단 자체 판매
  K05: 'https://m.ticketlink.co.kr/sports/138/73', // 전북 현대
  K09: 'https://m.ticketlink.co.kr/sports/138/65', // FC서울
  K10: 'https://m.ticketlink.co.kr/sports/138/83', // 대전 하나 시티즌
  K18: 'https://m.ticketlink.co.kr/sports/138/77', // 인천 유나이티드
  K21: 'https://nol.yanolja.com/ticket/genre/sports/gangwonfc', // 강원FC — 인터파크(NOL)
  K22: 'https://m.ticketlink.co.kr/sports/138/79', // 광주FC
  K27: 'https://m.ticketlink.co.kr/sports/138/86', // FC안양
  K35: 'https://m.ticketlink.co.kr/sports/138/80', // 김천 상무
}

/** 포항 홈경기의 예매 페이지. 화면에서 구단 없이 부를 일이 있어 이름을 남겨 둔다 */
export const POHANG_TICKET_URL = CLUB_TICKET_URL[POHANG]!

export type MatchStatus = 'scheduled' | 'live' | 'finished'
export type MatchSide = 'home' | 'away'
export type MatchOutcome = 'win' | 'draw' | 'loss' | null

export interface MatchTeam {
  id: string
  name: string
  /** 골. 미시작 경기는 null (원본의 0 은 점수가 아니다) */
  goal: number | null
  emblemUrl: string
}

export interface Match {
  id: number
  round: number | null
  /**
   * 킥오프. **밀리초**다.
   *
   * Date 객체로 들지 않는다. 쿼리 캐시를 기기에 저장하게 되면서(JSON) Date 는 저장할 때
   * 문자열이 되고 복원하면 문자열로 돌아온다. 그걸 모르고 .getTime() 을 부르면 앱을
   * 껐다 켠 첫 화면에서 죽는다 — 홈의 "다음 경기" 가 바로 그 경로를 탄다.
   *
   * 숫자로 들면 저장과 복원이 같은 값이고, 비교와 정렬도 그대로 된다. 날짜로 다뤄야 하는
   * 자리(요일·달 뽑기)에서만 new Date(kickoffAtMs) 로 바꾼다. 이름에 단위를 남겨
   * 초·Date 와 헷갈리지 않게 한다.
   */
  kickoffAtMs: number
  status: MatchStatus
  home: MatchTeam
  away: MatchTeam
  stadium: string | null
  broadcast: string | null
  attendance: number | null
  /** 예매 링크. 인터파크 구단만 경기별로 나온다 */
  ticketUrl: string | null
  ticketVendor: string | null
}

export type FormResult = '승' | '무' | '패'

export interface Standing {
  teamId: string
  teamName: string
  rank: number
  points: number
  played: number
  win: number
  draw: number
  loss: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  /** 최근 6경기, 최신순 */
  recentForm: FormResult[]
}

export interface NewsArticle {
  id: number
  category: string | null
  /** 제목의 "[포항]" 접두어에서 뽑은 구단명 */
  clubTag: string | null
  title: string
  publishedOn: string | null
  viewCount: number | null
}

/**
 * 기사 원문 주소.
 *
 * seq 만 넘기면 404 가 난다 — 목록 링크가 늘 달고 다니는 네 가지를 같이 보내야 한다
 * (supabase/functions/_shared/kleague/news-client.ts 에 같은 주석이 있다).
 */
export function newsUrlOf(seq: number): string {
  return `https://www.kleague.com/news_view.do?seq=${seq}&orderBy=seq&viewOption=album&page=1`
}

export interface VideoClip {
  id: number
  /** 경기와 잇는 키. 수집 시 제목에서 뽑아 저장한다 */
  round: number | null
  category: string | null
  title: string
  publishedOn: string | null
  viewCount: number | null
  /** 재생 불가한 항목은 매퍼가 걸러내므로 여기서는 항상 값이 있다 */
  youtubeId: string
  thumbnailUrl: string | null
}

export interface Player {
  /**
   * K리그 선수 고유 ID.
   *
   * 스쿼드 API 는 이 값을 주지 않아 라인업에서 끌어온다. 한 번도 명단에 못 든 선수는
   * 비어 있을 수 있다 — 사진 주소를 만들 수 없으므로 화면이 그 경우를 다뤄야 한다.
   */
  playerId: string | null
  name: string
  backNo: number | null
  /** GK / DF / MF / FW */
  position: string | null
  appearances: number
  goals: number
  assists: number
  shots: number
  fouls: number
  yellowCards: number
  redCards: number
  photoUrl: string | null
}

export interface Club {
  teamId: string
  name: string
  shortName: string | null
  emblemUrl: string | null
  youtubeChannelId: string | null
  instagramUrl: string | null
  facebookUrl: string | null
  twitterUrl: string | null
  homepage: string | null
}

/**
 * 라인업의 선수 한 명.
 *
 * 출처가 경기 페이지라 팀 합계(점유율·슈팅 수)는 얻을 수 없다. 여기 있는 건 전부 선수 단위다.
 */
export interface LineupPlayer {
  playerId: string
  side: MatchSide
  teamId: string
  backNo: number | null
  /** GK / DF / MF / FW */
  position: string | null
  name: string
  isCaptain: boolean
  isStarter: boolean
  /** 팀 안에서의 등장 순서. 선발은 이 순서가 곧 포지션 흐름이다 */
  order: number
  /** 기록 뱃지. 예: 파울, 경고, 유효슈팅 */
  records: string[]
  /** 교체 시각(분). 교체된 선수만 값이 있다 */
  substitutedAt: number | null
  substitutedWith: string | null
}

/** 한 팀의 라인업 한 덩어리. 화면이 홈/원정을 나란히 놓을 수 있게 미리 갈라 둔다 */
export interface TeamLineup {
  side: MatchSide
  teamId: string
  coach: string | null
  starters: LineupPlayer[]
  bench: LineupPlayer[]
}

export interface MatchLineup {
  home: TeamLineup
  away: TeamLineup
}

/**
 * 선수가 한 경기에서 한 일.
 *
 * 시즌 합계(출전·골)와 달리 "언제 무엇을" 을 보여준다. 라인업 행 하나가 곧 한 경기다.
 */
export interface PlayerAppearance {
  matchId: number
  round: number | null
  /** 킥오프. 밀리초다 — Match.kickoffAtMs 와 같은 이유다 */
  kickoffAtMs: number
  opponent: string
  /** 우리 팀이 홈이었는지 */
  side: MatchSide
  isStarter: boolean
  records: string[]
  substitutedAt: number | null
}

// ─────────────────────────────── 파생 (순수 함수)

/** 우리 팀이 홈인지 원정인지 */
export function sideOf(match: Match, teamId = POHANG): MatchSide {
  return match.home.id === teamId ? 'home' : 'away'
}

export function ourTeam(match: Match, teamId = POHANG): MatchTeam {
  return sideOf(match, teamId) === 'home' ? match.home : match.away
}

export function opponentOf(match: Match, teamId = POHANG): MatchTeam {
  return sideOf(match, teamId) === 'home' ? match.away : match.home
}

/**
 * 미종료 경기는 결과가 없다. 0-0 으로 보여도 status 로 판단한다.
 *
 * **스코어만 본다.** 지금 수집 범위가 K리그1 정규리그뿐이라 무승부가 그대로 성립하고,
 * 연장·승부차기가 없어 이걸로 충분하다 (원본 응답에도 그런 필드가 없다).
 *
 * 컵이나 ACL 을 들이면 여기가 조용히 틀린다 — 1-1 뒤 승부차기로 올라간 경기가 '무' 로
 * 나온다. 그때는 Match 에 승부차기 결과를 더하고 MatchOutcome 을 넓혀야 한다.
 * K리그 공식 앱에는 두 대회가 있지만 우리가 쓰는 getScheduleList.do 는 리그만 준다
 * (leagueId 1=K리그1, 2=K리그2, 3 이상은 0경기).
 */
export function outcomeOf(match: Match, teamId = POHANG): MatchOutcome {
  if (match.status !== 'finished') return null
  const mine = ourTeam(match, teamId).goal
  const theirs = opponentOf(match, teamId).goal
  if (mine === null || theirs === null) return null
  if (mine > theirs) return 'win'
  if (mine < theirs) return 'loss'
  return 'draw'
}

/** 스코어를 보여줘도 되는 경기인지 */
export function isPlayed(match: Match): boolean {
  return match.status !== 'scheduled' && match.home.goal !== null && match.away.goal !== null
}

/**
 * 이 경기의 영상을 볼 수 있는지.
 * 끝난 경기만 하이라이트가 올라오고, 라운드를 모르면 영상을 특정할 수 없다.
 */
export function hasVideosFor(match: Match): boolean {
  return match.status === 'finished' && match.round != null
}

/**
 * 경기 카드에 쓸 예매 링크.
 *
 * 표를 파는 쪽은 언제나 홈 구단이다. 그래서 경기 딥링크가 없으면 홈 구단의 예매 페이지로
 * 보낸다 — 원정이라고 포항 페이지로 보내면 그 경기 표가 없는 곳에 떨어뜨리는 셈이다.
 */
export function ticketUrlOf(match: Match): string | null {
  if (match.status !== 'scheduled') return null
  if (match.ticketUrl) return match.ticketUrl
  return CLUB_TICKET_URL[match.home.id] ?? null
}

// ─────────────────────────────── 라인업

/** 교체로 나간 선수인지. 벤치에서는 같은 표시가 "들어왔다" 는 뜻이 된다 */
export function wasSubstituted(player: LineupPlayer): boolean {
  return player.substitutedAt !== null
}

export type CardKind = '경고' | '누적 퇴장' | '퇴장'

/**
 * 카드.
 *
 * 원본이 두 종류의 퇴장을 다르게 표기한다. 2026 시즌 56경기를 훑어 확인한 규칙이다.
 *   '퇴장' 라벨      -> 스트레이트 레드 (이때 경고가 함께 붙은 예는 없었다)
 *   '경고' 두 번     -> 경고 누적 퇴장 ('퇴장' 라벨은 붙지 않는다)
 *
 * 둘을 빨간 카드 하나로 뭉치면 "왜 퇴장인지" 가 사라진다. 갈라서 돌려준다.
 * 경고를 받은 뒤 스트레이트 레드를 받는 경우는 관측되지 않았지만, 그때도 '퇴장' 이 이긴다.
 */
export function cardOf(player: LineupPlayer): CardKind | null {
  if (player.records.includes('퇴장')) return '퇴장'
  const yellows = player.records.filter(r => r === '경고').length
  if (yellows >= 2) return '누적 퇴장'
  if (yellows === 1) return '경고'
  return null
}

/** 카드·교체는 따로 그리므로 뱃지에서 뺀다 */
const OWN_ROW = new Set(['경고', '퇴장', '교체'])

/**
 * 기록 뱃지를 횟수로 접는다.
 *
 * 원본은 같은 기록을 횟수만큼 반복해서 준다 — 파울 2회면 "파울|파울" 이다. 그대로 늘어놓으면
 * 같은 뱃지가 두 번 뜨고, 줄이 길어져 잘려 나가면 뒤쪽 기록이 아예 안 보인다.
 */
export function tallyRecords(records: string[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>()
  for (const r of records) {
    if (OWN_ROW.has(r)) continue
    counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  return [...counts].map(([label, count]) => ({ label, count }))
}

export function recordTally(player: LineupPlayer): Array<{ label: string; count: number }> {
  return tallyRecords(player.records)
}

/** 라인업이 비었는지. 아직 안 치른 경기이거나 수집 전이면 비어 있다 */
export function hasLineup(lineup: MatchLineup | undefined): lineup is MatchLineup {
  if (!lineup) return false
  return lineup.home.starters.length > 0 || lineup.away.starters.length > 0
}

// ─────────────────────────────── 순위 자격 / 강등

export type RankTier = 'acle' | 'acl2' | 'relegation'

export interface RankTierRule {
  tier: RankTier
  /** 이 등급에 해당하는 순위 */
  ranks: number[]
  /** 순위표 아래에 붙는 설명. K리그 공식 순위표의 문구를 그대로 쓴다 */
  note: string
}

/**
 * 2026 K리그1 순위별 자격.
 *
 * **이 값은 수집되지 않는다.** teamRank API 는 자격/강등을 알려주는 필드가 없고
 * (priority 는 12팀 모두 1, ClubRankMsg 는 공백), 공식 순위표 페이지도 서버가 주는 HTML 에는
 * 범례가 없다. K리그 사이트가 자기 프론트엔드에 규정을 박아 두고 그린다.
 *
 * 그래서 여기 적는다. 대회 규정이라 **시즌마다 바뀔 수 있다** — 새 시즌을 열 때 반드시
 * 공식 순위표와 대조할 것. 팀 수가 바뀌면 강등 순위도 따라 바뀐다.
 */
export const RANK_TIERS: RankTierRule[] = [
  { tier: 'acle', ranks: [1, 2], note: '1~2위 팀은 ACLE 출전 자격' },
  { tier: 'acl2', ranks: [3], note: '3위 팀은 ACL2 출전 자격 (코리안컵 결과에 따라 차 순위팀 자격)' },
  {
    tier: 'relegation',
    ranks: [12],
    note: '12위 팀은 K리그2 PO 준우승팀과 승강 PO (김천상무가 12위일 경우 PO 없음)',
  },
]

export function tierOfRank(rank: number): RankTier | null {
  return RANK_TIERS.find(r => r.ranks.includes(rank))?.tier ?? null
}

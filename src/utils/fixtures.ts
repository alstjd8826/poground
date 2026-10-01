/**
 * 갤러리와 테스트용 목 데이터.
 *
 * 원본은 **DB 행 모양**으로 둔다. 실제 수집 결과에서 그대로 옮긴 값이라 현실과 어긋나지 않고,
 * 리포지토리를 목킹하는 테스트가 바로 쓸 수 있다.
 * 화면이 쓰는 도메인 모델은 매퍼를 태워 파생시킨다 — 한 벌만 유지하면 되고, 매퍼도 함께 검증된다.
 */
import type { MatchRow, NewsRow, StandingRow, VideoRow } from '@/repositories/kleague/rows'
import { toMatch, toNewsArticle, toStanding, toVideoClips } from '@/services/kleague/mappers'

// ─────────────────────────────── 행 (리포지토리가 주는 모양)

export const mockMatchFinishedRow: MatchRow = {
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

export const mockMatchScheduledRow: MatchRow = {
  ...mockMatchFinishedRow,
  game_id: 178,
  round_id: 30,
  kickoff_at: '2026-09-20T19:00:00+09:00',
  match_date: '2026-09-20',
  home_team_id: 'K03',
  home_team_name: '포항',
  away_team_id: 'K09',
  away_team_name: '서울',
  // 미시작 경기의 점수와 관중수는 값이 없다
  home_goal: null,
  away_goal: null,
  audience_qty: null,
  status: 'scheduled',
  field_name: '포항 스틸야드',
  broadcast: null,
  // 포항은 티켓링크라 경기별 딥링크가 없다. 앱이 구단 URL 로 대체하는 경로를 타게 둔다
  ticket_company: 'T',
  ticket_url: null,
}

export const mockMatchLiveRow: MatchRow = {
  ...mockMatchScheduledRow,
  game_id: 179,
  status: 'live',
  home_goal: 1,
  away_goal: 0,
}

const standingRow = (
  team_id: string,
  team_name: string,
  rank: number,
  points: number,
  win: number,
  draw: number,
  loss: number,
  goals_for: number,
  goals_against: number,
  recent_form: string[],
): StandingRow => ({
  year: 2026,
  team_id,
  team_name,
  rank,
  points,
  played: win + draw + loss,
  win,
  draw,
  loss,
  goals_for,
  goals_against,
  goal_diff: goals_for - goals_against,
  recent_form,
})

export const mockStandingRows: StandingRow[] = [
  standingRow('K09', '서울', 1, 62, 19, 5, 5, 55, 23, ['승', '패', '승', '승', '승', '승']),
  standingRow('K01', '울산', 2, 47, 14, 5, 10, 44, 38, ['승', '무', '패', '승', '승', '무']),
  standingRow('K03', '포항', 8, 37, 10, 7, 12, 35, 40, ['무', '무', '패', '무', '승', '패']),
  standingRow('K05', '전북', 9, 35, 9, 8, 12, 33, 39, ['패', '승', '무', '패', '무', '승']),
]

export const mockNewsRows: NewsRow[] = [
  {
    seq: 96344,
    category: 'club',
    club_tag: '포항',
    title: '[포항] ACL Elite 2026/27 리그스테이지 1차전 포항스틸러스 vs 베이징 궈안 사전 기자회견 전문',
    published_on: '2026-09-14',
    view_count: 25,
  },
  {
    seq: 96307,
    category: 'club',
    club_tag: '김천',
    title: '[김천] ‘박만호 맹활약’ 김천상무, 수적 열세에도 포항 상대 승점 획득!',
    published_on: '2026-09-10',
    view_count: 311,
  },
]

export const mockVideoRows: VideoRow[] = [
  {
    seq: 52707228,
    round_id: 29,
    category: 'highlight',
    title: '[30분 하이라이트] 하나은행 K리그1 2026 29R 대전 vs 포항',
    published_on: '2026-09-13',
    view_count: 1820,
    youtube_id: 'ITVOUqYZgiw',
    thumbnail_url: 'https://i.ytimg.com/vi/ITVOUqYZgiw/sddefault.jpg',
  },
  {
    seq: 52706573,
    round_id: 29,
    category: 'goal',
    title: 'R29 대전 vs 포항 이명재 88분 골',
    published_on: '2026-09-12',
    view_count: 232,
    youtube_id: 'JZlRy6j623A',
    thumbnail_url: 'https://i.ytimg.com/vi/JZlRy6j623A/sddefault.jpg',
  },
]

// ─────────────────────────────── 도메인 (화면이 쓰는 모양)

export const mockMatchFinished = toMatch(mockMatchFinishedRow)
export const mockMatchScheduled = toMatch(mockMatchScheduledRow)
export const mockMatchLive = toMatch(mockMatchLiveRow)
export const mockStandings = mockStandingRows.map(toStanding)
export const mockNews = mockNewsRows.map(toNewsArticle)
export const mockVideos = toVideoClips(mockVideoRows)

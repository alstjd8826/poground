/**
 * DB 행 타입.
 *
 * Supabase 테이블 컬럼과 1:1로 대응하는 snake_case 모양이다.
 * 이 타입은 repositories/ 와 services/ 의 매퍼까지만 보인다.
 * 화면은 models/ 의 도메인 모델만 알면 되고, 컬럼명이 바뀌어도 매퍼만 고치면 된다.
 *
 * 원본 스키마는 supabase/migrations/0001_init.sql 이다.
 */

/** DB 의 lineup_side enum */
export type MatchSideRow = 'home' | 'away'

export interface MatchRow {
  year: number
  league_id: number
  game_id: number
  round_id: number | null
  kickoff_at: string
  match_date: string
  home_team_id: string
  home_team_name: string
  away_team_id: string
  away_team_name: string
  /** 미시작 경기는 null. 원본이 0 을 주는 걸 수집 단계에서 비운다 */
  home_goal: number | null
  away_goal: number | null
  status: 'scheduled' | 'live' | 'finished'
  field_name: string | null
  field_name_full: string | null
  audience_qty: number | null
  broadcast: string | null
  ticket_company: string | null
  ticket_url: string | null
}

export interface StandingRow {
  year: number
  team_id: string
  team_name: string
  rank: number
  points: number
  played: number
  win: number
  draw: number
  loss: number
  goals_for: number
  goals_against: number
  goal_diff: number
  recent_form: string[]
}

export interface NewsRow {
  seq: number
  category: string | null
  club_tag: string | null
  title: string
  published_on: string | null
  view_count: number | null
}

export interface VideoRow {
  seq: number
  round_id: number | null
  category: string | null
  title: string
  published_on: string | null
  view_count: number | null
  youtube_id: string | null
  thumbnail_url: string | null
}

export interface PlayerRow {
  year: number
  team_id: string
  name: string
  back_no: number | null
  appearances: number | null
  goals: number | null
  assists: number | null
  shots: number | null
  fouls: number | null
  yellow_cards: number | null
  red_cards: number | null
  photo_url: string | null
}

export interface ClubRow {
  team_id: string
  name: string
  name_short: string | null
  emblem_url: string | null
  youtube_channel_id: string | null
  instagram_url: string | null
  facebook_url: string | null
  twitter_url: string | null
  homepage: string | null
}

export interface LineupRow {
  year: number
  league_id: number
  game_id: number
  player_id: string
  side: MatchSideRow
  team_id: string
  back_no: number | null
  position: string | null
  name: string
  is_captain: boolean
  is_starter: boolean
  lineup_order: number
  records: string[]
  substituted_at: number | null
  substituted_with: string | null
}

/**
 * 선수 신원만 담은 라인업 조각.
 *
 * 구단 화면은 시즌 라인업을 통째로 받아 선수마다 가장 최근 값을 남기는데, 정작 쓰는 것은
 * 여섯 열뿐이다. `*` 로 받으면 기록·교체·주장 여부까지 따라와 한 시즌이면 세 배가 된다.
 * 아래 LINEUP_IDENTITY 와 짝이다 — 한쪽만 고치면 타입과 쿼리가 어긋난다.
 */
export type TeamPlayerRow = Pick<
  LineupRow,
  'game_id' | 'player_id' | 'team_id' | 'back_no' | 'position' | 'name'
>

/** TeamPlayerRow 로 받을 열. PostgREST 에 그대로 넘긴다 */
export const LINEUP_IDENTITY = 'game_id,player_id,team_id,back_no,position,name'

export interface CoachRow {
  year: number
  league_id: number
  game_id: number
  side: MatchSideRow
  name: string
}

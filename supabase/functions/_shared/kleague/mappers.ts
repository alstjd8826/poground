/**
 * 원본 응답 -> DB row 변환. 전부 순수 함수라 네트워크 없이 단위 테스트할 수 있다.
 * 수집 함수의 버그는 대부분 여기서 나오므로 매핑 규칙은 전부 이 파일에 모아둔다.
 */
import type { RawClub, RawGame, RawPlayerRecord, RawTeamRank } from "./data-client.ts";
import type { NewsItem } from "./parsers/news.ts";
import type { LineupSide, MatchLineup } from "./parsers/lineup.ts";

/** 라인업 행이 어느 경기 것인지 가리키는 키 */
export interface MatchKey {
  year: number;
  leagueId: number;
  gameId: number;
}
import type { VideoItem } from "./parsers/video.ts";

/** K리그는 전 경기가 한국 시간이고 한국은 서머타임이 없으므로 고정 오프셋으로 충분하다. */
const KST = "+09:00";

export type MatchStatus = "scheduled" | "live" | "finished";

/** "" = 예정, "FE" = 종료. 그 외 코드는 진행 중으로 본다. */
export function toMatchStatus(gameStatus: string, endYn?: string): MatchStatus {
  if (gameStatus === "FE" || endYn === "Y") return "finished";
  if (!gameStatus.trim()) return "scheduled";
  return "live";
}

/** "2026.09.05" -> "2026-09-05" */
export function toIsoDate(dotted: string): string {
  const [y, m, d] = dotted.split(".");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** "2026.09.05" + "19:00" -> "2026-09-05T19:00:00+09:00" */
export function toKickoffAt(dotted: string, time: string): string {
  const hhmm = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "00:00";
  return `${toIsoDate(dotted)}T${hhmm}:00${KST}`;
}

/**
 * 예매 링크. 인터파크(I)만 경기별 딥링크가 나오고,
 * 티켓링크(T) 구단은 goodsCode 를 주지 않으므로 여기서는 null 을 돌려주고
 * 앱이 구단 고정 예매 URL 로 대체한다.
 */
export function toTicketUrl(company: string | null, goodsCode: string | null, externalUrl: string | null) {
  if (company === "I" && goodsCode) return `https://tickets.interpark.com/goods/${goodsCode}`;
  if (externalUrl) return externalUrl;
  return null;
}

export interface MatchRow {
  year: number;
  league_id: number;
  game_id: number;
  round_id: number;
  kickoff_at: string;
  match_date: string;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  home_goal: number | null;
  away_goal: number | null;
  status: MatchStatus;
  raw_status: string;
  field_name: string | null;
  field_name_full: string | null;
  audience_qty: number | null;
  broadcast: string | null;
  ticket_company: string | null;
  ticket_url: string | null;
  meet_name: string | null;
}

export function toMatchRow(g: RawGame): MatchRow {
  const status = toMatchStatus(g.gameStatus, g.endYn);
  // 미시작 경기도 homeGoal/awayGoal 이 0 으로 내려온다. 그대로 넣으면 0-0 으로 보이므로 비운다.
  const scored = status !== "scheduled";

  return {
    year: g.year,
    league_id: g.leagueId,
    game_id: g.gameId,
    round_id: g.roundId,
    kickoff_at: toKickoffAt(g.gameDate, g.gameTime),
    match_date: toIsoDate(g.gameDate),
    home_team_id: g.homeTeam,
    home_team_name: g.homeTeamName,
    away_team_id: g.awayTeam,
    away_team_name: g.awayTeamName,
    home_goal: scored ? g.homeGoal : null,
    away_goal: scored ? g.awayGoal : null,
    status,
    raw_status: g.gameStatus,
    field_name: g.fieldName || null,
    field_name_full: g.fieldNameFull || null,
    // 미시작 경기의 관중수 0 도 실측값이 아니라 기본값이다.
    audience_qty: status === "finished" && g.audienceQty ? g.audienceQty : null,
    broadcast: g.broadcastName || null,
    ticket_company: g.company || null,
    ticket_url: toTicketUrl(g.company, g.goodsCode, g.externalUrl),
    meet_name: g.meetName || null,
  };
}

/** 유튜브 채널 URL 에서 UC... 채널 ID 만 뽑는다. /c/, /user/ 형태는 ID 가 아니므로 버린다. */
export function toYoutubeChannelId(url: string | null | undefined): string | null {
  return url?.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/)?.[1] ?? null;
}

export interface ClubRow {
  team_id: string;
  name: string;
  name_short: string | null;
  homepage: string | null;
  youtube_channel_id: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  emblem_url: string;
}

export function toClubRow(c: RawClub): ClubRow {
  return {
    team_id: c.teamId,
    name: c.teamNameFull || c.teamName,
    name_short: c.teamNameShort || null,
    homepage: c.homepage || null,
    youtube_channel_id: toYoutubeChannelId(c.clubYoutube),
    youtube_url: c.clubYoutube || null,
    instagram_url: c.clubInstagram || null,
    facebook_url: c.clubFacebook || null,
    twitter_url: c.clubTwitter || null,
    emblem_url: `https://www.kleague.com/assets/images/emblem/emblem_${c.teamId}@3x.png`,
  };
}

export interface StandingRow {
  year: number;
  league_id: number;
  team_id: string;
  team_name: string;
  rank: number;
  points: number;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  /** 최근 6경기, 최신순. "승" | "무" | "패" */
  recent_form: string[];
}

export function toStandingRow(r: RawTeamRank): StandingRow {
  return {
    year: r.year,
    league_id: r.leagueId,
    team_id: r.teamId,
    team_name: r.teamName,
    rank: r.rank,
    points: r.gainPoint,
    played: r.gameCount,
    win: r.winCnt,
    draw: r.tieCnt,
    loss: r.lossCnt,
    goals_for: r.gainGoal,
    goals_against: r.lossGoal,
    goal_diff: r.gapCnt,
    recent_form: [r.game01, r.game02, r.game03, r.game04, r.game05, r.game06]
      .filter((g): g is string => !!g),
  };
}

export interface PlayerRow {
  year: number;
  team_id: string;
  name: string;
  back_no: number | null;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  fouls: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  photo_url: string | null;
}

export function toPlayerRow(p: RawPlayerRecord, year: number, teamId: string): PlayerRow {
  return {
    year,
    team_id: teamId,
    name: p.name,
    back_no: p.backNo,
    appearances: p.gameQty,
    goals: p.goalQty,
    assists: p.assistQty,
    shots: p.stQty,
    fouls: p.foQty,
    yellow_cards: p.warnQty,
    red_cards: p.exitQty,
    photo_url: p.img1 ? new URL(p.img1, "https://www.kleague.com").toString() : null,
  };
}

/** 소식은 목록에서 알 수 있는 것까지만 담는다. 본문은 받지 않는다 (collect-news) */
export interface NewsListRow {
  seq: number;
  category: string | null;
  club_tag: string | null;
  title: string;
  published_on: string | null;
  view_count: number | null;
}

/**
 * 목록 사진(item.thumbnail)은 담지 않는다. K리그 사진을 우리 버킷에 복제해 재배포하던
 * collect-news-thumbs 를 걷어내면서 주소도 버린다 — 남겨 두면 앱이 다시 걸게 된다.
 */
export function toNewsListRow(item: NewsItem): NewsListRow {
  return {
    seq: item.seq,
    category: item.category,
    club_tag: item.clubTag,
    title: item.title,
    published_on: item.publishedOn,
    view_count: item.viewCount,
  };
}

/**
 * 영상 제목에서 라운드를 뽑는다. "R29 대전 vs 포항..." / "...2026 29R 대전 vs 포항" 두 형태가 쓰인다.
 *
 * 경기(matches.round_id)와 영상을 잇는 유일한 단서다. 원본이 경기 ID 를 주지 않기 때문에
 * 제목 파싱 말고는 방법이 없다. 대신 수집 시점에 한 번만 파싱해서 컬럼으로 저장하고,
 * 앱은 컬럼으로 조회한다. 매번 클라이언트에서 정규식을 돌리지 않는다.
 */
export function toRoundId(title: string): number | null {
  const m = title.match(/(?:^|[\s|#([])R\s?(\d{1,2})(?=[\s가-힣]|$)/) ?? title.match(/(?:^|[\s|#([])(\d{1,2})R(?=[\s가-힣]|$)/)
  if (!m) return null
  const n = Number(m[1])
  // K리그1 정규 라운드는 1~38 범위를 벗어나지 않는다. 벗어나면 다른 숫자를 잘못 잡은 것.
  return n >= 1 && n <= 38 ? n : null
}

export interface VideoRow {
  seq: number
  round_id: number | null;
  category: string | null;
  title: string;
  published_on: string | null;
  view_count: number | null;
  youtube_id: string | null;
  thumbnail_url: string | null;
}

export function toVideoRow(v: VideoItem): VideoRow {
  return {
    seq: v.seq,
    round_id: toRoundId(v.title),
    category: v.category,
    title: v.title,
    published_on: v.publishedOn,
    view_count: v.viewCount,
    youtube_id: v.youtubeId,
    thumbnail_url: v.thumbnail,
  };
}

// ─────────────────────────────────────────── 라인업

export interface LineupRow {
  year: number;
  league_id: number;
  game_id: number;
  player_id: string;
  side: LineupSide;
  team_id: string;
  back_no: number | null;
  position: string | null;
  name: string;
  is_captain: boolean;
  is_starter: boolean;
  lineup_order: number;
  records: string[];
  substituted_at: number | null;
  substituted_with: string | null;
}

export interface CoachRow {
  year: number;
  league_id: number;
  game_id: number;
  side: LineupSide;
  name: string;
}

export function toLineupRows(lineup: MatchLineup, ref: MatchKey): LineupRow[] {
  return lineup.players.map((p) => ({
    year: ref.year,
    league_id: ref.leagueId,
    game_id: ref.gameId,
    player_id: p.playerId,
    side: p.side,
    team_id: p.teamId,
    back_no: p.backNo,
    position: p.position,
    name: p.name,
    is_captain: p.isCaptain,
    is_starter: p.isStarter,
    lineup_order: p.order,
    records: p.records,
    substituted_at: p.substitutedAt,
    substituted_with: p.substitutedWith,
  }));
}

export function toCoachRows(lineup: MatchLineup, ref: MatchKey): CoachRow[] {
  return (["home", "away"] as const)
    .map((side) => ({ side, name: lineup.coaches[side] }))
    // 감독이 비어 있는 경기가 있다. 빈 이름을 넣느니 행을 만들지 않는다
    .filter((c): c is { side: LineupSide; name: string } => Boolean(c.name))
    .map((c) => ({ year: ref.year, league_id: ref.leagueId, game_id: ref.gameId, side: c.side, name: c.name }));
}

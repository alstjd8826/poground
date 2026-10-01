import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type JobResult, upsertAll } from "../_shared/runner.ts";
import { POHANG } from "../_shared/kleague/data-client.ts";
import { belongsTo, fetchMatchLineup, type MatchRef } from "../_shared/kleague/match-client.ts";
import { type CoachRow, type LineupRow, toCoachRows, toLineupRows } from "../_shared/kleague/mappers.ts";

/**
 * 한 번에 여는 경기 수. match.do 는 한 장에 600KB 가 넘으므로 욕심내지 않는다.
 * 밀린 경기는 다음 실행에서 이어 받는다 — 크론이 한 시간마다 도니 하루면 다 따라잡는다.
 */
const BATCH = 5;

/**
 * 손으로 메울 때의 상한.
 *
 * 시즌 중간에 붙인 기능이라 지난 경기가 통째로 비어 있다. 크론 기본값으로는 며칠이 걸리므로
 * `?batch=40` 처럼 한 번에 몰아 받을 수 있게 열어 둔다. 상한을 두는 이유는 한 장이 600KB 라
 * 무한정 늘리면 함수 제한 시간에 걸리기 때문이다.
 */
const MAX_BATCH = 40;

function batchSizeFrom(req?: Request): number {
  if (!req) return BATCH;
  const raw = new URL(req.url).searchParams.get("batch");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return BATCH;
  return Math.min(Math.trunc(n), MAX_BATCH);
}

/**
 * 이미 라인업이 있어도 다시 받는 최근 경기 수.
 *
 * 라인업은 킥오프 전에 선발이 뜨고, 경기 중에 교체·경고가 붙고, 끝난 뒤 기록이 정정된다.
 * 그래서 "없는 것만 채우기" 로는 최신 경기가 반쪽짜리로 굳는다.
 */
const REFRESH_RECENT = 2;

interface MatchRowLite {
  year: number;
  league_id: number;
  game_id: number;
  home_team_id: string;
  away_team_id: string;
}

const toRef = (m: MatchRowLite): MatchRef => ({
  year: m.year,
  leagueId: m.league_id,
  gameId: m.game_id,
  homeTeamId: m.home_team_id,
  awayTeamId: m.away_team_id,
});

/**
 * 이미 라인업이 있는 경기 ID.
 *
 * PostgREST 는 한 번에 1000행까지만 준다. 한 경기가 40행이므로 25경기만 넘어가도 잘리고,
 * 잘린 뒤쪽 경기는 "아직 없다" 로 잘못 읽혀 매번 다시 받게 된다. 끝까지 넘겨 가며 읽는다.
 */
const PAGE = 1000;

async function collectedGameIds(db: SupabaseClient, gameIds: number[]): Promise<Set<number>> {
  const found = new Set<number>();
  for (let from = 0;; from += PAGE) {
    const { data, error } = await db
      .from("match_lineups")
      .select("game_id")
      .in("game_id", gameIds)
      .order("game_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`기존 라인업 조회 실패: ${error.message}`);
    const rows = data ?? [];
    for (const r of rows) found.add((r as { game_id: number }).game_id);
    if (rows.length < PAGE) return found;
  }
}

/**
 * 라인업을 받아올 경기를 고른다.
 *
 * 아직 안 치른 경기는 건너뛴다 — 그 페이지에는 라인업 자리가 비어 있어서
 * 받아봐야 0건이고, 괜히 요청만 늘어난다.
 */
export async function pickTargets(
  db: SupabaseClient,
  teamId = POHANG,
  batch = BATCH,
): Promise<MatchRef[]> {
  const { data: matches, error } = await db
    .from("matches")
    .select("year, league_id, game_id, home_team_id, away_team_id")
    .in("status", ["live", "finished"])
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("kickoff_at", { ascending: false });
  if (error) throw new Error(`경기 목록 조회 실패: ${error.message}`);

  const played = (matches ?? []) as MatchRowLite[];
  if (played.length === 0) return [];

  const collected = await collectedGameIds(db, played.map((m) => m.game_id));

  // 최신 몇 경기는 이미 있어도 다시 받고, 나머지는 빈 것만 채운다
  const recent = played.slice(0, REFRESH_RECENT);
  const missing = played.slice(REFRESH_RECENT).filter((m) => !collected.has(m.game_id));

  return [...recent, ...missing].slice(0, batch).map(toRef);
}

export async function runCollectLineups(db: SupabaseClient, req?: Request): Promise<JobResult> {
  const batch = batchSizeFrom(req);
  const targets = await pickTargets(db, POHANG, batch);

  const lineupRows: LineupRow[] = [];
  const coachRows: CoachRow[] = [];
  const skipped: number[] = [];
  const empty: number[] = [];

  for (const ref of targets) {
    const lineup = await fetchMatchLineup(ref);

    if (lineup.players.length === 0) {
      // 아직 라인업이 안 올라온 경기. 오류가 아니라 정상이다
      empty.push(ref.gameId);
      continue;
    }
    if (!belongsTo(lineup, ref)) {
      // meetSeq 가 어긋나면 남의 경기가 200 으로 온다. 들이지 않는다
      skipped.push(ref.gameId);
      continue;
    }

    lineupRows.push(...toLineupRows(lineup, ref));
    coachRows.push(...toCoachRows(lineup, ref));
  }

  const upserted = await upsertAll(db, "match_lineups", lineupRows, "year,league_id,game_id,player_id");
  await upsertAll(db, "match_coaches", coachRows, "year,league_id,game_id,side");

  return {
    fetched: targets.length,
    upserted,
    // skipped 가 0 이 아니면 meetSeq 전제가 깨진 것이다. 조용히 넘어가면 안 되는 신호다
    // batch 를 같이 돌려준다. 손으로 메울 때 값이 먹었는지 응답만 보고 알 수 있다
    detail: { batch, players: lineupRows.length, coaches: coachRows.length, empty, skipped },
  };
}

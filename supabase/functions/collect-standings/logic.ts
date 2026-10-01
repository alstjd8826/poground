import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type JobResult, upsertAll } from "../_shared/runner.ts";
import { fetchClubPlayers, fetchTeamRank, POHANG } from "../_shared/kleague/data-client.ts";
import { toPlayerRow, toStandingRow } from "../_shared/kleague/mappers.ts";

/** 순위와 스쿼드는 같은 주기로 움직여서 한 잡으로 묶는다. */
export async function runCollectStandings(db: SupabaseClient): Promise<JobResult> {
  const year = Number(Deno.env.get("SEASON_YEAR") ?? new Date().getUTCFullYear());
  const teamId = Deno.env.get("CLUB_TEAM_ID") ?? POHANG;

  const [ranks, players] = await Promise.all([
    fetchTeamRank(year),
    fetchClubPlayers(year, teamId),
  ]);

  if (ranks.length === 0) throw new Error(`순위가 0건입니다 (year=${year})`);

  const standingRows = ranks.map(toStandingRow);
  // 원본이 동명이인을 구분하지 못하므로 (year, team_id, name) 충돌을 미리 걸러낸다.
  const playerRows = [...new Map(
    players.map((p) => [p.name, toPlayerRow(p, year, teamId)]),
  ).values()];

  const upserted = await upsertAll(db, "standings", standingRows, "year,league_id,team_id") +
    await upsertAll(db, "players", playerRows, "year,team_id,name");

  return {
    fetched: standingRows.length + playerRows.length,
    upserted,
    detail: { year, teamId, standings: standingRows.length, players: playerRows.length },
  };
}

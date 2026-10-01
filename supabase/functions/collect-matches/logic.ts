import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type JobResult, upsertAll } from "../_shared/runner.ts";
import { fetchSchedule, POHANG } from "../_shared/kleague/data-client.ts";
import { type ClubRow, type MatchRow, toClubRow, toMatchRow } from "../_shared/kleague/mappers.ts";

/** K리그1 시즌은 2월 말 개막 ~ 12월 초 종료. 원본이 월 단위 응답이라 월을 돌며 모은다. */
export const SEASON_MONTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * 평시에는 이번 달 + 다음 달만 본다. 지난 경기는 이미 확정이라 다시 긁을 이유가 없고,
 * 다음 달을 포함해야 일정이 공개되는 시점을 놓치지 않는다.
 *
 * 라이브 중에는 이번 달만 본다. 1분마다 도는 호출이라 한 번에 받는 양이 곧 연맹 사이트에
 * 거는 부하다. 진행 중인 경기는 이번 달에 있다.
 */
export function targetMonths(full: boolean, now: Date, live = false): number[] {
  if (full) return SEASON_MONTHS;
  const kstMonth = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  if (live) return [kstMonth];
  return [...new Set([kstMonth, Math.min(kstMonth + 1, 12)])];
}

/**
 * 한 팀의 경기만 남긴다.
 *
 * 원본은 리그 전체를 한꺼번에 준다. 앱은 포항 경기만 읽으므로 나머지는 저장하지 않는다 —
 * 쓰지 않는 연맹 자료를 쌓아 두면 필요 이상으로 복제하는 셈이다. 라이브 창
 * (has_live_window)도 이 표만 보므로 저절로 포항 경기 때만 열린다.
 */
export function onlyTeam(matches: MatchRow[], teamId: string): MatchRow[] {
  return matches.filter((m) => m.home_team_id === teamId || m.away_team_id === teamId);
}

export interface Collected {
  matches: MatchRow[];
  clubs: ClubRow[];
}

/** 네트워크만 담당. DB 를 모르므로 따로 테스트할 수 있다. */
export async function collect(year: number, months: number[]): Promise<Collected> {
  const matches: MatchRow[] = [];
  const clubs = new Map<string, ClubRow>();

  for (const month of months) {
    const data = await fetchSchedule(year, month);
    for (const g of data.scheduleList ?? []) matches.push(toMatchRow(g));
    for (const c of data.clubList ?? []) clubs.set(c.teamId, toClubRow(c));
  }
  return { matches, clubs: [...clubs.values()] };
}

export async function runCollectMatches(db: SupabaseClient, req: Request): Promise<JobResult> {
  const params = new URL(req.url).searchParams;
  const full = params.get("full") === "1";
  const live = params.get("live") === "1";
  const year = Number(Deno.env.get("SEASON_YEAR") ?? new Date().getUTCFullYear());
  const months = targetMonths(full, new Date(), live);

  const { matches, clubs } = await collect(year, months);
  // 거르기 전에 센다. 포항 경기가 없는 달은 정상이지만, 리그 전체가 0건이면 파서가 깨진 것이다
  if (matches.length === 0) throw new Error(`경기가 0건입니다 (year=${year} months=${months})`);
  const ours = onlyTeam(matches, POHANG);

  const upserted = await upsertAll(db, "matches", ours, "year,league_id,game_id") +
    await upsertAll(db, "clubs", clubs, "team_id");

  return { fetched: matches.length, upserted, detail: { year, months, live, kept: ours.length, clubs: clubs.length } };
}

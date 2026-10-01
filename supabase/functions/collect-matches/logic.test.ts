import { assertEquals } from "jsr:@std/assert@1";
import { onlyTeam, targetMonths } from "./logic.ts";
import type { MatchRow } from "../_shared/kleague/mappers.ts";

// 2026-09-28 12:00 KST
const NOW = new Date("2026-09-28T03:00:00Z");

Deno.test("평시에는 이번 달과 다음 달을 본다", () => {
  assertEquals(targetMonths(false, NOW), [9, 10]);
});

// 라이브는 1분마다 돈다. 진행 중인 경기는 이번 달에 있으므로 다음 달까지 받을 이유가 없다
Deno.test("라이브 중에는 이번 달만 본다", () => {
  assertEquals(targetMonths(false, NOW, true), [9]);
});

Deno.test("전체 재확인은 시즌 전 달을 본다", () => {
  assertEquals(targetMonths(true, NOW).length, 11);
});

const row = (home: string, away: string): MatchRow => ({ home_team_id: home, away_team_id: away }) as MatchRow;

// 앱은 포항 경기만 읽는다. 쓰지 않는 다른 팀 경기를 쌓아 두면 연맹 자료를 필요 이상으로 복제하게 된다
Deno.test("포항이 홈이나 원정인 경기만 남긴다", () => {
  const rows = [row("K03", "K09"), row("K01", "K05"), row("K21", "K03")];
  assertEquals(onlyTeam(rows, "K03"), [rows[0], rows[2]]);
});

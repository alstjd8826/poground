import { assertEquals } from "jsr:@std/assert@1";
import { parseMatchLineup } from "./lineup.ts";

/** 2026 29R 대전 vs 포항 (gameId 172) 의 실제 응답에서 라인업 구간만 떼어낸 것 */
const html = await Deno.readTextFile(
  new URL("./__fixtures__/match-172.html", import.meta.url),
);
const { players, coaches } = parseMatchLineup(html);

Deno.test("양 팀 라인업을 모두 뽑는다", () => {
  assertEquals(players.length, 40);
  assertEquals(players.filter((p) => p.side === "home").length, 20);
  assertEquals(players.filter((p) => p.side === "away").length, 20);
});

Deno.test("등번호·포지션·팀·선수ID 를 채운다", () => {
  const gk = players.find((p) => p.name === "이창근")!;
  assertEquals(gk.side, "home");
  assertEquals(gk.teamId, "K10");
  assertEquals(gk.backNo, 1);
  assertEquals(gk.position, "GK");
  assertEquals(gk.playerId, "20120148");
});

Deno.test("주장 표기를 이름에서 떼어 따로 담는다", () => {
  const captains = players.filter((p) => p.isCaptain);
  assertEquals(captains.length, 2);
  // 이름에 "(c)" 가 남아 있으면 안 된다
  assertEquals(captains.every((p) => !p.name.includes("(")), true);
  assertEquals(captains.map((p) => p.name).sort(), ["전민광", "하창래"]);
});

Deno.test("팀별 앞 11명을 선발로, 나머지를 교체 명단으로 가른다", () => {
  for (const side of ["home", "away"] as const) {
    const ofSide = players.filter((p) => p.side === side);
    assertEquals(ofSide.filter((p) => p.isStarter).length, 11);
    assertEquals(ofSide.filter((p) => !p.isStarter).length, 9);
    // 순서는 0부터 빠짐없이 이어져야 한다. 문서 순서가 선발 판정의 유일한 근거다
    assertEquals(ofSide.map((p) => p.order), [...Array(20).keys()]);
  }
  // 선발 GK 는 각 팀의 첫 줄이다
  assertEquals(players.find((p) => p.side === "home" && p.order === 0)?.name, "이창근");
  assertEquals(players.find((p) => p.side === "away" && p.order === 0)?.name, "홍성민");
  // 벤치 첫 줄은 백업 GK
  assertEquals(players.find((p) => p.side === "home" && p.order === 11)?.name, "김민수");
});

Deno.test("선수별 기록 뱃지를 배열로 나눈다", () => {
  const p = players.find((x) => x.name === "이순민")!;
  assertEquals(p.records, ["파울", "경고", "유효슈팅", "교체"]);
  // 기록이 없는 선수는 빈 배열이어야 한다(undefined 아님)
  assertEquals(Array.isArray(players.find((x) => x.records.length === 0)?.records), true);
});

Deno.test("교체 시각과 상대 선수를 잇는다", () => {
  const out = players.find((p) => p.name === "박규현")!;
  assertEquals(out.substitutedAt, 45);
  assertEquals(out.substitutedWith, "이명재");
  // 교체되지 않은 선수는 null
  const gk = players.find((p) => p.name === "이창근")!;
  assertEquals(gk.substitutedAt, null);
});

Deno.test("양 팀 감독을 순서대로 잡는다", () => {
  assertEquals(coaches.home, "황선홍");
  assertEquals(coaches.away, "박태하");
});

Deno.test("빈 HTML 이어도 터지지 않는다", () => {
  const empty = parseMatchLineup("<html></html>");
  assertEquals(empty.players, []);
  assertEquals(empty.coaches, {});
});

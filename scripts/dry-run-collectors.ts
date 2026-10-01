/**
 * DB 없이 수집 로직만 실제 서버에 붙여 확인한다.
 *   deno task dry-run
 */
import { collect, targetMonths } from "../supabase/functions/collect-matches/logic.ts";
import { collectList } from "../supabase/functions/collect-news/logic.ts";
import { collectVideos } from "../supabase/functions/collect-videos/logic.ts";
import {
  fetchClubPlayers,
  fetchTeamRank,
  POHANG,
} from "../supabase/functions/_shared/kleague/data-client.ts";
import { toCoachRows, toLineupRows, toPlayerRow, toStandingRow } from "../supabase/functions/_shared/kleague/mappers.ts";
import { belongsTo, fetchMatchLineup } from "../supabase/functions/_shared/kleague/match-client.ts";

const YEAR = 2026;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed++;
};

console.log("\n[matches]");
const months = targetMonths(false, new Date());
const { matches, clubs } = await collect(YEAR, months);
check("경기 수집", matches.length > 0, `${months.join(",")}월 / ${matches.length}건`);
check("구단 12팀", clubs.length === 12, `${clubs.length}팀`);
check("포항 존재", clubs.some((c) => c.team_id === POHANG));
const scheduled = matches.filter((m) => m.status === "scheduled");
check("미시작 경기 스코어 비움", scheduled.every((m) => m.home_goal === null), `예정 ${scheduled.length}건`);
check("킥오프 KST", matches.every((m) => m.kickoff_at.endsWith("+09:00")));
const pohang = matches.filter((m) => m.home_team_id === POHANG || m.away_team_id === POHANG);
console.log(`        포항 ${pohang.length}경기`);
for (const m of pohang.slice(0, 3)) {
  const score = m.status === "scheduled" ? "vs" : `${m.home_goal}-${m.away_goal}`;
  console.log(
    `        ${m.kickoff_at.slice(0, 16)} ${m.home_team_name} ${score} ${m.away_team_name}  [${m.status}] ${
      m.ticket_company ?? "-"
    }`,
  );
}

console.log("\n[standings]");
const ranks = (await fetchTeamRank(YEAR)).map(toStandingRow);
check("순위 12팀", ranks.length === 12, `${ranks.length}팀`);
check("최근폼 존재", ranks.every((r) => r.recent_form.length > 0));
check("승점 = 승*3+무", ranks.every((r) => r.points === r.win * 3 + r.draw));
const p = ranks.find((r) => r.team_id === POHANG)!;
console.log(
  `        포항 ${p.rank}위 승점${p.points} ${p.win}승${p.draw}무${p.loss}패 폼[${p.recent_form.join("")}]`,
);

console.log("\n[players]");
const players = (await fetchClubPlayers(YEAR, POHANG)).map((x) => toPlayerRow(x, YEAR, POHANG));
check("스쿼드 수집", players.length > 20, `${players.length}명`);
check("이름 중복 없음", new Set(players.map((x) => x.name)).size === players.length);
const scorers = players.filter((x) => (x.goals ?? 0) > 0).sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0));
console.log(`        득점자 상위: ${scorers.slice(0, 4).map((s) => `${s.name}(${s.goals})`).join(" ")}`);

console.log("\n[news]");
const news = await collectList();
check("뉴스 수집", news.length > 20, `${news.length}건`);
check("제목 100%", news.every((n) => n.title.length > 0));
check("body 키 없음(본문 보존)", news.every((n) => !("body" in n)));
console.log(
  `        포항 태그 ${news.filter((n) => n.club_tag === "포항").length}건 / 카테고리 ${
    [...new Set(news.map((n) => n.category))].join(",")
  }`,
);

console.log("\n[videos]");
const videos = await collectVideos();
check("영상 수집", videos.length > 10, `${videos.length}건`);
check(
  "youtubeId 100%",
  videos.every((v) => v.youtube_id),
  `${videos.filter((v) => v.youtube_id).length}/${videos.length}`,
);
console.log(`        카테고리 ${[...new Set(videos.map((v) => v.category))].join(",")}`);

console.log("\n[lineups]");
// 끝난 포항 경기 중 가장 최근 것으로 확인한다. 라인업은 치른 경기에만 있다
const lastPlayed = pohang.filter((m) => m.status === "finished").at(-1);
if (!lastPlayed) {
  check("끝난 경기 없음(건너뜀)", true);
} else {
  const ref = {
    year: lastPlayed.year,
    leagueId: lastPlayed.league_id,
    gameId: lastPlayed.game_id,
    homeTeamId: lastPlayed.home_team_id,
    awayTeamId: lastPlayed.away_team_id,
  };
  const lineup = await fetchMatchLineup(ref);
  const rows = toLineupRows(lineup, ref);
  const coaches = toCoachRows(lineup, ref);
  const label = `${lastPlayed.home_team_name} vs ${lastPlayed.away_team_name} (${lastPlayed.game_id})`;

  check("라인업 수집", rows.length > 0, `${label} / ${rows.length}명`);
  // meetSeq 가 어긋나면 남의 경기가 200 으로 온다. 이 검사가 유일한 방어선이다
  check("요청한 경기가 맞다", belongsTo(lineup, ref));
  check("팀마다 선발 11명", ["home", "away"].every((s) => rows.filter((r) => r.side === s && r.is_starter).length === 11));
  check("선수ID 중복 없음", new Set(rows.map((r) => r.player_id)).size === rows.length);
  check("감독 양 팀", coaches.length === 2, coaches.map((c) => c.name).join(" / "));
  const subs = rows.filter((r) => r.substituted_at !== null);
  console.log(`        교체 ${subs.length}건 / 기록 뱃지 있는 선수 ${rows.filter((r) => r.records.length > 0).length}명`);
}

console.log(failed === 0 ? "\n전부 통과\n" : `\n${failed}건 실패\n`);
Deno.exit(failed === 0 ? 0 : 1);

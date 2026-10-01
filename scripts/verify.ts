/**
 * 실제 kleague.com 응답으로 파서를 검증한다.
 * 셀렉터가 깨지면 여기서 먼저 빨간불이 켜지도록 CI 에 물릴 것.
 *   deno task verify
 */
import { fetchNewsList, fetchVideoList } from "../supabase/functions/_shared/kleague/news-client.ts";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed++;
};
const ratio = (list: unknown[], pick: (x: never) => unknown) =>
  list.filter((x) => pick(x as never) != null && pick(x as never) !== "").length / (list.length || 1);

console.log("\n[1] 뉴스 목록  category=club, search=포항");
const news = await fetchNewsList({ category: "club", search: "포항" });
check("항목 파싱", news.length >= 10, `${news.length}건`);
check("제목 100%", ratio(news, (n: never) => (n as { title: string }).title) === 1);
check("날짜 100%", ratio(news, (n: never) => (n as { publishedOn: unknown }).publishedOn) === 1);
check("썸네일 100%", ratio(news, (n: never) => (n as { thumbnail: unknown }).thumbnail) === 1);
check("조회수 100%", ratio(news, (n: never) => (n as { viewCount: unknown }).viewCount) === 1);
check("clubTag 추출", news.some((n) => n.clubTag === "포항"));
for (const n of news.slice(0, 4)) {
  console.log(
    `        ${n.seq} ${n.publishedOn} [${n.category}] ${n.clubTag ?? "-"} | ${n.title.slice(0, 44)}`,
  );
}

console.log("\n[2] 영상 목록  searchWord=포항");
const videos = await fetchVideoList({ searchWord: "포항" });
check("항목 파싱", videos.length >= 10, `${videos.length}건`);
check("youtubeId 100%", ratio(videos, (v: never) => (v as { youtubeId: unknown }).youtubeId) === 1);
check("날짜 100%", ratio(videos, (v: never) => (v as { publishedOn: unknown }).publishedOn) === 1);
check("카테고리 유효", videos.every((v) => ["goal", "highlight", "club", "etc"].includes(v.category ?? "")));
for (const v of videos.slice(0, 4)) {
  console.log(`        ${v.seq} ${v.publishedOn} [${v.category}] ${v.youtubeId} | ${v.title.slice(0, 40)}`);
}

console.log("\n[3] 영상 카테고리 필터");
const goals = await fetchVideoList({ category: "goal", searchWord: "포항" });
check("goal 만 반환", goals.length > 0 && goals.every((v) => v.category === "goal"), `${goals.length}건`);

console.log("\n[4] 페이징");
const p1 = await fetchNewsList({ category: "club", page: 1 });
const p2 = await fetchNewsList({ category: "club", page: 2 });
const overlap = p1.filter((a) => p2.some((b) => b.seq === a.seq)).length;
check("1p/2p 중복 없음", overlap === 0, `겹침 ${overlap}건`);

console.log(failed === 0 ? "\n전부 통과\n" : `\n${failed}건 실패\n`);
Deno.exit(failed === 0 ? 0 : 1);

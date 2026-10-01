import { assertEquals } from "jsr:@std/assert@1";
import {
  toClubRow,
  toKickoffAt,
  toMatchRow,
  toMatchStatus,
  toNewsListRow,
  toRoundId,
  toStandingRow,
  toTicketUrl,
  toYoutubeChannelId,
} from "./mappers.ts";
import type { RawClub, RawGame, RawTeamRank } from "./data-client.ts";

const game = (over: Partial<RawGame> = {}): RawGame => ({
  year: 2026,
  leagueId: 1,
  gameId: 157,
  roundId: 27,
  gameDate: "2026.09.20",
  gameTime: "19:00",
  meetName: "하나은행 K리그1 2026",
  homeTeam: "K03",
  homeTeamName: "포항",
  awayTeam: "K09",
  awayTeamName: "서울",
  homeGoal: 0,
  awayGoal: 0,
  fieldName: "포항 스틸야드",
  fieldNameFull: "포항 스틸야드",
  audienceQty: 0,
  gameStatus: "",
  broadcastName: null,
  company: "T",
  goodsCode: null,
  externalUrl: null,
  endYn: "N",
  ...over,
});

Deno.test("경기 상태 - 빈 문자열은 예정, FE 는 종료", () => {
  assertEquals(toMatchStatus("", "N"), "scheduled");
  assertEquals(toMatchStatus("FE", "Y"), "finished");
  assertEquals(toMatchStatus("PL", "N"), "live");
  // endYn 만 Y 로 와도 종료로 본다
  assertEquals(toMatchStatus("", "Y"), "finished");
});

Deno.test("미시작 경기의 0-0 은 점수가 아니라 기본값이므로 비운다", () => {
  const row = toMatchRow(game());
  assertEquals(row.status, "scheduled");
  assertEquals(row.home_goal, null);
  assertEquals(row.away_goal, null);
  assertEquals(row.audience_qty, null);
});

Deno.test("종료 경기는 0-0 도 실제 스코어로 보존한다", () => {
  const row = toMatchRow(
    game({ gameStatus: "FE", endYn: "Y", homeGoal: 0, awayGoal: 0, audienceQty: 12345 }),
  );
  assertEquals(row.status, "finished");
  assertEquals(row.home_goal, 0);
  assertEquals(row.away_goal, 0);
  assertEquals(row.audience_qty, 12345);
});

Deno.test("킥오프는 KST 오프셋을 붙인다", () => {
  assertEquals(toKickoffAt("2026.09.20", "19:00"), "2026-09-20T19:00:00+09:00");
  assertEquals(toKickoffAt("2026.3.7", "16:30"), "2026-03-07T16:30:00+09:00");
  // 시간이 비어 있어도 날짜는 살린다
  assertEquals(toKickoffAt("2026.09.20", ""), "2026-09-20T00:00:00+09:00");
});

Deno.test("예매 링크 - 인터파크만 경기별 딥링크가 나온다", () => {
  assertEquals(toTicketUrl("I", "26002679", null), "https://tickets.interpark.com/goods/26002679");
  // 포항은 티켓링크(T)라 goodsCode 가 없다 -> 앱이 구단 고정 URL 로 대체
  assertEquals(toTicketUrl("T", null, null), null);
  assertEquals(toTicketUrl("E", null, "https://oqf.hanabank.com/x"), "https://oqf.hanabank.com/x");
});

Deno.test("유튜브 채널 ID 는 /channel/ 형태에서만 뽑는다", () => {
  assertEquals(
    toYoutubeChannelId("https://www.youtube.com/channel/UCOZQIw1I6ixjQZ_va_eCn7w"),
    "UCOZQIw1I6ixjQZ_va_eCn7w",
  );
  // /c/, /user/ 는 채널 ID 가 아니므로 버린다 (playlistItems 에 못 쓴다)
  assertEquals(toYoutubeChannelId("https://www.youtube.com/c/FCSEOUL"), null);
  assertEquals(toYoutubeChannelId("https://www.youtube.com/user/JEONBUKHYUNDAI"), null);
  assertEquals(toYoutubeChannelId(null), null);
});

Deno.test("구단 행 - 엠블럼 URL 을 team_id 로 조립한다", () => {
  const club: RawClub = {
    teamId: "K03",
    teamName: "포항 스틸러스",
    teamNameShort: "포항",
    teamNameFull: "포항 스틸러스",
    homepage: "https://www.steelers.co.kr",
    clubYoutube: "https://www.youtube.com/channel/UCOZQIw1I6ixjQZ_va_eCn7w",
    clubInstagram: "https://www.instagram.com/fc.pohangsteelers/",
    clubFacebook: null,
    clubTwitter: null,
  };
  const row = toClubRow(club);
  assertEquals(row.emblem_url, "https://www.kleague.com/assets/images/emblem/emblem_K03@3x.png");
  assertEquals(row.youtube_channel_id, "UCOZQIw1I6ixjQZ_va_eCn7w");
  assertEquals(row.name_short, "포항");
});

Deno.test("순위 행 - 최근 폼은 null 을 제거하고 순서를 유지한다", () => {
  const rank = {
    year: 2026,
    leagueId: 1,
    teamId: "K09",
    teamName: "서울",
    rank: 1,
    gainPoint: 62,
    winCnt: 19,
    tieCnt: 5,
    lossCnt: 5,
    gainGoal: 55,
    lossGoal: 23,
    gapCnt: 32,
    gameCount: 29,
    game01: "승",
    game02: "패",
    game03: "승",
    game04: null,
    game05: null,
    game06: null,
  } satisfies RawTeamRank;
  const row = toStandingRow(rank);
  assertEquals(row.recent_form, ["승", "패", "승"]);
  assertEquals(row.points, 62);
  assertEquals(row.goal_diff, 32);
});

Deno.test("영상 제목에서 라운드를 뽑는다", () => {
  // 실제 수집 데이터에 나타난 두 가지 표기
  assertEquals(toRoundId("R29 대전 vs 포항 이명재 88분 골"), 29);
  assertEquals(toRoundId("[30분 하이라이트] 하나은행 K리그1 2026 29R 대전 vs 포항 (2026-09-12)"), 29);
  assertEquals(toRoundId("앞으로 나아가자ㅣ포항스틸러스 R29 대전전 비하인드"), 29);
  assertEquals(toRoundId("[MATCHDAY CAM] 끝까지 함께 가자 | 2026 K리그1 27R #전북현대 vs 포항스틸러스"), 27);
  assertEquals(toRoundId("에어컨 파워 냉방으로 틀었음 | 골뒷캠 | FC서울 3-1 포항스틸러스 | K리그1 2026 R19 "), 19);
});

Deno.test("라운드가 없거나 엉뚱한 숫자는 잡지 않는다", () => {
  assertEquals(toRoundId("포항스틸러스 신년 인사"), null);
  // 연도(2026)를 라운드로 착각하면 안 된다
  assertEquals(toRoundId("하나은행 K리그1 2026 개막"), null);
  // 38 라운드를 넘는 값은 다른 숫자를 잘못 잡은 것
  assertEquals(toRoundId("R99 테스트"), null);
});

// 소식 목록에 K리그 사진을 걸지 않는다. 주소도 담지 않아야 앱이 다시 걸 일이 없다
Deno.test("소식 행에 썸네일 주소를 담지 않는다", () => {
  const row = toNewsListRow({
    seq: 96344,
    href: "/news_view.do?seq=96344",
    title: "[포항] 서울전",
    category: "club",
    publishedOn: "2026-09-17",
    viewCount: 10,
    thumbnail: "https://press.kleague.com/big.jpg",
    clubTag: "포항",
  });
  assertEquals("thumbnail_url" in row, false);
  assertEquals(row.title, "[포항] 서울전");
});

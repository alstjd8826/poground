/**
 * kleague.com 의 JSON 엔드포인트. 공식 공개 API 가 아니라 홈페이지가 쓰는 내부 엔드포인트다.
 * 인증은 없지만 언제든 바뀔 수 있으므로 반드시 서버에서만 호출하고 DB 에 적재해서 쓴다.
 */
const BASE = "https://www.kleague.com";

/** 뉴스 HTML 과 같은 이유로 언어를 고정한다. (news-client.ts 주석 참고) */
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SteelersFanApp/1.0)",
  "Content-Type": "application/json",
  "Accept-Language": "ko-KR,ko;q=0.9",
} as const;

export const KLEAGUE1 = 1;
export const POHANG = "K03";

interface Envelope<T> {
  resultCode: string;
  resultMsg: string;
  data: T;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  const json = await res.json() as Envelope<T>;
  // HTTP 200 에 resultCode 로 실패를 알려주는 방식이라 여기서 반드시 확인해야 한다.
  if (json.resultCode !== "200") throw new Error(`POST ${path} -> ${json.resultCode} ${json.resultMsg}`);
  return json.data;
}

// ─────────────────────────────── 원본 응답 타입 (필요한 필드만)

export interface RawGame {
  year: number;
  leagueId: number;
  gameId: number;
  roundId: number;
  gameDate: string; // "2026.09.05"
  gameTime: string; // "19:00"
  meetName: string;
  homeTeam: string;
  homeTeamName: string;
  awayTeam: string;
  awayTeamName: string;
  homeGoal: number;
  awayGoal: number;
  fieldName: string;
  fieldNameFull: string;
  audienceQty: number | null;
  gameStatus: string; // "" = 예정, "FE" = 종료
  broadcastName: string | null;
  company: string | null; // T=티켓링크, I=인터파크, E=기타(하나은행 등)
  goodsCode: string | null;
  externalUrl: string | null;
  endYn: string;
}

export interface RawClub {
  teamId: string;
  teamName: string;
  teamNameShort: string | null;
  teamNameFull: string | null;
  homepage: string | null;
  clubYoutube: string | null;
  clubInstagram: string | null;
  clubFacebook: string | null;
  clubTwitter: string | null;
}

export interface RawTeamRank {
  year: number;
  leagueId: number;
  teamId: string;
  teamName: string;
  rank: number;
  gainPoint: number;
  winCnt: number;
  tieCnt: number;
  lossCnt: number;
  gainGoal: number;
  lossGoal: number;
  gapCnt: number;
  gameCount: number;
  game01: string | null;
  game02: string | null;
  game03: string | null;
  game04: string | null;
  game05: string | null;
  game06: string | null;
}

export interface RawPlayerRecord {
  name: string;
  backNo: number | null;
  gameQty: number | null;
  goalQty: number | null;
  assistQty: number | null;
  stQty: number | null; // 슈팅
  foQty: number | null; // 파울
  warnQty: number | null; // 경고
  exitQty: number | null; // 퇴장
  img1: string | null;
}

// ─────────────────────────────── 호출

export function fetchSchedule(year: number, month: number, leagueId = KLEAGUE1) {
  return post<{ scheduleList: RawGame[] | null; clubList: RawClub[] | null }>("/getScheduleList.do", {
    leagueId: String(leagueId),
    year: String(year),
    month: String(month).padStart(2, "0"),
  });
}

export function fetchTeamRank(year: number, leagueId = KLEAGUE1) {
  return post<{ teamRank: RawTeamRank[] }>("/record/teamRank.do", {
    leagueId: String(leagueId),
    year: String(year),
    stadium: "all",
  }).then((d) => d.teamRank);
}

/**
 * 구단별 선수 기록. record/rankSort.do 는 teamId 를 무시하고 리그 전체를 주므로
 * 구단 스쿼드가 필요하면 반드시 이 엔드포인트를 쓴다.
 */
export function fetchClubPlayers(year: number, teamId = POHANG, leagueId = KLEAGUE1) {
  return post<{ list: RawPlayerRecord[] }>("/record/selectPersonalRecordByClub.do", {
    leagueId: String(leagueId),
    year: String(year),
    teamId,
  }).then((d) => d.list);
}

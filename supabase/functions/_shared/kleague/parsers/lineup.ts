import { decodeEntities, text } from "./html.ts";

/**
 * 경기 상세(match.do)에서 라인업과 선수별 기록을 뽑는다.
 *
 * 왜 HTML 파싱인가:
 *   같은 페이지의 /api/ddf/match/* 엔드포인트들(matchRecord, possession, matchInfo)은
 *   실제 gameId 로 불러도 빈 객체만 준다 — 로그인이 필요한 것으로 보인다.
 *   반면 라인업과 선수별 기록은 서버에서 렌더돼 HTML 에 그대로 박혀 있다.
 *
 * 그래서 이 파서로 얻는 것과 못 얻는 것이 갈린다:
 *   얻음   라인업(등번호·포지션·이름·선수ID·주장), 교체 시각, 선수별 기록 뱃지
 *   못 얻음 팀 합계(점유율·슈팅 수·코너킥 등)
 */

export type LineupSide = "home" | "away";

export interface LineupPlayer {
  side: LineupSide;
  teamId: string;
  playerId: string;
  /** 등번호. 감독 행 등에서는 비어 있을 수 있다 */
  backNo: number | null;
  /** GK / DF / MF / FW */
  position: string | null;
  name: string;
  /** 이름 뒤 "(c)" 표기 */
  isCaptain: boolean;
  /**
   * 선발 여부.
   *
   * 페이지에 선발/벤치를 가르는 표시가 **없다.** 팀마다 선발 11명을 먼저 렌더하고
   * 교체 명단을 뒤에 붙이는 문서 순서가 유일한 단서라, 팀별 앞 11명을 선발로 본다.
   * 구조가 바뀌면 여기부터 깨지므로 테스트로 순서를 붙들어 둔다.
   */
  isStarter: boolean;
  /** 팀 안에서의 등장 순서(0부터). 화면이 원본 배열 순서를 그대로 쓸 수 있게 남긴다 */
  order: number;
  /** 페이지가 주는 기록 뱃지. 예: ["파울", "경고", "유효슈팅", "교체"] */
  records: string[];
  /** 교체 시각(분). 교체된 선수만 값이 있다 */
  substitutedAt: number | null;
  /** 교체로 들어온/나간 상대 선수 이름 */
  substitutedWith: string | null;
}

export interface MatchLineup {
  players: LineupPlayer[];
  /** 감독. side -> 이름 */
  coaches: Partial<Record<LineupSide, string>>;
}

/** <tr onclick="playerDetailPop('K03','20240277')"> 29 / GK / 홍성민 ... class="away-lineup" */
const PLAYER_ROW =
  /<tr onclick="playerDetailPop\('(\w+)',\s*'(\d+)'\)">\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>\s*([\s\S]*?)\s*<\/td>\s*<td class="(home|away)-lineup/g;

/** playerIco('home', '파울|경고|유효슈팅', '20170097', 'mf', '') */
const PLAYER_ICO = /playerIco\('(\w+)',\s*'([^']*)',\s*'(\d+)',\s*'(\w*)',\s*'([^']*)'\)/g;

/** <p class="hidden changeM_20190357">45</p> 교체 시각, changeP_ 는 상대 선수 이름 */
const CHANGE_MIN = /class="hidden changeM_(\d+)"\s*>([^<]*)</g;
const CHANGE_PLAYER = /class="hidden changeP_(\d+)"\s*>([^<]*)</g;

const CAPTAIN = /\((?:c|C)\)\s*$/;

export function parseMatchLineup(html: string): MatchLineup {
  const flat = html.replace(/\s+/g, " ");

  // 선수ID -> 기록 뱃지
  const records = new Map<string, string[]>();
  for (const m of flat.matchAll(PLAYER_ICO)) {
    const raw = m[2]?.trim();
    if (raw) records.set(m[3]!, raw.split("|").map((s) => s.trim()).filter(Boolean));
  }

  const subMin = new Map<string, number>();
  for (const m of flat.matchAll(CHANGE_MIN)) {
    const v = Number(m[2]?.trim());
    if (Number.isFinite(v) && v > 0) subMin.set(m[1]!, v);
  }
  const subWith = new Map<string, string>();
  for (const m of flat.matchAll(CHANGE_PLAYER)) {
    const v = decodeEntities(m[2] ?? "").trim();
    if (v) subWith.set(m[1]!, v);
  }

  /** 팀별 등장 순서. 선발/벤치를 가르는 유일한 근거다 */
  const seen: Record<LineupSide, number> = { home: 0, away: 0 };
  const STARTERS = 11;

  const players: LineupPlayer[] = [];
  for (const m of flat.matchAll(PLAYER_ROW)) {
    const [, teamId, playerId, noRaw, posRaw, nameRaw, side] = m;
    const name = text(nameRaw ?? "");
    if (!name) continue;

    const order = seen[side as LineupSide]++;

    players.push({
      side: side as LineupSide,
      teamId: teamId!,
      playerId: playerId!,
      backNo: Number.isFinite(Number(noRaw)) && noRaw!.trim() !== "" ? Number(noRaw) : null,
      position: text(posRaw ?? "") || null,
      name: name.replace(CAPTAIN, "").trim(),
      isCaptain: CAPTAIN.test(name),
      isStarter: order < STARTERS,
      order,
      records: records.get(playerId!) ?? [],
      substitutedAt: subMin.get(playerId!) ?? null,
      substitutedWith: subWith.get(playerId!) ?? null,
    });
  }

  // 감독 행은 등번호가 "-" 이고 포지션이 "감독" 이라 선수 행과 형태가 다르다
  const coaches: Partial<Record<LineupSide, string>> = {};
  const coachRows = [...flat.matchAll(/<td>-<\/td> <td>감독<\/td> <td>([^<]+)<\/td>/g)];
  // 홈이 먼저, 원정이 나중에 렌더된다
  if (coachRows[0]) coaches.home = decodeEntities(coachRows[0][1]!).trim();
  if (coachRows[1]) coaches.away = decodeEntities(coachRows[1][1]!).trim();

  return { players, coaches };
}

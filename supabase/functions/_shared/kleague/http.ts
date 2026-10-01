/** kleague.com 의 HTML 페이지를 가져오는 공통 창구. */

const BASE = "https://www.kleague.com";
const UA = "Mozilla/5.0 (compatible; SteelersFanApp/1.0)";

/**
 * Accept-Language 를 반드시 한국어로 고정해야 한다.
 * 서버가 ko 가 아니라고 판단하면 영문 뉴스 DB 로 붙는데, 그쪽은 2018년에 갱신이 멈췄다.
 * 에러 없이 200 으로 8년 전 기사를 돌려주므로 빠뜨리면 조용히 썩은 데이터가 들어온다.
 * (Deno/undici fetch 는 기본값이 `accept-language: *` 라 그냥 두면 영문으로 샌다.)
 */
export const HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html",
  "Accept-Language": "ko-KR,ko;q=0.9",
} as const;

export async function getHtml(path: string, params: Record<string, string>): Promise<string> {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url.pathname} -> ${res.status}`);
  return res.text();
}

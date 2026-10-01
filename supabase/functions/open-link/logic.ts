/**
 * 메일의 https 링크를 앱 주소로 넘긴다 (2026-09-29).
 *
 * Gmail 은 https 가 아닌 주소(poground://)를 링크로 만들지 않아, 신고 메일의 "앱에서 열기" 를 누를 수 없었다.
 * 메일에는 이 함수의 https 주소를 싣고, 여기서 값을 확인해 poground://comment?type=&id= 로 돌려보낸다(302).
 *
 * 아무 주소로나 보내는 전달자가 되지 않게, 가는 곳은 우리 앱 주소 하나뿐이고 값은 모양을 엄격히 본다.
 * 모양은 앱의 navigation/deepLink.ts 가 읽는 것과 같아야 한다.
 */
const TYPES = new Set(["match", "player", "news", "post"]);
const ID = /^[A-Za-z0-9-]{1,64}$/;

export function appTarget(url: URL): string | null {
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if (!type || !TYPES.has(type) || !id || !ID.test(id)) return null;
  return `poground://comment?type=${type}&id=${encodeURIComponent(id)}`;
}

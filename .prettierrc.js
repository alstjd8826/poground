/**
 * 포맷 규칙.
 *
 * gguge-uncle-app 과 같은 도구를 쓰되 두 값만 이 리포에 맞춘다. 그쪽 값을 그대로
 * 가져오면 118개 중 102개 파일, 4,500줄이 갈린다 — 규칙을 세우는 게 아니라 코드를
 * 통째로 갈아엎는 셈이다.
 *
 * printWidth: 80 이 아니라 110.
 *   여기는 처음부터 넓게 썼다(99%가 124자). 게다가 프리티어는 **한글을 두 칸으로**
 *   세기 때문에, 주석을 한글로 문단처럼 다는 이 리포에서 80은 체감 60자쯤이다.
 *   그 폭에 맞추면 설명 주석이 죄다 토막 난다.
 *
 * arrowParens: 'always' 가 아니라 'avoid'.
 *   여기는 전부 `key => ...` 로 쓴다. 바꾸면 화살표 함수가 나오는 자리마다 갈린다.
 *
 * 나머지(semi·singleQuote·trailingComma·tabWidth)는 uncle-app 과 같다.
 */
module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  useTabs: false,
  tabWidth: 2,
  printWidth: 110,
  arrowParens: 'avoid',
}

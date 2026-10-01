import { type Match, opponentOf } from '@/models/kleague'

/**
 * 게시글 태그.
 *
 * 직관 글은 따로 켜는 칸이 없다. 본문에 #직관 이 있으면 직관 글이다. 경기를 고르면 본문에 경기
 * 태그(#9월20일서울전)가 들어가고, 저장할 때 그 태그로 어느 경기인지 찾는다 (2026-09-29 결정).
 * 쓰는 사람이 태그를 지우면 경기 연결도 풀린다 — 본문이 곧 설정이다.
 */

export const ATTENDANCE_TAG = '#직관'

/**
 * 서버에서 #직관 글을 가르는 정규식(Postgres). 태그는 # 부터 빈칸이나 다음 # 앞까지라(tagsOf) #직관러 는
 * 직관 글이 아니다 — ilike '%#직관%' 로는 이것까지 걸린다.
 */
export const ATTENDANCE_TAG_PATTERN = `${ATTENDANCE_TAG}([[:space:]#]|$)`

/** 본문을 태그 단위로 쪼갠다. 태그는 # 부터 빈칸 앞까지 */
function tagsOf(body: string): string[] {
  return body.match(/#[^\s#]+/g) ?? []
}

export function hasAttendanceTag(body: string): boolean {
  return tagsOf(body).includes(ATTENDANCE_TAG)
}

/** 포항은 하루에 한 경기만 하므로 월·일·상대면 시즌 안에서 겹치지 않는다 */
export function matchTag(match: Match): string {
  const d = new Date(match.kickoffAtMs)
  const opponent = opponentOf(match).name.replace(/\s+/g, '')
  return `#${d.getMonth() + 1}월${d.getDate()}일${opponent}전`
}

/** 본문의 경기 태그로 경기를 찾는다. 여럿이면 앞의 것 */
export function matchFromBody(body: string, matches: Match[]): Match | null {
  const tags = tagsOf(body)
  for (const tag of tags) {
    const found = matches.find(m => matchTag(m) === tag)
    if (found) return found
  }
  return null
}

/**
 * 경기를 고르거나 푼다. 본문에 있던 경기 태그는 빼고, 고른 경기가 있으면 #직관(없을 때만)과
 * 그 경기 태그를 본문 아래 새 줄에 붙인다. 쓰던 글과 다른 태그는 건드리지 않는다.
 */
export function withMatchTag(body: string, match: Match | null, matches: Match[]): string {
  const known = new Set(matches.map(matchTag))
  const kept = body
    .split(/(\s+)/)
    .filter(part => !known.has(part))
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  if (!match) return kept
  const add = [...(hasAttendanceTag(kept) ? [] : [ATTENDANCE_TAG]), matchTag(match)].join(' ')
  if (!kept) return add
  // 태그는 본문 아래 새 줄에 둔다. 마지막 줄이 이미 태그뿐이면 그 줄에 잇는다 (2026-09-29)
  const lastLine = kept.split('\n').pop() ?? ''
  const tagsOnly = lastLine.split(/\s+/).every(word => word.startsWith('#'))
  return `${kept}${tagsOnly ? ' ' : '\n'}${add}`
}

/**
 * 본문이 태그뿐이면 태그를 둘째 줄로 내리고 커서를 맨 앞 빈 줄에 둔다 (2026-09-29).
 *
 * 직관 글 쓰기로 들어오거나 경기 칩을 먼저 고르면 본문이 `#직관 #9월20일서울전` 뿐이다. 그대로 두면
 * 입력칸을 눌렀을 때 커서가 태그 뒤에 서서, 글을 태그 앞에 쓰려면 맨 앞을 짚어야 했다. 글이 이미 있으면
 * 건드리지 않는다.
 */
export function roomBeforeTags(body: string): { body: string; cursor: number } | null {
  if (!body || body.startsWith('\n')) return null
  const words = body.trim().split(/\s+/)
  if (words.length === 0 || !words.every(w => w.startsWith('#'))) return null
  return { body: `\n${body.trim()}`, cursor: 0 }
}

/**
 * 언급(@아이디). 답글은 앞에 상대 아이디를 달고, 본문 속 @아이디 는 색을 달리한다 (2026-09-29).
 *
 * 아이디 모양은 utils/handle 의 규칙과 같다 — 소문자로 시작, 소문자·숫자·밑줄, 3~20자, 끝은 밑줄이 아님.
 * 앞이 글자·숫자면 언급이 아니다(메일 주소 mail@steel.com 의 @steel 을 잡지 않는다).
 */

const HANDLE = '[a-z][a-z0-9_]{1,18}[a-z0-9]'
const MENTION = new RegExp(`(^|[^A-Za-z0-9_.])(@${HANDLE})(?![A-Za-z0-9_])`, 'g')
const LEADING = new RegExp(`^@${HANDLE}\\s*`)

export interface TextPart {
  text: string
  mention: boolean
}

export function splitMentions(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(MENTION)) {
    const start = m.index! + m[1]!.length
    if (start > last) parts.push({ text: text.slice(last, start), mention: false })
    parts.push({ text: m[2]!, mention: true })
    last = start + m[2]!.length
  }
  if (last < text.length) parts.push({ text: text.slice(last), mention: false })
  return parts.length > 0 ? parts : [{ text, mention: false }]
}

/**
 * 답글 대상이 바뀔 때 입력의 맨 앞 언급을 맞춘다.
 *
 * `auto` 는 앞서 우리가 자동으로 붙인 아이디다. 그것만 떼고 바꾼다 — 사람이 손으로 쓴 언급은 그대로
 * 둔다. 대상이 없으면(답글을 풀면) 자동 언급만 뗀다.
 */
export function replyMention(body: string, handle: string | null, auto: string | null): string {
  let rest = body
  if (auto && rest.startsWith(`@${auto}`)) rest = rest.replace(LEADING, '')
  if (!handle) return rest
  if (rest.startsWith(`@${handle}`)) return rest
  return `@${handle} ${rest}`
}

/** 치는 중인 언급. `start` 는 @ 의 자리, `query` 는 그 뒤 글자(소문자) */
export interface ActiveMention {
  query: string
  start: number
}

/**
 * 커서 바로 앞이 `@글자` 면 그것을 준다. 후보를 띄울지 정한다 (2026-09-29).
 *
 * @ 만 쳤을 때는 아직 찾지 않는다 — 모든 사람을 늘어놓을 수는 없다. 빈칸을 치면 언급이 끝난다.
 * 앞이 글자·숫자면(mail@st) 언급이 아니다. 대문자는 소문자로 본다(아이디는 소문자뿐이다).
 */
export function activeMention(text: string, cursor: number): ActiveMention | null {
  const before = text.slice(0, cursor)
  const m = before.match(/(^|[^A-Za-z0-9_.])@([A-Za-z0-9_]{1,20})$/)
  if (!m) return null
  return { query: m[2]!.toLowerCase(), start: before.length - m[2]!.length - 1 }
}

/** 고른 아이디로 치던 조각을 바꾼다. 뒤에 빈칸을 두고 커서를 그 뒤로 옮긴다 */
export function pickMention(
  text: string,
  active: ActiveMention,
  cursor: number,
  handle: string,
): { text: string; cursor: number } {
  const inserted = `@${handle} `
  const next = text.slice(0, active.start) + inserted + text.slice(cursor)
  return { text: next, cursor: active.start + inserted.length }
}

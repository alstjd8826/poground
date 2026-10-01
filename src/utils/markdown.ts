/**
 * 앱 안에서 읽는 문서(개인정보 처리방침)의 마크다운을 덩어리로 가른다 (2026-09-30).
 *
 * 그 문서가 쓰는 것만 다룬다 — 제목(# ## ###), 문단, 목록(- ), 표, 구분선(---), 굵게(**). 라이브러리를
 * 들이지 않는다. 문서 하나를 위해 렌더러를 통째로 싣는 것보다 가볍고, 무엇을 그리는지 여기서 다 보인다.
 */

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'item'; text: string }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'rule' }

const cellsOf = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(c => c.trim())

const isDivider = (line: string) => /^\|?\s*:?-{3,}/.test(line.trim())

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    const trimmed = line.trim()
    if (trimmed === '') {
      i += 1
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1]!.length as 1 | 2 | 3, text: heading[2]!.trim() })
      i += 1
      continue
    }
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: 'rule' })
      i += 1
      continue
    }
    if (trimmed.startsWith('|')) {
      const header = cellsOf(trimmed)
      const rows: string[][] = []
      i += 1
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        if (!isDivider(lines[i]!)) rows.push(cellsOf(lines[i]!))
        i += 1
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }
    if (trimmed.startsWith('- ')) {
      // 항목의 접힌 줄은 들여쓰기로 이어진다
      const parts = [trimmed.slice(2).trim()]
      i += 1
      while (i < lines.length && /^\s+\S/.test(lines[i]!) && !lines[i]!.trim().startsWith('- ')) {
        parts.push(lines[i]!.trim())
        i += 1
      }
      blocks.push({ type: 'item', text: parts.join(' ') })
      continue
    }
    // 문단 — 빈 줄이나 다른 덩어리가 나올 때까지 잇는다
    const parts = [trimmed]
    i += 1
    while (i < lines.length) {
      const next = lines[i]!.trim()
      if (next === '' || /^(#{1,3}\s|-{3,}$|- |\|)/.test(next)) break
      parts.push(next)
      i += 1
    }
    blocks.push({ type: 'paragraph', text: parts.join(' ') })
  }
  return blocks
}

/** 한 줄 안의 **굵게** 를 조각으로 */
export function inlineParts(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(part => part.length > 0)
    .map(part =>
      part.startsWith('**') && part.endsWith('**')
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    )
}

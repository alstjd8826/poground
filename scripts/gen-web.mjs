// docs/privacy.md · docs/terms.md 를 web/ 의 정적 페이지로 옮긴다 (2026-11-09).
//
// 원본은 md 하나다. 앱 안의 방침(src/content/privacy.ts, `npm run legal`)과 약관(src/content/terms.ts,
// 테스트가 docs/terms.md 와 맞춰 봄)이 같은 md 를 보므로, 웹도 여기서 만들면 셋이 어긋나지 않는다.
// 방침·약관을 고치면 `npm run web` 으로 다시 만들고 web/ 을 배포한다.
//
// md 는 이 레포가 쓰는 만큼만 옮긴다: 제목(#, ##, ###), 문단, 목록(-), 표, 굵게, `코드`, 링크, 구분선.
// 인용(>)은 레포 안 메모라 웹에 싣지 않는다.
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const read = p => readFileSync(new URL(p, root), 'utf8')

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>')
}

const cells = line =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(c => c.trim())

export function mdToHtml(md) {
  const out = []
  const lines = md.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (line.startsWith('>')) {
      while (i < lines.length && lines[i].startsWith('>')) i++
      continue
    }
    const h = /^(#{1,3}) (.*)$/.exec(line)
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
      i++
      continue
    }
    if (/^---+\s*$/.test(line)) {
      i++
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++])
      const [head, , ...body] = rows
      out.push('<table>')
      out.push(`<tr>${cells(head).map(c => `<th>${inline(c)}</th>`).join('')}</tr>`)
      for (const r of body) out.push(`<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`)
      out.push('</table>')
      continue
    }
    if (/^- /.test(line)) {
      const items = []
      while (i < lines.length && /^(- |  \S)/.test(lines[i])) {
        if (lines[i].startsWith('- ')) items.push(lines[i].slice(2))
        else items[items.length - 1] += ' ' + lines[i].trim()
        i++
      }
      out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`)
      continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !/^(#|>|\||- |---)/.test(lines[i])) para.push(lines[i++].trim())
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  return out.join('\n')
}

const NAV =
  '<nav><a href="/">포그라운드</a><a href="/terms">이용약관</a><a href="/privacy">개인정보 처리방침</a><a href="/delete-account">계정 삭제</a></nav>'

const page = (title, body) =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/style.css"></head>
<body><main>${NAV}
<!-- 자동으로 만든 파일이다. 고치지 말고 docs/*.md 를 고친 뒤 \`npm run web\` 을 돌린다. -->
${body}
</main></body></html>
`

const write = (name, html) => writeFileSync(new URL(`web/${name}`, root), html)

write('privacy.html', page('개인정보 처리방침 · 포그라운드', mdToHtml(read('docs/privacy.md'))))
write('terms.html', page('이용약관 · 포그라운드', mdToHtml(read('docs/terms.md'))))
console.log('web/privacy.html, web/terms.html 을 새로 썼습니다')

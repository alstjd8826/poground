// docs/privacy.md 를 앱이 읽는 src/content/privacy.ts 로 옮긴다 (2026-09-30).
//
// 원본은 docs/privacy.md 하나다. 방침을 고치면 `npm run legal` 로 다시 싣는다 — 테스트(legal-markdown)가 둘이
// 다르면 실패한다. Metro 는 .md 를 불러오지 못해서 글을 TS 문자열로 싣는다.
import { readFileSync, writeFileSync } from 'node:fs'

const md = readFileSync(new URL('../docs/privacy.md', import.meta.url), 'utf8')
const out = `// 자동으로 만든 파일이다. 고치지 말고 docs/privacy.md 를 고친 뒤 \`npm run legal\` 을 돌린다.
export const PRIVACY_MD = ${JSON.stringify(md)}
`
writeFileSync(new URL('../src/content/privacy.ts', import.meta.url), out)
console.log('src/content/privacy.ts 를 새로 썼습니다')

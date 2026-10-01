import { readFileSync } from 'fs'
import { join } from 'path'

import { inlineParts, parseMarkdown } from '@/utils/markdown'
import { PRIVACY_MD } from '@/content/privacy'

/**
 * 개인정보 처리방침을 앱 안에서도 읽는다 (2026-09-30). 원본은 docs/privacy.md 하나이고, 앱은 그 글을 그대로
 * 싣는다. 그리는 것은 그 문서가 쓰는 만큼 — 제목·문단·목록·표·굵게·구분선
 */

describe('마크다운 읽기', () => {
  it('제목 세 단과 구분선', () => {
    expect(parseMarkdown('# 가\n\n## 나\n\n### 다\n\n---')).toEqual([
      { type: 'heading', level: 1, text: '가' },
      { type: 'heading', level: 2, text: '나' },
      { type: 'heading', level: 3, text: '다' },
      { type: 'rule' },
    ])
  })

  it('줄바꿈으로 접힌 문단은 한 문단으로 잇는다', () => {
    expect(parseMarkdown('첫 줄이\n이어진다.\n\n다음 문단')).toEqual([
      { type: 'paragraph', text: '첫 줄이 이어진다.' },
      { type: 'paragraph', text: '다음 문단' },
    ])
  })

  it('목록은 항목마다, 접힌 줄은 그 항목에 잇는다', () => {
    expect(parseMarkdown('- 하나\n  이어짐\n- 둘')).toEqual([
      { type: 'item', text: '하나 이어짐' },
      { type: 'item', text: '둘' },
    ])
  })

  it('표는 머리 줄과 나머지 줄로, 구분 줄은 버린다', () => {
    expect(
      parseMarkdown('| 항목 | 비고 |\n| --- | --- |\n| 닉네임 | 공개 |\n| 팬카드 | **본인만** |'),
    ).toEqual([
      {
        type: 'table',
        header: ['항목', '비고'],
        rows: [
          ['닉네임', '공개'],
          ['팬카드', '**본인만**'],
        ],
      },
    ])
  })

  it('굵게는 조각으로 가른다', () => {
    expect(inlineParts('나만 보기면 **본인만** 봅니다')).toEqual([
      { text: '나만 보기면 ', bold: false },
      { text: '본인만', bold: true },
      { text: ' 봅니다', bold: false },
    ])
  })
})

it('앱에 실린 방침은 docs/privacy.md 와 같다 — 다르면 npm run legal 로 다시 싣는다', () => {
  const doc = readFileSync(join(__dirname, '..', 'docs', 'privacy.md'), 'utf8')
  expect(PRIVACY_MD).toBe(doc)
})

it('방침 전체를 읽을 수 있다 — 표와 제목이 빠지지 않는다', () => {
  const blocks = parseMarkdown(PRIVACY_MD)
  expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: '포그라운드 개인정보처리방침' })
  expect(blocks.filter(b => b.type === 'table').length).toBeGreaterThanOrEqual(4)
  expect(blocks.some(b => b.type === 'heading' && b.text.startsWith('5.'))).toBe(true)
})

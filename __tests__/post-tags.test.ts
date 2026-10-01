import { hasAttendanceTag, matchFromBody, matchTag, roomBeforeTags, withMatchTag } from '@/models/postTags'
import type { Match } from '@/models/kleague'
import { mockMatchFinished } from '@/utils/fixtures'

/**
 * 직관 글은 본문의 #직관 으로 가른다. 경기는 고르면 본문에 경기 태그로 들어가고, 저장할 때
 * 그 태그로 어느 경기인지 찾는다 (2026-09-29 결정).
 */

// 픽스처 경기는 대전 2:2 포항. 날짜를 바꾼 사본을 하나 더 둔다
const other: Match = {
  ...mockMatchFinished,
  id: mockMatchFinished.id + 1,
  kickoffAtMs: mockMatchFinished.kickoffAtMs + 7 * 24 * 3600 * 1000,
}
const matches = [mockMatchFinished, other]

describe('#직관', () => {
  it('본문에 #직관 이 있으면 직관 글이다', () => {
    expect(hasAttendanceTag('오늘 #직관 다녀옴')).toBe(true)
    expect(hasAttendanceTag('#직관')).toBe(true)
  })

  it('#직관 이 없거나 다른 말에 붙어 있으면 아니다', () => {
    expect(hasAttendanceTag('직관 다녀옴')).toBe(false)
    expect(hasAttendanceTag('#직관러')).toBe(false)
  })
})

describe('경기 태그', () => {
  it('월·일·상대로 만들고 띄어쓰기가 없다', () => {
    const d = new Date(mockMatchFinished.kickoffAtMs)
    expect(matchTag(mockMatchFinished)).toBe(`#${d.getMonth() + 1}월${d.getDate()}일대전전`)
  })

  it('본문의 경기 태그로 경기를 찾는다', () => {
    expect(matchFromBody(`좋았다 ${matchTag(other)}`, matches)?.id).toBe(other.id)
  })

  it('경기 태그가 없으면 경기도 없다', () => {
    expect(matchFromBody('#직관 좋았다', matches)).toBeNull()
  })
})

describe('경기 고르기', () => {
  /** 태그는 본문 아래 새 줄에 붙인다 (2026-09-29) */
  it('고르면 본문 아래 새 줄에 #직관 과 경기 태그를 붙인다', () => {
    expect(withMatchTag('좋았다', mockMatchFinished, matches)).toBe(
      `좋았다\n#직관 ${matchTag(mockMatchFinished)}`,
    )
  })

  it('#직관 이 이미 있으면 다시 붙이지 않는다', () => {
    expect(withMatchTag('#직관 좋았다', mockMatchFinished, matches)).toBe(
      `#직관 좋았다\n${matchTag(mockMatchFinished)}`,
    )
  })

  it('마지막 줄이 태그뿐이면 그 줄에 이어 붙인다', () => {
    expect(withMatchTag('좋았다\n#직관', mockMatchFinished, matches)).toBe(
      `좋았다\n#직관 ${matchTag(mockMatchFinished)}`,
    )
  })

  it('다른 경기를 고르면 앞의 경기 태그를 바꾼다', () => {
    const before = `좋았다\n#직관 ${matchTag(mockMatchFinished)}`
    expect(withMatchTag(before, other, matches)).toBe(`좋았다\n#직관 ${matchTag(other)}`)
  })

  it('고른 것을 풀면 경기 태그만 빼고 #직관 은 둔다', () => {
    const before = `좋았다\n#직관 ${matchTag(mockMatchFinished)}`
    expect(withMatchTag(before, null, matches)).toBe('좋았다\n#직관')
  })

  it('빈 본문이면 태그만 둔다', () => {
    expect(withMatchTag('', mockMatchFinished, matches)).toBe(`#직관 ${matchTag(mockMatchFinished)}`)
  })
})

/** 태그만 있는 본문을 누르면 태그를 아래로 내리고 맨 앞에서 쓰게 한다 (2026-09-29) */
describe('태그 앞에서 쓰기', () => {
  it('태그뿐이면 빈 첫 줄을 두고 커서를 맨 앞에', () => {
    expect(roomBeforeTags(`#직관 ${matchTag(mockMatchFinished)}`)).toEqual({
      body: `\n#직관 ${matchTag(mockMatchFinished)}`,
      cursor: 0,
    })
  })

  it('글이 있으면 그대로 둔다', () => {
    expect(roomBeforeTags('좋았다\n#직관')).toBeNull()
  })

  it('빈 본문이나 이미 첫 줄을 비운 본문은 그대로 둔다', () => {
    expect(roomBeforeTags('')).toBeNull()
    expect(roomBeforeTags('\n#직관')).toBeNull()
  })
})

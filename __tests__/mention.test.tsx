import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { homeTheme } from '@/styles/colors/theme'
import { activeMention, pickMention, replyMention, splitMentions } from '@/models/mention'
import { MentionText } from '@/components/foundation/MentionText'

/** 답글은 앞에 @아이디 를 달고, 본문 속 @아이디 는 색을 달리한다 (2026-09-29) */

describe('답글 언급', () => {
  it('빈 입력에 @아이디 와 빈칸을 넣는다', () => {
    expect(replyMention('', 'steel', null)).toBe('@steel ')
  })

  it('쓰던 글 앞에 붙인다', () => {
    expect(replyMention('좋아요', 'steel', null)).toBe('@steel 좋아요')
  })

  it('이미 그 사람을 불렀으면 다시 붙이지 않는다', () => {
    expect(replyMention('@steel 좋아요', 'steel', 'steel')).toBe('@steel 좋아요')
  })

  it('답글 대상을 바꾸면 앞의 자동 언급을 바꾼다', () => {
    expect(replyMention('@steel 좋아요', 'pohang', 'steel')).toBe('@pohang 좋아요')
  })

  it('답글을 풀면 자동으로 단 언급만 뗀다', () => {
    expect(replyMention('@steel 좋아요', null, 'steel')).toBe('좋아요')
    // 손으로 쓴 언급은 둔다
    expect(replyMention('@other 좋아요', null, 'steel')).toBe('@other 좋아요')
  })

  it('아이디가 없는 사람에게는 붙이지 않는다', () => {
    expect(replyMention('', null, null)).toBe('')
  })
})

describe('본문의 언급 가르기', () => {
  it('@아이디 를 따로 떼어 낸다', () => {
    expect(splitMentions('@steel 오늘 @pohang_fan 이랑 봤어요')).toEqual([
      { text: '@steel', mention: true },
      { text: ' 오늘 ', mention: false },
      { text: '@pohang_fan', mention: true },
      { text: ' 이랑 봤어요', mention: false },
    ])
  })

  it('메일 주소나 아이디 모양이 아닌 것은 언급이 아니다', () => {
    expect(splitMentions('mail@steel.com 과 @ 하나')).toEqual([
      { text: 'mail@steel.com 과 @ 하나', mention: false },
    ])
  })

  it('언급이 없으면 통째로 한 조각', () => {
    expect(splitMentions('그냥 글')).toEqual([{ text: '그냥 글', mention: false }])
  })
})

describe('언급 글자', () => {
  it('언급만 강조색으로 그린다', () => {
    render(
      <ThemeProvider initialPreference="home">
        <MentionText style={{}}>{'@steel 반가워요'}</MentionText>
      </ThemeProvider>,
    )
    expect(StyleSheet.flatten(screen.getByText('@steel').props.style).color).toBe(homeTheme.accent)
  })
})

/** @ 를 치면 아이디 후보를 띄운다 (2026-09-29) */
describe('치는 중인 언급', () => {
  it('커서 앞의 @글자 를 찾는다', () => {
    expect(activeMention('안녕 @st', 6)).toEqual({ query: 'st', start: 3 })
    expect(activeMention('@p', 2)).toEqual({ query: 'p', start: 0 })
  })

  it('@ 만 치면 아직 찾지 않는다', () => {
    expect(activeMention('안녕 @', 4)).toBeNull()
  })

  it('빈칸을 치면 언급이 끝난다', () => {
    expect(activeMention('@steel 좋아', 9)).toBeNull()
  })

  it('글자에 붙은 @ 는 언급이 아니다', () => {
    expect(activeMention('mail@st', 7)).toBeNull()
  })

  it('커서가 가운데 있으면 그 앞만 본다', () => {
    expect(activeMention('@st 뒤에 글', 3)).toEqual({ query: 'st', start: 0 })
  })

  it('대문자로 쳐도 소문자로 찾는다', () => {
    expect(activeMention('@St', 3)).toEqual({ query: 'st', start: 0 })
  })
})

describe('후보 고르기', () => {
  it('치던 조각을 @아이디 와 빈칸으로 바꾸고 커서를 그 뒤로', () => {
    expect(pickMention('안녕 @st', { query: 'st', start: 3 }, 6, 'steel')).toEqual({
      text: '안녕 @steel ',
      cursor: 10,
    })
  })

  it('뒤에 글이 있으면 그 앞에 끼운다', () => {
    expect(pickMention('@st뒤', { query: 'st', start: 0 }, 3, 'steel')).toEqual({
      text: '@steel 뒤',
      cursor: 7,
    })
  })
})

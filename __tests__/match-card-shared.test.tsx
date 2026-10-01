import React from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { MatchCard } from '@/components/match/MatchCard'
import { mockMatchFinished, mockMatchScheduled } from '@/utils/fixtures'

/**
 * 공유 전환은 태그 붙은 뷰를 **자식 없이** 복제해 날린다. 글자 안에 글자를 품으면(가운데 ':' 만
 * 다른 색으로 칠하던 스코어) 안쪽 글자가 복제에 따라오지 않는다. 폰에서 끝난 경기 카드만 전환이
 * 어긋났다 (2026-09-29) — 예정 경기는 스코어 자리가 'VS' 한 덩어리라 멀쩡했다.
 */

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

function taggedTexts(ui: React.ReactElement) {
  const { UNSAFE_root } = wrap(ui)
  return UNSAFE_root.findAll(
    node => typeof node.props.sharedTransitionTag === 'string' && node.type === Text,
    { deep: true },
  )
}

it.each([
  ['끝난 경기', mockMatchFinished],
  ['예정 경기', mockMatchScheduled],
])('%s 카드의 태그 붙은 글자는 안에 다른 글자를 품지 않는다', (_label, match) => {
  const texts = taggedTexts(<MatchCard match={match} shared />)
  expect(texts.length).toBeGreaterThan(0)
  for (const node of texts) {
    const nested = node.findAll(child => child !== node && child.type === Text, { deep: true })
    expect({ tag: node.props.sharedTransitionTag, nested: nested.length }).toEqual({
      tag: node.props.sharedTransitionTag,
      nested: 0,
    })
  }
})

it('끝난 경기의 스코어는 홈 점수·가운데·원정 점수가 각자 태그를 갖는다', () => {
  const tags = taggedTexts(<MatchCard match={mockMatchFinished} shared />).map(
    n => n.props.sharedTransitionTag,
  )
  expect(tags).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/score-home$/),
      expect.stringMatching(/score-colon$/),
      expect.stringMatching(/score-away$/),
    ]),
  )
})

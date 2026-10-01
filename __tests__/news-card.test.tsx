import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { NewsCard } from '@/components/news/NewsCard'
import { Skeleton } from '@/components/foundation/Skeleton'
import { toNewsArticle } from '@/services/kleague/mappers'
import type { NewsRow } from '@/repositories/kleague/rows'

const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)

/**
 * 소식 목록에 K리그 사진을 걸지 않는다. 우리 버킷에 복제해 두는 것도, 원본(장당 최대
 * 4.5MB)을 바로 거는 것도 하지 않는다. 카드는 글자만으로 완성된 모습이어야 한다.
 */
describe('소식 카드', () => {
  // 수집기가 예전에 적어 둔 칸이 행에 남아 있어도 화면까지 오지 않아야 한다
  const row = {
    seq: 96344,
    category: 'club',
    club_tag: '포항',
    title: '[포항] 포항스틸러스, 20일 서울전',
    published_on: '2026-09-17',
    view_count: 10,
    thumbnail_url: 'https://press.kleague.com/big.jpg',
    thumb_path: '96344.webp',
  } as unknown as NewsRow

  it('썸네일 주소를 들고 다니지 않는다', () => {
    expect(toNewsArticle(row)).not.toHaveProperty('thumbnailUrl')
  })

  it('사진 자리 없이 제목과 날짜로 그린다', () => {
    wrap(<NewsCard article={toNewsArticle(row)} />)
    expect(screen.getByText('[포항] 포항스틸러스, 20일 서울전')).toBeTruthy()
    expect(screen.getByText(/9월 17일/)).toBeTruthy()
    // 사진을 기다리는 회색 자리도 남지 않는다
    expect(screen.UNSAFE_queryAllByType(Skeleton)).toHaveLength(0)
  })
})

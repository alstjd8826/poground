import { filterNews, NEWS_FILTERS, newsFilterCounts } from '@/services/kleague/newsService'
import type { NewsArticle } from '@/models/kleague'

const article = (id: number, category: string | null, clubTag: string | null): NewsArticle => ({
  id,
  category,
  clubTag,
  title: `기사 ${id}`,
  publishedOn: '2026-09-14',
  viewCount: 0,
})

const list = [
  article(1, 'club', '포항'),
  article(2, 'club', '김천'),
  article(3, 'league', null),
  article(4, 'notice', null),
  article(5, 'club', '포항'),
]

describe('소식 필터', () => {
  it('전체는 거르지 않는다', () => {
    expect(filterNews(list, 'all')).toHaveLength(5)
  })

  it('포항은 구단 태그로 가른다', () => {
    // 카테고리가 아니라 제목의 "[포항]" 에서 뽑은 태그를 본다
    expect(filterNews(list, 'ours').map(a => a.id)).toEqual([1, 5])
  })

  it('나머지는 원본 카테고리로 가른다', () => {
    expect(filterNews(list, 'club').map(a => a.id)).toEqual([1, 2, 5])
    expect(filterNews(list, 'league').map(a => a.id)).toEqual([3])
    expect(filterNews(list, 'notice').map(a => a.id)).toEqual([4])
  })

  it('포항은 구단의 부분집합이다', () => {
    const ours = filterNews(list, 'ours').map(a => a.id)
    const club = filterNews(list, 'club').map(a => a.id)
    expect(ours.every(id => club.includes(id))).toBe(true)
  })

  it('아직 안 받았으면 빈 목록', () => {
    expect(filterNews(undefined, 'all')).toEqual([])
    expect(filterNews(undefined, 'ours')).toEqual([])
  })

  it('필터마다 건수를 세어 빈 것을 알려준다', () => {
    // 한 건도 없는 분류는 눌러봐야 빈 화면이라 화면이 잠근다
    expect(newsFilterCounts(list)).toEqual({ all: 5, ours: 2, club: 3, league: 1, notice: 1 })
    expect(newsFilterCounts([])).toEqual({ all: 0, ours: 0, club: 0, league: 0, notice: 0 })
  })

  it('필터 목록의 순서를 지킨다', () => {
    expect(NEWS_FILTERS.map(f => f.key)).toEqual(['all', 'ours', 'club', 'league', 'notice'])
  })
})

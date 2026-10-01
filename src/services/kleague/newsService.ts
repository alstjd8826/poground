import { newsRepository } from '@/repositories/kleague/newsRepository'
import type { NewsArticle } from '@/models/kleague'
import { toNewsArticle } from './mappers'

/**
 * 뉴스 도메인.
 *
 * 조합할 게 없어 매퍼를 씌우는 일이 전부지만, 훅이 리포지토리를 직접 보지 않도록 여기를 거친다.
 * 계층이 한 군데만 뚫려 있으면 나중에 규칙이 생겼을 때 넣을 자리를 찾기 어렵다.
 */
export async function getRecentNews(limit = 30): Promise<NewsArticle[]> {
  return (await newsRepository.findRecent(limit)).map(toNewsArticle)
}

export async function getNewsDetail(id: number): Promise<NewsArticle | null> {
  const row = await newsRepository.findBySeq(id)
  return row ? toNewsArticle(row) : null
}

// ─────────────────────────────── 필터

export type NewsFilter = 'all' | 'ours' | 'club' | 'league' | 'notice'

/**
 * 소식 목록의 필터.
 *
 * 축이 두 가지 섞여 있다 — '우리 구단' 은 제목의 구단 태그로, 나머지는 원본 카테고리로 나눈다.
 * 팬이 가장 자주 쓰는 건 "포항 것만" 이라 맨 앞에 둔다. '구단' 과 겹치지만(포항 소식은 구단
 * 카테고리이기도 하다) 좁은 쪽을 따로 두는 편이 실제로 쓰기 편하다.
 *
 * 목록이 수십 건이라 서버를 다시 부르지 않고 받아 둔 것을 거른다. 탭 전환이 즉시 끝난다.
 */
export const NEWS_FILTERS: Array<{ key: NewsFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'ours', label: '포항' },
  { key: 'club', label: '구단' },
  { key: 'league', label: '리그' },
  { key: 'notice', label: '공지' },
]

export function filterNews(
  articles: NewsArticle[] | undefined,
  filter: NewsFilter,
  clubName = '포항',
): NewsArticle[] {
  const all = articles ?? []
  if (filter === 'all') return all
  if (filter === 'ours') return all.filter(a => a.clubTag === clubName)
  return all.filter(a => a.category === filter)
}

/** 한 건도 없는 필터는 눌러봐야 빈 화면이다. 일정의 빈 달처럼 잠가 둔다. */
export function newsFilterCounts(articles: NewsArticle[] | undefined, clubName = '포항') {
  return Object.fromEntries(
    NEWS_FILTERS.map(f => [f.key, filterNews(articles, f.key, clubName).length]),
  ) as Record<NewsFilter, number>
}

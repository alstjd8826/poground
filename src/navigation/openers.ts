import { useCallback } from 'react'
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native'

import type { Match, NewsArticle, VideoClip } from '@/models/kleague'
import type { DetailNavigation } from './types'

/**
 * 홈의 "일정 전체 / 전체 순위 / 더 보기" 가 가리키는 곳.
 *
 * 일정과 순위, 소식과 영상이 각각 한 탭으로 합쳐졌으므로 탭만 바꿔서는 안 된다.
 * 탭 안의 어느 갈래를 펼지까지 넘겨야 "전체 순위" 를 눌렀는데 일정이 뜨는 일이 없다.
 */
/**
 * 홈의 "더 보기" 가 가는 곳.
 *
 * 일정·순위는 경기 탭의 그 갈래로 옮긴다. 소식·영상은 탭이 없으므로 홈 스택 위에 전체
 * 목록을 밀어 연다 — 뒤로 가면 홈으로 돌아온다.
 */
export type SeeAllKey = 'matches' | 'standings' | 'news' | 'videos'

export type SeeAllDestination =
  | { kind: 'tab'; tab: string; screen: string; inner: string }
  | { kind: 'stack'; screen: 'NewsList' | 'VideoList' }

export function seeAllDestination(key: SeeAllKey): SeeAllDestination {
  if (key === 'news') return { kind: 'stack', screen: 'NewsList' }
  if (key === 'videos') return { kind: 'stack', screen: 'VideoList' }
  return { kind: 'tab', tab: 'Competition', screen: 'CompetitionMain', inner: key }
}

/** 영상 카드는 유튜브 앱이 아니라 앱 안 플레이어로 보낸다 */
export function useOpenVideo() {
  const navigation = useNavigation<DetailNavigation>()
  return useCallback(
    (v: VideoClip) =>
      navigation.navigate('VideoPlayer', {
        youtubeId: v.youtubeId,
        title: v.title,
        category: v.category,
        publishedOn: v.publishedOn,
      }),
    [navigation],
  )
}

export function useOpenArticle() {
  const navigation = useNavigation<DetailNavigation>()
  return useCallback(
    (article: NewsArticle) => navigation.navigate('NewsDetail', { seq: article.id, title: article.title }),
    [navigation],
  )
}

/**
 * 경기 카드를 눌렀을 때. **늘 경기 상세로 간다.**
 *
 * 전에는 여기서 갈랐다 — 예정 경기면 예매 페이지로 앱을 떠나고, 끝난 경기 중 영상이
 * 있는 것만 상세로 갔다. 그래서 같은 카드를 눌러도 어디로 갈지 알 수 없었고, 영상이
 * 없는 지난 경기는 아예 눌리지 않았다.
 *
 * 갈 곳을 하나로 두고, 무엇을 보여줄지는 상세가 정한다 — 예매든 라인업이든 그 안에 있다.
 */
export function useOpenMatch() {
  const navigation = useNavigation<DetailNavigation>()
  return useCallback(
    (match: Match) => navigation.navigate('MatchDetail', { matchId: match.id, round: match.round }),
    [navigation],
  )
}

/**
 * 탭 안의 어느 갈래를 펼지는 라우트 파라미터가 정한다.
 *
 * 화면이 state 로 들면 홈의 "전체 보기" 를 두 번째 누를 때 값이 직전과 같아 아무 일도
 * 일어나지 않는다. 갈래를 손으로 바꾸는 것도 파라미터를 고쳐서 한다 — 출처가 하나뿐이면
 * "밖에서 지목해 들어온 경우" 와 "안에서 바꾼 경우" 를 따로 맞출 필요가 없다.
 */
export function useTabParam<T extends string>(fallback: T): [T, (next: T) => void] {
  const route = useRoute<RouteProp<Record<string, { tab?: T } | undefined>>>()
  const navigation = useNavigation()
  const set = useCallback((next: T) => navigation.setParams({ tab: next } as never), [navigation])
  return [route.params?.tab ?? fallback, set]
}

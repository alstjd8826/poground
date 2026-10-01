import { seeAllDestination } from '@/navigation/openers'

/** 소식·영상은 탭에서 빠져 홈 위에 쌓이는 목록이 됐다. 일정·순위는 여전히 경기 탭으로 간다 */
describe('홈의 더 보기', () => {
  it('일정과 순위는 경기 탭으로', () => {
    expect(seeAllDestination('matches')).toEqual({
      kind: 'tab',
      tab: 'Competition',
      screen: 'CompetitionMain',
      inner: 'matches',
    })
    expect(seeAllDestination('standings')).toEqual({
      kind: 'tab',
      tab: 'Competition',
      screen: 'CompetitionMain',
      inner: 'standings',
    })
  })

  it('소식과 영상은 홈 위에 목록을 연다', () => {
    expect(seeAllDestination('news')).toEqual({ kind: 'stack', screen: 'NewsList' })
    expect(seeAllDestination('videos')).toEqual({ kind: 'stack', screen: 'VideoList' })
  })
})

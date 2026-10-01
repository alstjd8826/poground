import { matchLookup } from '@/models/attendance'
import { SEASON_YEAR } from '@/config/env'
import { mockMatchFinished } from '@/utils/fixtures'

/** 경기 id 는 시즌·리그마다 다시 쓰인다. 지난 시즌 글이 올해 같은 번호 경기에 붙으면 안 된다 */
describe('경기 키로 찾기', () => {
  const find = matchLookup([mockMatchFinished])

  it('해·리그·경기가 모두 맞으면 찾는다', () => {
    expect(find({ year: SEASON_YEAR, leagueId: 1, gameId: mockMatchFinished.id })).toBe(mockMatchFinished)
  })

  it('경기 번호가 같아도 다른 시즌이면 없다', () => {
    expect(find({ year: SEASON_YEAR - 1, leagueId: 1, gameId: mockMatchFinished.id })).toBeUndefined()
  })

  it('경기 번호가 같아도 다른 리그면 없다', () => {
    expect(find({ year: SEASON_YEAR, leagueId: 2, gameId: mockMatchFinished.id })).toBeUndefined()
  })

  it('키가 없으면 없다', () => {
    expect(find(null)).toBeUndefined()
  })
})

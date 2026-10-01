import { getSquad } from '@/services/kleague/clubService'

jest.mock('@/repositories/kleague/clubRepository', () => ({
  clubRepository: {
    findSquad: jest.fn(async () => [{ name: '홍윤상', photo_url: null }]),
  },
}))
jest.mock('@/repositories/kleague/lineupRepository', () => ({
  lineupRepository: {
    findTeamPlayers: jest.fn(async () => [
      { name: '홍윤상', game_id: 180, player_id: '20210097', back_no: 11, position: 'FW', team_id: 'K03' },
    ]),
  },
}))

/**
 * 앱은 선수 사진을 내보내지 않는다. K리그 사진을 우리 버킷에 복제해 재배포하면 초상권과
 * 앱스토어 5.2.1 에 걸린다. 사용자가 넣은 사진만 프로필과 카드에서 따로 읽는다.
 */
describe('스쿼드 사진', () => {
  it('선수 id 는 채우되 사진 주소는 만들지 않는다', async () => {
    const player = (await getSquad('K03'))[0]!
    expect(player.playerId).toBe('20210097')
    expect(player.photoUrl).toBeNull()
  })
})

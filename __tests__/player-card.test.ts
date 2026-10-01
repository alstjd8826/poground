import { tierLabelOf } from '@/components/club/PlayerCard'
import type { Player } from '@/models/kleague'

const player = (extra: Partial<Player> = {}): Player => ({
  playerId: '20250001',
  name: '이호재',
  backNo: 18,
  position: 'FW',
  appearances: 0,
  goals: 0,
  assists: 0,
  shots: 0,
  fouls: 0,
  yellowCards: 0,
  redCards: 0,
  photoUrl: null,
  ...extra,
})

/**
 * 등급 기준은 2026 시즌 포항 37명의 실제 기록에서 잡은 것이라, 그 선수들이 원래 받아야 할
 * 등급을 받는지로 검증한다. 숫자를 바꾸면 여기가 먼저 깨진다.
 */
describe('tierLabelOf', () => {
  it('한 경기도 못 뛰었으면 기본', () => {
    expect(tierLabelOf(player())).toBe('기본')
  })

  it('출전도 공격도 애매하면 포일 (10경기, 무득점)', () => {
    expect(tierLabelOf(player({ appearances: 12 }))).toBe('광택')
  })

  it('많이 뛰었지만 공격 기여가 없으면 홀로 (28경기 김동진)', () => {
    expect(tierLabelOf(player({ appearances: 28, goals: 0, assists: 3 }))).toBe('강철')
  })

  it('많이 뛰고 공격포인트도 쌓이면 풀아트 (23경기 완델손)', () => {
    expect(tierLabelOf(player({ appearances: 23, goals: 3, assists: 3 }))).toBe('굴절')
  })

  it('출전과 득점이 둘 다 최상이면 레인보우 (20경기 8골 이호재)', () => {
    expect(tierLabelOf(player({ appearances: 20, goals: 8, assists: 0 }))).toBe('반짝이')
  })

  /**
   * 등급을 공격 기록만으로 매기면 수비수와 골키퍼가 전부 맨 아래에 깔린다.
   * 포지션은 색이 맡고, 등급은 출전만으로도 올라갈 수 있어야 한다.
   */
  it('무득점 골키퍼도 풀시즌을 뛰면 홀로까지 올라간다', () => {
    expect(tierLabelOf(player({ position: 'GK', appearances: 28 }))).toBe('강철')
  })
})

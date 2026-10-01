import React from 'react'
import { render } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { Avatar } from '@/components/profile/Avatar'
import { SILHOUETTE_SQUARE } from '@/components/club/PlayerPhoto'
import { avatarPath, isOwnAvatar, normalizeKakaoAvatar, pathFromPublicUrl } from '@/hooks/auth/avatar'
import { SUPABASE_URL } from '@/config/env'

const wrap = (ui: React.ReactElement, theme: 'home' | 'away' = 'home') =>
  render(<ThemeProvider initialPreference={theme}>{ui}</ThemeProvider>)

const OURS = `${SUPABASE_URL}/storage/v1/object/public/avatars/abc-123/1700000000000.jpg`
const KAKAO = 'https://k.kakaocdn.net/dn/abc/img_640x640.jpg'

describe('저장 경로', () => {
  /**
   * 맨 앞 칸이 사용자 id 여야 한다. 스토리지 정책이 그 칸만 보고 주인을 가리므로
   * (0008_avatars.sql), 모양이 바뀌면 업로드가 통째로 거부된다.
   */
  it('사용자 id 로 시작한다', () => {
    expect(avatarPath('abc-123', 1700000000000)).toBe('abc-123/1700000000000.jpg')
  })

  /** 같은 이름으로 덮으면 CDN 이 예전 이미지를 한동안 계속 내보낸다 */
  it('올릴 때마다 이름이 다르다', () => {
    expect(avatarPath('abc-123', 1)).not.toBe(avatarPath('abc-123', 2))
  })
})

describe('우리 파일 가리기', () => {
  it('우리 버킷 주소만 우리 것으로 본다', () => {
    expect(isOwnAvatar(OURS)).toBe(true)
  })

  /** 카카오가 준 주소를 지우려 들면 안 된다. 우리 것이 아니고 지울 수도 없다 */
  it('카카오 주소는 우리 것이 아니다', () => {
    expect(isOwnAvatar(KAKAO)).toBe(false)
    expect(isOwnAvatar(null)).toBe(false)
  })

  it('공개 주소에서 경로를 되찾는다', () => {
    expect(pathFromPublicUrl(OURS)).toBe('abc-123/1700000000000.jpg')
  })

  it('캐시 무력화 쿼리가 붙어도 경로만 뽑는다', () => {
    expect(pathFromPublicUrl(`${OURS}?t=123`)).toBe('abc-123/1700000000000.jpg')
  })

  it('남의 주소에서는 경로를 뽑지 않는다', () => {
    expect(pathFromPublicUrl(KAKAO)).toBeNull()
  })
})

describe('카카오가 준 주소 다듬기', () => {
  /**
   * 카카오에 사진을 안 걸어 둔 계정은 빈 값이 아니라 **기본 이미지 주소** 를 받는다.
   * 그대로 쓰면 흰 동그라미가 되고, 정작 준비한 선수 실루엣이 안 나온다.
   */
  it('기본 프로필 이미지는 없는 것으로 본다', () => {
    const fallback =
      'http://img1.kakaocdn.net/thumb/R640x640.q70/?fname=' +
      'http%3A%2F%2Ft1.kakaocdn.net%2Faccount_images%2Fdefault_profile.jpeg'
    expect(normalizeKakaoAvatar(fallback)).toBeNull()
  })

  /** 카카오는 http 로 주는 경우가 있고, iOS 는 ATS 때문에 그냥 안 그린다 */
  it('http 는 https 로 올린다', () => {
    expect(normalizeKakaoAvatar('http://k.kakaocdn.net/dn/abc/img.jpg')).toBe(
      'https://k.kakaocdn.net/dn/abc/img.jpg',
    )
  })

  it('실제로 걸어 둔 사진은 그대로 쓴다', () => {
    expect(normalizeKakaoAvatar(KAKAO)).toBe(KAKAO)
  })

  it('빈 값은 빈 값으로 둔다', () => {
    expect(normalizeKakaoAvatar(null)).toBeNull()
    expect(normalizeKakaoAvatar(undefined)).toBeNull()
    expect(normalizeKakaoAvatar('')).toBeNull()
  })
})

describe('프로필 이미지 표시', () => {
  it('사진이 있으면 그것을 그린다', () => {
    const { toJSON } = wrap(<Avatar url={OURS} />)
    expect(JSON.stringify(toJSON())).toContain(OURS)
  })

  /**
   * 사진이 없으면 선수 자리표시자와 같은 실루엣을 쓴다.
   * 같은 뜻("사람 사진이 아직 없다")에 표시가 두 가지 생기지 않게 한다.
   */
  it('사진이 없으면 선수 실루엣을 쓴다', () => {
    const { toJSON } = wrap(<Avatar url={null} />)
    const tree = JSON.stringify(toJSON())

    // react-native-svg 는 viewBox 를 네 숫자로 풀어 넘기므로 그 값으로 확인한다.
    // 상수를 직접 쪼개 비교해야 SILHOUETTE_SQUARE 를 고칠 때 테스트가 같이 움직인다
    const [minX, minY, w, h] = SILHOUETTE_SQUARE.split(' ').map(Number)
    expect(tree).toContain(`"minX":${minX},"minY":${minY},"vbWidth":${w},"vbHeight":${h}`)
    expect(tree).not.toContain(OURS)
  })

  /**
   * 게시글·댓글은 DB 에 적힌 주소를 그대로 넘긴다. 가입 초기에 카카오 기본 그림 주소가
   * 저장된 계정이 있어서, 그 사람 글에는 우리 실루엣 대신 카카오 그림이 나왔다
   */
  it('카카오 기본 그림 주소를 받으면 우리 실루엣을 쓴다', () => {
    const fallback =
      'http://img1.kakaocdn.net/thumb/R640x640.q70/?fname=' +
      'http%3A%2F%2Ft1.kakaocdn.net%2Faccount_images%2Fdefault_profile.jpeg'
    const tree = JSON.stringify(wrap(<Avatar url={fallback} />).toJSON())
    expect(tree).not.toContain('kakaocdn')
    expect(tree).toContain('"vbWidth"')
  })

  it('http 주소는 https 로 그린다', () => {
    const tree = JSON.stringify(wrap(<Avatar url="http://k.kakaocdn.net/dn/abc/img.jpg" />).toJSON())
    expect(tree).toContain('https://k.kakaocdn.net/dn/abc/img.jpg')
  })

  /** 사진을 받는 중이거나 못 받으면 빈 동그라미 대신 실루엣이 보여야 한다 */
  it('사진이 있어도 밑에 실루엣을 깔아 둔다', () => {
    const tree = JSON.stringify(wrap(<Avatar url={OURS} />).toJSON())
    expect(tree).toContain(OURS)
    expect(tree).toContain('"vbWidth"')
  })

  it('두 테마 모두에서 그려진다', () => {
    expect(() => wrap(<Avatar url={null} />, 'home')).not.toThrow()
    expect(() => wrap(<Avatar url={null} />, 'away')).not.toThrow()
  })
})

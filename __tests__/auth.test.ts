import { displayNameOf, oauthOptions } from '@/hooks/auth/useAuth'

/**
 * 로그인 자체는 카카오와 Supabase 가 주고받는 일이라 여기서 검증할 수 없다.
 * 대신 **우리가 정한 규칙** 을 지킨다 — 세션에서 이름을 어떻게 꺼내는지.
 *
 * 카카오는 동의 항목에 따라 이름을 안 줄 수 있고, 그때 화면에 undefined 가 새어 나가면
 * "undefined 님" 같은 글자가 그대로 보인다.
 */

type Session = Parameters<typeof displayNameOf>[0]

function sessionWith(meta: Record<string, unknown>): Session {
  return { user: { user_metadata: meta } } as unknown as Session
}

it('로그인 전에는 빈 이름', () => {
  expect(displayNameOf(null)).toBe('')
})

it('카카오가 준 이름을 쓴다', () => {
  expect(displayNameOf(sessionWith({ name: '홍길동' }))).toBe('홍길동')
})

it('name 이 없으면 다른 이름 칸을 찾아본다', () => {
  expect(displayNameOf(sessionWith({ full_name: '민성' }))).toBe('민성')
  expect(displayNameOf(sessionWith({ preferred_username: 'darby' }))).toBe('darby')
})

/** 이름 동의를 안 받은 계정. 여기서 undefined 가 나가면 화면에 그대로 찍힌다 */
it('이름을 하나도 못 받으면 빈 문자열', () => {
  expect(displayNameOf(sessionWith({}))).toBe('')
  expect(displayNameOf(sessionWith({ name: 123 }))).toBe('')
})

/** 카카오는 prompt=login 이면 남은 로그인과 상관없이 로그인 화면을 다시 띄운다(카카오 문서, 인가 코드 받기) */
describe('로그인 요청 옵션', () => {
  it('다른 카카오 계정으로 들어갈 때만 카카오 로그인 화면을 다시 띄운다', () => {
    expect(oauthOptions('kakao', 'poground://auth/callback', true).queryParams).toEqual({ prompt: 'login' })
    expect(oauthOptions('kakao', 'poground://auth/callback', false).queryParams).toBeUndefined()
  })

  it('구글은 계정 고르기 화면을 띄운다', () => {
    expect(oauthOptions('google', 'poground://auth/callback', true).queryParams).toEqual({
      prompt: 'select_account',
    })
  })

  it('돌아올 주소를 싣고 브라우저는 앱이 직접 연다', () => {
    expect(oauthOptions('kakao', 'poground://auth/callback', false)).toMatchObject({
      redirectTo: 'poground://auth/callback',
      skipBrowserRedirect: true,
    })
  })
})

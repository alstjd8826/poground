/**
 * 로그인에 쓰는 소셜 서비스.
 *
 * 애플은 **필수**다. 다른 소셜 로그인을 두는 앱은 애플 로그인도 같이 둬야 심사를
 * 통과한다(App Store 지침 4.8). 그리고 애플이 만든 것이라 iOS 에서만 뜬다 —
 * 안드로이드에서는 목록에서 빠진다.
 */
export type SocialProvider = 'kakao' | 'apple' | 'google'

/**
 * 애플 로그인을 켤지.
 *
 * **지금은 꺼 둔다.** 이 기능은 유료 Apple Developer Program 회원에게만 열린다 —
 * 무료 개인 팀으로 빌드하면 서명 단계에서 통째로 막힌다:
 *
 *   Personal development teams do not support the Sign In with Apple capability.
 *
 * 코드는 다 되어 있다. 유료 가입을 마치면 여기를 true 로 바꾸고, app.json 의 plugins 에
 * "expo-apple-authentication" 을 되돌린 뒤 prebuild 를 한 번 돌리면 된다. 그 플러그인이
 * 네이티브에 자격(entitlement)을 넣는데, 그 자격이 개인 팀에서 서명을 막는 것이다.
 *
 * 출시하려면 어차피 유료 회원이어야 하고, 다른 소셜 로그인을 두는 앱은 애플 로그인도
 * 같이 둬야 심사를 통과한다(지침 4.8). 미루는 것이지 빼는 것이 아니다.
 */
export const APPLE_LOGIN_ENABLED = false

export const PROVIDER_LABEL: Record<SocialProvider, string> = {
  kakao: '카카오',
  apple: 'Apple',
  google: 'Google',
}

/**
 * 보여줄 차례.
 *
 * 카카오가 맨 위인 것은 국내 이용자가 제일 많이 쓰기 때문이고, 애플이 그다음인 것은
 * iOS 앱이기 때문이다.
 */
export const PROVIDER_ORDER: SocialProvider[] = ['kakao', 'apple', 'google']

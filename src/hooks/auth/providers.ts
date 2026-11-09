/**
 * 로그인에 쓰는 소셜 서비스.
 *
 * 애플은 **필수**다. 다른 소셜 로그인을 두는 앱은 애플 로그인도 같이 둬야 심사를
 * 통과한다(App Store 지침 4.8). 그리고 애플이 만든 것이라 iOS 에서만 뜬다 —
 * 안드로이드에서는 목록에서 빠진다.
 */
export type SocialProvider = 'kakao' | 'apple' | 'google'

export const PROVIDER_LABEL: Record<SocialProvider, string> = {
  kakao: '카카오',
  apple: 'Apple',
  google: 'Google',
}

/**
 * 보여줄 차례.
 *
 * 카카오가 **맨 아래**다 (2026-11-09). 카카오 버튼 밑에는 "다른 카카오 계정으로 로그인" 이
 * 따라붙는데, "최근 로그인" 말풍선은 버튼 위에 겹쳐 뜨므로 카카오 다음 버튼에 말풍선이
 * 붙으면 그 링크를 덮었다. 카카오를 끝에 두면 링크 아래에 버튼이 없어 겹칠 일이 없다.
 * 애플이 맨 위인 것은 iOS 앱이기 때문이다.
 */
export const PROVIDER_ORDER: SocialProvider[] = ['apple', 'google', 'kakao']

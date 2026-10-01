const { withEntitlementsPlist } = require('@expo/config-plugins')

/**
 * 애플 로그인 자격을 도로 걷어낸다.
 *
 * expo-apple-authentication 은 설치만 해도 제 플러그인이 자동으로 붙어
 * com.apple.developer.applesignin 자격을 네이티브에 넣는다(SDK 57). 그런데 그 자격은
 * **유료 Apple Developer Program 회원에게만** 허용돼서, 무료 개인 팀으로 서명하면
 * 빌드가 통째로 막힌다:
 *
 *   Personal development teams do not support the Sign In with Apple capability.
 *
 * 그래서 코드는 그대로 두고 자격만 뺀다. 유료 가입을 마치면 app.json 의 plugins 에서
 * 이 줄을 지우고 hooks/auth/providers.ts 의 APPLE_LOGIN_ENABLED 를 켠 뒤 prebuild 를
 * 한 번 돌리면 된다. 지우는 것이 아니라 미루는 것이다 — 다른 소셜 로그인을 두는 앱은
 * 애플 로그인도 같이 둬야 심사를 통과한다(지침 4.8).
 */
module.exports = function withoutAppleSignIn(config) {
  return withEntitlementsPlist(config, cfg => {
    delete cfg.modResults['com.apple.developer.applesignin']
    return cfg
  })
}

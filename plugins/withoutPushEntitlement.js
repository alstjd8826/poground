const { withEntitlementsPlist } = require('@expo/config-plugins')

/**
 * 푸시 알림 자격(aps-environment)을 도로 걷어낸다 (2026-09-30).
 *
 * expo-notifications 는 설치만 해도 제 플러그인이 aps-environment 를 넣는다. 그 자격은 **유료 Apple
 * Developer Program 회원에게만** 허용돼서 무료 개인 팀으로 서명하면 빌드가 막힌다. 지금 쓰는 것은 기기가
 * 스스로 울리는 로컬 알림뿐이라 그 자격이 필요 없다.
 *
 * 유료 가입을 마치고 서버 푸시를 붙일 때 app.json 의 plugins 에서 이 줄을 지우고 prebuild 한다.
 * withoutAppleSignIn 과 같은 방식이다.
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, cfg => {
    delete cfg.modResults['aps-environment']
    return cfg
  })
}

const { withInfoPlist } = require('@expo/config-plugins')

/**
 * 화면에 뜨는 이름을 한글로 되돌린다.
 *
 * Expo 는 Xcode 프로젝트 이름을 expo.name 에서 뽑는데, 영문·숫자만 남기고 지운다.
 * 순한글 이름은 통째로 지워져 기본값 "app" 으로 떨어진다 — Xcode 를 열 때마다 프로젝트도
 * 타깃도 "app" 으로 보이던 것이 그 때문이다.
 *
 * 그래서 expo.name 은 영문으로 두어 프로젝트 이름을 얻고, 사람이 보는 이름만 여기서
 * 한글로 덮는다. Expo 의 이름 플러그인이 expo.name 으로 CFBundleDisplayName 을 먼저
 * 적으므로, 그 뒤에 도는 이 플러그인이 마지막 말을 한다.
 *
 * CFBundleName 도 같이 바꾼다. 그쪽은 목록에서 쓰이는 짧은 이름이라 16자를 넘기지 않는
 * 것이 좋다고 애플이 권한다.
 */
const DISPLAY_NAME = '포그라운드'

module.exports = function withKoreanDisplayName(config) {
  return withInfoPlist(config, cfg => {
    cfg.modResults.CFBundleDisplayName = DISPLAY_NAME
    cfg.modResults.CFBundleName = DISPLAY_NAME
    return cfg
  })
}

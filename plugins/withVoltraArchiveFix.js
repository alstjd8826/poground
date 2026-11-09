const { withPodfile } = require('@expo/config-plugins')

/**
 * 아카이브(App Store 업로드용 빌드)가 Voltra 때문에 깨지는 것을 막는다 (2026-11-09).
 *
 * Voltra 는 앱용 포드(Voltra)와 Live Activity 확장용 포드(VoltraWidget)를 따로 두는데, 둘 다
 * 모듈 이름이 VoltraRuntime 이다. 아카이브 때는 정적 프레임워크가 같은 UninstalledProducts 자리로
 * 모이므로, 두 포드가 App Intents 메타데이터를 같은 경로(VoltraRuntime/Metadata.appintents)에
 * 만들려다 부딪힌다:
 *
 *   error: Multiple commands produce '<ExtractAppIntentsMetadata … VoltraRuntime/Metadata.appintents>'
 *
 * 일반 빌드(기기·시뮬레이터)는 그 자리를 쓰지 않아 멀쩡하다.
 *
 * 확장용 포드에서만 추출을 끈다(LM_SKIP_METADATA_EXTRACTION). 우리 Live Activity 는 글자·타이머만
 * 쓰고 누르면 딥링크로 앱을 연다 — 버튼·토글(App Intents)을 쓰지 않으므로 확장 쪽 메타데이터가
 * 필요 없다. **Live Activity 에 Voltra.Button / Voltra.Toggle 을 넣으면 이 우회를 다시 봐야 한다.**
 * LM_OUTPUT_DIR 로 출력 폴더만 옮기는 것은 효과가 없었다(빌드 그래프의 경로가 그대로라).
 */
const MARK = '# [poground] withVoltraArchiveFix'
const ANCHOR = '  post_install do |installer|\n'

function addVoltraArchiveFix(podfile) {
  if (podfile.includes(MARK)) return podfile
  if (!podfile.includes(ANCHOR)) throw new Error('withVoltraArchiveFix: Podfile 에 post_install 이 없습니다')
  return podfile.replace(
    ANCHOR,
    `${ANCHOR}    ${MARK} — VoltraWidget 의 App Intents 메타데이터 추출을 끈다 (아카이브 충돌)
    installer.pods_project.targets.each do |t|
      next unless t.name == 'VoltraWidget'
      t.build_configurations.each { |c| c.build_settings['LM_SKIP_METADATA_EXTRACTION'] = 'YES' }
    end
`,
  )
}

module.exports = function withVoltraArchiveFix(config) {
  return withPodfile(config, cfg => {
    cfg.modResults.contents = addVoltraArchiveFix(cfg.modResults.contents)
    return cfg
  })
}
module.exports.addVoltraArchiveFix = addVoltraArchiveFix

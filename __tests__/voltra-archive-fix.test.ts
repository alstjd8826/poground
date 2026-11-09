// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addVoltraArchiveFix } = require('../plugins/withVoltraArchiveFix')

const PODFILE = `target 'Poground' do
  post_install do |installer|
    react_native_post_install(installer)
  end
end
`

it('post_install 맨 앞에 VoltraWidget 의 메타데이터 추출 끄기를 넣는다', () => {
  const out: string = addVoltraArchiveFix(PODFILE)
  expect(out).toContain("next unless t.name == 'VoltraWidget'")
  expect(out).toContain("c.build_settings['LM_SKIP_METADATA_EXTRACTION'] = 'YES'")
  expect(out.indexOf('LM_SKIP_METADATA_EXTRACTION')).toBeLessThan(out.indexOf('react_native_post_install'))
})

it('두 번 돌려도 한 번만 들어간다 (prebuild 를 다시 돌릴 때)', () => {
  const once: string = addVoltraArchiveFix(PODFILE)
  expect(addVoltraArchiveFix(once)).toBe(once)
})

it('post_install 이 없으면 조용히 넘어가지 않고 알린다', () => {
  expect(() => addVoltraArchiveFix("target 'Poground' do\nend\n")).toThrow()
})

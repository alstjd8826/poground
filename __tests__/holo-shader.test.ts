import CanvasKitInit from 'canvaskit-wasm'

import { buildShine, SHINE_KEYS } from '@/components/holo/shine'

/**
 * 홀로 셰이더가 컴파일되는지 본다.
 *
 * SkSL 이 안 맞으면 앱은 터지지 않고 그냥 카드가 안 그려진다 — 아무 표시 없이 빈 칸이
 * 되므로 사람이 눌러 보기 전까지 아무도 모른다. 셰이더 문자열은 여기서 조립되니
 * 여기서 한 번 실제로 컴파일해 본다.
 *
 * 앱은 네이티브 스키아를, 이 검사는 같은 스키아의 wasm 빌드(CanvasKit)를 쓴다.
 * 컴파일러는 같은 것이라 문법·타입 오류는 여기서 똑같이 잡힌다.
 *
 * 빛은 전부 우리가 쓴 것이므로 하나도 빠짐없이 본다.
 *
 * canvaskit-wasm 은 @shopify/react-native-skia 가 직접 의존하는 패키지라 따로 안 깔아도
 * 늘 있다. 혹시 없어지면 "Cannot find module" 로 바로 드러난다.
 */

jest.setTimeout(60000)

let CanvasKit: { RuntimeEffect: { Make: (src: string) => unknown } }

beforeAll(async () => {
  // jest-expo 가 깔아 둔 TextDecoder 는 utf-16le 를 모른다. CanvasKit 이 wasm 문자열을
  // 읽을 때 그걸 쓰므로 노드의 것으로 바꿔 둔다
  globalThis.TextDecoder = require('util').TextDecoder
  CanvasKit = await (CanvasKitInit as unknown as () => Promise<typeof CanvasKit>)()
})

it('컴파일 실패는 예외가 아니라 null 로 온다', () => {
  // 이 검사 자체가 무엇이든 통과시키고 있지 않은지 먼저 확인한다
  expect(CanvasKit.RuntimeEffect.Make('half4 main(float2 xy) { return nope(xy); }')).toBeFalsy()
  expect(CanvasKit.RuntimeEffect.Make('half4 main(float2 xy) { return half4(1); }')).toBeTruthy()
})

it.each(SHINE_KEYS)('%s 셰이더가 컴파일된다', effect => {
  expect(CanvasKit.RuntimeEffect.Make(buildShine(effect))).toBeTruthy()
})

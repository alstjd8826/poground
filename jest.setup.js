// Gesture Handler 는 테스트 환경에서 네이티브 없이 동작하도록 공식 setup 을 요구한다.
// Reanimated 는 jest-expo preset 이 이미 처리하므로 여기서 따로 손댈 게 없다.
require('react-native-gesture-handler/jestSetup')

// 공식 setup 도 GestureDetector 까지는 못 세운다. 그 안에서 Reanimated 의 useEvent 를
// 부르는데 jest-expo 의 목에 그 함수가 없어서 렌더가 통째로 죽는다.
// 여기서 검증할 것은 손짓이 아니라 감싼 것이 화면에 뜨느냐이므로 그대로 통과시킨다.
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler')
  return { ...actual, GestureDetector: ({ children }) => children }
})

// FlashList 는 레이아웃 측정을 흉내 내는 공식 setup 을 제공한다
require('@shopify/flash-list/jestSetup')

// Skia 는 ESM 으로 배포되는 데다 실제로 그리려면 CanvasKit(wasm) 이 있어야 한다.
// 공식 jestSetup 은 그 wasm 을 통째로 올리는데, 여기서 검증할 것은 홀로 카드의 픽셀이
// 아니라 화면이 뜨느냐이므로 그리는 시늉만 하는 가짜로 대신한다.
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react')
  const noop = () => undefined
  // 캔버스 안쪽은 전부 스키아 전용 노드라 RN 이 못 그린다. 통째로 비운다
  const Canvas = () => React.createElement('Canvas', null)
  const Node = () => null

  const paint = {
    setShader: noop,
    setColor: noop,
    setAlphaf: noop,
    setStyle: noop,
    setStrokeWidth: noop,
  }

  return {
    Canvas,
    Fill: Node,
    ImageShader: Node,
    Shader: Node,
    PaintStyle: { Fill: 0, Stroke: 1 },
    TileMode: { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 },
    vec: (x = 0, y = 0) => ({ x, y }),
    createPicture: () => ({}),
    drawAsImageFromPicture: () => null,
    useImage: () => null,
    Skia: {
      Paint: () => paint,
      Color: () => 0,
      XYWHRect: (x, y, width, height) => ({ x, y, width, height }),
      RRectXY: rect => ({ rect }),
      Shader: { MakeLinearGradient: noop, MakeRadialGradient: noop },
      RuntimeEffect: { Make: () => null },
    },
  }
})

// AsyncStorage 는 네이티브 모듈이라 테스트에서 null 이다. 공식 목이 함께 배포된다
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// Voltra(Live Activity)는 ESM 으로 배포되고 불러오는 순간 네이티브 모듈을 찾는다. 여기서 검증할 것은 잠금 화면
// 그림이 아니라 화면이 뜨느냐이므로 시늉만 한다. 이 기능을 보는 테스트는 제 목을 따로 건다(live-activity-sync)
jest.mock('@use-voltra/ios-client', () => ({
  startLiveActivity: jest.fn(async () => ''),
  endAllLiveActivities: jest.fn(async () => {}),
}))
jest.mock('@use-voltra/ios', () => {
  const React = require('react')
  const tag = name => props => React.createElement(name, props)
  return { Voltra: { VStack: tag('VStack'), HStack: tag('HStack'), Text: tag('Text'), Timer: tag('Timer') } }
})

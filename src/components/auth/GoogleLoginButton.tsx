import { Image } from 'react-native'

import { SocialLoginButton } from './SocialLoginButton'

/**
 * 구글 로그인 버튼.
 *
 * 카카오와 같은 방식이다 — **마크는 공식 자산 그대로, 글자는 우리가 그린다.** 구글이
 * 배포하는 "pre-approved brand icons" 묶음에서 아이콘만 있는 밝은 테마 iOS 버튼을 받아,
 * 그 안의 마크 영역(44 중 가운데 20)만 잘라 썼다. 잘라낸 것이라 마크 자체는 손대지 않았고
 * 색도 비율도 원본 그대로다 — 지침이 막는 것이 그 둘이다.
 *
 * 마크를 손으로 그리지 않은 이유는, 상표를 베끼는 것이 빠뜨리는 것보다 나쁘기 때문이다.
 * SVG 를 옮겨 쓰지 못한 것은 요즘 G 가 conic-gradient 와 블러로 그려져 있어 앱에서 쓰는
 * SVG 라이브러리가 그리지 못해서다.
 *
 * 색은 테마를 타지 않는다. 지침이 밝은 테마 버튼의 색을 숫자로 정해 두었고, 마크는
 * **흰 바탕 위에** 올려야 한다고 못 박는다.
 *
 * 높이·글자·모서리·마크 자리(왼쪽 16, 지침의 iOS 안쪽 여백과 같다)는 카카오·애플과 같게
 * 공통 틀(SocialLoginButton)이 정한다.
 */
const SYMBOL = require('@assets/google/g.png')

/** 지침이 정한 밝은 테마 버튼 색 */
const SURFACE = '#FFFFFF'
const BORDER = '#747775'
const LABEL = '#1F1F1F'

/** 원본에서 마크가 차지하던 크기 그대로 */
const SYMBOL_SIZE = 20

export function GoogleLoginButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <SocialLoginButton
      label="Google 로그인"
      symbol={
        <Image
          source={SYMBOL}
          style={{ width: SYMBOL_SIZE, height: SYMBOL_SIZE }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      }
      background={SURFACE}
      foreground={LABEL}
      border={BORDER}
      onPress={onPress}
      disabled={disabled}
    />
  )
}

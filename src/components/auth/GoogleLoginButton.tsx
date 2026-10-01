import { Image, StyleSheet, Text, View } from 'react-native'

import { cornerRadius } from '@/styles'
import { PressableScale } from '@/components/foundation/PressableScale'

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
 * 높이는 카카오·애플과 같은 52 다. 나란히 섰을 때 키가 다르면 한쪽이 덜 중요해 보인다.
 */
const SYMBOL = require('@assets/google/g.png')

const HEIGHT = 52

/** 지침이 정한 밝은 테마 버튼 색 */
const SURFACE = '#FFFFFF'
const BORDER = '#747775'
const LABEL = '#1F1F1F'

/** 지침이 정한 iOS 안쪽 여백 */
const PAD = 16

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
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Google 로그인"
      accessibilityState={{ disabled }}
      style={styles.press}
    >
      <View style={[styles.box, disabled && styles.dim]}>
        <Image source={SYMBOL} style={styles.symbol} resizeMode="contain" accessibilityIgnoresInvertColors />
        {/* 글자는 버튼 한가운데다. 마크가 자리를 밀지 않도록 겹쳐 놓는다 */}
        <Text style={styles.label}>Google 로그인</Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  box: {
    height: HEIGHT,
    borderRadius: cornerRadius['150'],
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { position: 'absolute', left: PAD, width: SYMBOL_SIZE, height: SYMBOL_SIZE },
  /** 지침이 OS 기본 서체를 쓰라고 해서 앱 서체를 지정하지 않는다 */
  label: { fontSize: 16, color: LABEL },
  dim: { opacity: 0.5 },
})

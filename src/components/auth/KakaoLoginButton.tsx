import { Image, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, spacing } from '@/styles'
import { PressableScale } from '@/components/foundation/PressableScale'

/**
 * 카카오 로그인 버튼.
 *
 * 카카오가 배포한 버튼 이미지를 통째로 쓰지 않고, **심볼만 그대로 두고 나머지는 우리가
 * 그린다.** 카카오도 그러라고 원본 PSD 를 함께 준다 ("사용자 환경에 맞게 변경이 필요한
 * 경우 PSD 를 받아 수정").
 *
 * 그렇게 한 이유는 둘이다.
 *
 * 1. **또렷하다.** 받은 이미지는 600×90 이라 화면 폭(370pt)으로 늘리면 3배 화면 기준
 *    필요 해상도의 절반뿐이라 글자까지 흐려진다. 글자를 네이티브로 그리면 완전히
 *    또렷해지고, 흐릴 여지는 작은 심볼 하나로 줄어든다.
 * 2. **우리 단추와 같은 모양이 된다.** 이미지는 6.67:1 로 비율이 묶여 있어 높이를
 *    우리가 정할 수 없었다.
 *
 * 가이드가 정한 것은 그대로 지킨다.
 *   컨테이너 #FEE500 · 모서리 12 · 레이블 검정 85% · 심볼은 변형 없이 필수
 *   레이블 높이는 컨테이너의 1/3 이하 (52 / 3 = 17.3 이므로 16)
 *   심볼은 컨테이너 높이의 37% — 원본 버튼(심볼 33 / 버튼 90)에서 잰 값이다
 */
const SYMBOL = require('@assets/kakao/symbol.png')

/** 가이드가 정한 컨테이너 색. 바꿀 수 없다 */
const KAKAO_YELLOW = '#FEE500'

/** 레이블 색. 검정 85% */
const KAKAO_LABEL = 'rgba(0, 0, 0, 0.85)'

const HEIGHT = 52
const SYMBOL_HEIGHT = Math.round(HEIGHT * 0.37)
/** 오려낸 심볼의 원본 비율(38:35)을 그대로 쓴다. 비율을 바꾸면 규격을 벗어난다 */
const SYMBOL_WIDTH = Math.round((SYMBOL_HEIGHT * 38) / 35)

export function KakaoLoginButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="카카오 로그인"
      accessibilityState={{ disabled }}
      style={styles.press}
    >
      <View style={[styles.box, disabled && styles.dim]}>
        <Image
          source={SYMBOL}
          style={[styles.symbol, { width: SYMBOL_WIDTH, height: SYMBOL_HEIGHT }]}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        {/* 글자는 버튼 한가운데다. 심볼이 자리를 밀지 않도록 겹쳐 놓는다 */}
        <Text style={styles.label}>카카오 로그인</Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  box: {
    height: HEIGHT,
    borderRadius: cornerRadius['150'],
    backgroundColor: KAKAO_YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { position: 'absolute', left: spacing['200'] },
  /** 가이드가 OS 기본 서체를 쓰라고 해서 앱 서체를 지정하지 않는다 */
  label: { fontSize: 16, color: KAKAO_LABEL },
  dim: { opacity: 0.5 },
})

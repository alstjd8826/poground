import { StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'

/**
 * "저번에 이걸로 하셨어요" 말풍선.
 *
 * 소셜이 서넛 되면 어느 것으로 가입했는지 정말 못 외운다. 잘못 고르면 빈 계정이 하나
 * 더 생기고, 그 사람은 제 댓글과 카드가 사라진 줄 안다. 그래서 기억해서 짚어 준다.
 *
 * 버튼 **위**에 띄우고 꼬리를 아래로 낸다. 버튼 안에 글자를 더하면 카카오·애플 지침이
 * 정한 버튼 모양을 건드리게 된다 — 지침이 묶어 둔 것은 버튼 안이지 그 바깥이 아니다.
 *
 * 자리를 차지하지 않고 **덮어서** 뜬다. 흐름에 끼워 두면 말풍선이 붙은 버튼만 아래로
 * 밀려, 저번에 무엇으로 들어왔느냐에 따라 버튼 줄의 간격이 달라진다. 짚어 주려고 붙인
 * 표시가 오히려 줄을 흔드는 셈이다.
 */
export function LastUsedBubble() {
  const theme = useTheme()
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.bubble, { backgroundColor: theme.accent }]}>
        <Text style={[fonts.caption, { color: theme.textOnMain }]}>최근 로그인</Text>
      </View>
      {/* 꼬리. 네모의 아래 모서리를 잘라 삼각형으로 쓴다 */}
      <View style={[styles.tail, { borderTopColor: theme.accent }]} />
    </View>
  )
}

const TAIL = 5

const styles = StyleSheet.create({
  /**
   * 버튼 위에 얹는다. bottom: '100%' 는 "감싼 상자의 위쪽 끝" 이라, 버튼 높이를 몰라도
   * 늘 버튼 바로 위에 붙는다. zIndex 는 버튼보다 뒤에 그려지지 않게 하는 보험이다.
   */
  wrap: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginBottom: spacing['050'],
    zIndex: 1,
  },
  bubble: {
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['050'],
    borderRadius: cornerRadius.full,
  },
  /**
   * 테두리만으로 그리는 삼각형. 위쪽 테두리에만 색을 주고 좌우를 투명하게 두면 아래를
   * 향한 꼭짓점이 남는다. 이미지 한 장 없이 되는 방법이다.
   */
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: TAIL,
    borderRightWidth: TAIL,
    borderTopWidth: TAIL,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
})

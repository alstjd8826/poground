import { StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

/**
 * 커뮤니티 헤더 오른쪽의 글쓰기 — 네모에 연필 (2026-09-29).
 *
 * 전에는 목록 위에 떠 있는 단추였다. 마지막 카드를 가리고, 원정 테마에서는 바탕과 겹쳤다. 헤더
 * 오른쪽은 이 앱에서 이미 행동 자리다(카드 보관함의 새로 만들기, 저장·올리기). 그림은 직접 그린다 —
 * 서체에 없는 기호를 쓰면 iOS 가 다른 서체로 바꿔 그려 모양이 튄다.
 */
export function ComposeButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme()
  return (
    <PressableScale
      scaleTo={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="글쓰기"
      hitSlop={10}
      style={styles.hit}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"
          stroke={theme.accent}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M17.6 3.4a2 2 0 0 1 2.9 2.9L12 14.8l-3.8 1 1-3.8z"
          stroke={theme.accent}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  /** 헤더 단추는 글자 단추(HeaderAction)와 같은 최소 폭을 갖는다 */
  hit: { minWidth: 44, alignItems: 'center', justifyContent: 'center' },
})

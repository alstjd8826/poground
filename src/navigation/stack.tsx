import { useMemo } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { fonts } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'

/** 탭마다 하나씩 세우는 스택. 화면 등록은 detailScreens 와 tabs 가 한다 */
export const Stack = createNativeStackNavigator()

/**
 * 헤더 설정.
 *
 * 골키퍼 테마에서 뒤로가기 화살표가 검게 나왔던 원인은 여기가 아니라
 * NavigationContainer 의 theme.dark 였다 (아래 navTheme 주석). 이 훅이 내려보내는
 * tint 는 처음부터 흰색이었는데 그 위를 바의 기본 외형이 덮고 있었다.
 *
 * focused 를 의존성에 둔 것은 그와 별개의 대비다. react-native-screens 는 헤더 설정을
 * updateProps 때만 네이티브에 반영하고 그때 화면이 보이지 않으면 건너뛰는데, 다시
 * 보일 때 재적용하는 경로가 없다 (RNSScreenStackHeaderConfig.mm 의
 * updateViewControllerIfNeeded). 탭마다 네비게이션 컨트롤러가 따로라 배경 탭에 이미
 * 들어가 있던 화면이 옛 색으로 남을 수 있다.
 *
 * 다만 그 경우를 실제로 재현해 확인한 것은 아니다 — 소스를 읽고 둔 안전장치다.
 * 탭이 다시 보일 때 객체를 새로 만들어 updateProps 를 한 번 더 끌어낸다.
 */
export function useStackOptions() {
  const theme = useTheme()
  const focused = useIsFocused()
  return useMemo(() => {
    return {
      headerStyle: { backgroundColor: theme.background },
      headerTitleStyle: { ...fonts.title2, color: theme.textPrimary },
      // 뒤로가기 화살표는 제목과 같은 색으로 둔다. 강조색(accent)을 쓰면 홈과 원정이
      // 둘 다 빨강이라 배경이 검정에서 흰색으로 뒤집혀도 화살표만 그대로 남는다
      headerTintColor: theme.textPrimary,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal' as const,
    }
    // focused 는 값으로 쓰이지 않는다. 탭이 다시 보일 때 객체를 새로 만들어
    // 네이티브 재적용을 끌어내는 것이 목적이다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, focused])
}

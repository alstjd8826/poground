import { useCallback, useMemo } from 'react'
import { NavigationContainer, type Theme as NavTheme } from '@react-navigation/native'
import { type BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import { fonts } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { navigationRef, useDeepLinks } from './deepLink'
import { useNotificationSync } from '@/notifications/useNotificationSync'
import { useNotificationTaps } from '@/notifications/useNotificationTaps'
import { useLiveActivitySync } from '@/liveActivity/useLiveActivitySync'
import { TabBar } from './TabBar'
import { TabBarHeightProvider } from './tabBarHeight'
import { ClubTab, CompetitionTab, HomeTab, MediaTab, MyTab } from './tabs'
import type { RootTabParamList } from './types'

const Tab = createBottomTabNavigator<RootTabParamList>()

export function RootNavigator() {
  const theme = useTheme()

  // 신고 메일에서 누른 주소를 화면으로 옮긴다. ref 로 부르므로 컨테이너 밖에서도 된다
  useDeepLinks()
  // 경기 알림 — 지금 상태에 맞춰 예약하고, 누르면 그 경기로 (2026-09-30)
  useNotificationSync()
  useNotificationTaps()
  // 직관 경기 당일 잠금 화면 카운트다운 (iOS)
  useLiveActivitySync()

  // React Navigation 이 화면 전환 배경으로 쓰는 색. 앱 테마와 어긋나면 전환 중 흰 섬광이 보인다
  const navTheme = useMemo<NavTheme>(
    () => ({
      // 이름이 아니라 barStyle 로 가른다. 어두운 테마가 홈·골키퍼 둘이라
      // key === 'home' 이면 골키퍼가 밝은 테마로 취급된다
      dark: theme.barStyle === 'light-content',
      colors: {
        primary: theme.accent,
        background: theme.background,
        card: theme.surface,
        text: theme.textPrimary,
        border: theme.divider,
        notification: theme.accent,
      },
      fonts: {
        regular: { fontFamily: fonts.body.fontFamily as string, fontWeight: '400' },
        medium: { fontFamily: fonts.body.fontFamily as string, fontWeight: '500' },
        bold: { fontFamily: fonts.headline.fontFamily as string, fontWeight: '700' },
        heavy: { fontFamily: fonts.title1.fontFamily as string, fontWeight: '800' },
      },
    }),
    [theme],
  )

  const renderTabBar = useCallback((props: BottomTabBarProps) => <TabBar {...props} />, [])

  return (
    // 탭바가 화면 위에 떠 있어서, 스크롤 화면이 그 높이만큼 아래를 비워야 한다.
    // 값을 나르는 통로를 내비게이터 바깥에 둔다 — 탭바와 화면은 서로 형제라 한쪽이
    // 다른 쪽에 직접 내려줄 수 없다
    <TabBarHeightProvider>
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        {/* 헤더는 각 탭의 스택이 그린다. 탭 내비게이터는 헤더를 숨긴다 */}
        <Tab.Navigator tabBar={renderTabBar} screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Tab.Screen name="Home" component={HomeTab} />
          <Tab.Screen name="Competition" component={CompetitionTab} />
          <Tab.Screen name="Media" component={MediaTab} />
          <Tab.Screen name="Club" component={ClubTab} />
          <Tab.Screen name="My" component={MyTab} />
        </Tab.Navigator>
      </NavigationContainer>
    </TabBarHeightProvider>
  )
}

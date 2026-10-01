import React, { useEffect } from 'react'
import { type LayoutChangeEvent, StyleSheet, Text } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'

import { cornerRadius, fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { useReportTabBarHeight, useTabBarHeight } from './tabBarHeight'
import type { RootTabParamList } from './types'

/**
 * 탭에 걸린 첫 화면인가.
 *
 * 탭 하나는 스택 하나다. 그 스택이 첫 화면 위에 무언가를 얹고 있으면 한 걸음 들어온
 * 것이고, 그때는 탭바를 감춘다 — 나가는 길이 뒤로가기이지 탭이 아니다.
 *
 * 화면 이름을 하나하나 적지 않는 이유는, 적는 순간 새로 만든 화면이 조용히 빠지기
 * 때문이다. 깊이는 화면을 더 만들어도 저절로 맞는다.
 */
type NestedState = { index?: number; routes?: unknown[] }

function atTabRoot(route: { state?: NestedState } | undefined): boolean {
  const stack = route?.state
  if (!stack?.routes?.length) return true
  return (stack.index ?? stack.routes.length - 1) === 0
}

const TAB_LABEL: Record<keyof RootTabParamList, string> = {
  Home: '홈',
  Competition: '경기',
  Media: '커뮤니티',
  Club: '구단',
  My: '마이',
}

/** 선택된 탭만 색이 차오르고 살짝 떠오른다. 아이콘 없이 텍스트만으로도 상태가 읽히게. */
function TabItem({ focused, label, onPress }: { focused: boolean; label: string; onPress: () => void }) {
  const theme = useTheme()
  const lift = useSharedValue(focused ? 1 : 0)

  React.useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, motion.spring.follow)
  }, [focused, lift])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * lift.value }, { scale: 1 + 0.06 * lift.value }],
  }))

  const dotStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, motion.timing.fast),
    transform: [{ scale: lift.value }],
  }))

  return (
    <PressableScale
      scaleTo={0.92}
      onPress={onPress}
      style={styles.tabItem}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={style}>
        <Text style={[fonts.label, { color: theme.textMuted }, focused && { color: theme.accent }]}>
          {label}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.dot, { backgroundColor: theme.accent }, dotStyle]} />
    </PressableScale>
  )
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const report = useReportTabBarHeight()
  const height = useTabBarHeight()

  /**
   * 탭 루트가 아니면 아래로 밀어 내린다.
   *
   * 안 그리는 것이 아니라 자리를 지킨 채 움직인다. 탭바는 흐름 밖(absolute)이라 여기서
   * 무엇을 하든 화면 높이가 바뀌지 않는다 — 출렁임이 생기지 않는 이유가 그것이다.
   */
  const hide = !atTabRoot(state.routes[state.index])
  const shown = useSharedValue(1)

  useEffect(() => {
    shown.value = withTiming(hide ? 0 : 1, motion.timing.fast)
  }, [hide, shown])

  // 높이를 아직 못 쟀으면 화면 밖까지 넉넉히 민다. 첫 프레임에 반쯤 걸쳐 보이지 않게
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.value) * (height || 200) }],
  }))

  const onLayout = (e: LayoutChangeEvent) => report(e.nativeEvent.layout.height)

  return (
    <Animated.View
      onLayout={onLayout}
      // 내려가 있는 동안에는 눌리지 않는다. 화면 밖이라 안 보일 뿐 살아는 있다
      pointerEvents={hide ? 'none' : 'auto'}
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.divider,
          paddingBottom: Math.max(insets.bottom, spacing['100']),
        },
        slide,
      ]}
    >
      {state.routes.map((route, index) => (
        <TabItem
          key={route.key}
          focused={state.index === index}
          label={TAB_LABEL[route.name as keyof RootTabParamList]}
          onPress={() => {
            /*
              tabPress 는 **이미 열려 있는 탭을 눌러도** 보낸다. 이동은 그다음 줄에서
              가려낸다. 열린 탭에서는 이 이벤트가 목록을 맨 위로 올리는 신호라
              (useTabScrollTop), 이 emit 을 아래 조건 안으로 옮기면 그 동작이 조용히 죽는다.
            */
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (state.index !== index && !event.defaultPrevented) navigation.navigate(route.name)
          }}
        />
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  /**
   * 화면 위에 떠 있다. 흐름에 들어가면 감출 때마다 화면 높이가 바뀌어 목록이 출렁인다.
   * 대신 스크롤 화면이 이 높이만큼 아래를 비운다 (navigation/tabBarHeight.tsx)
   */
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingTop: spacing['150'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: spacing['050'], paddingVertical: spacing['050'] },
  dot: { width: 4, height: 4, borderRadius: cornerRadius['050'] },
})

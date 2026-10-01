import { useCallback, useEffect, useRef, useState } from 'react'
import { type LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { cornerRadius, fonts, motion, spacing, type Theme } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

export interface CategoryTab {
  key: string
  label: string
  /** 자리는 지키되 고를 수 없는 항목. 비어 있다는 사실 자체가 정보일 때 쓴다 */
  disabled?: boolean
}

/**
 * 탭의 무게.
 *
 * 한 화면에서 탭이 두 줄로 겹칠 때(무엇을 볼지 고르는 줄 + 그 안에서 무엇을 볼지 고르는 줄)
 * 둘을 같은 모양으로 그리면 어느 쪽이 상위인지 읽히지 않는다. 색과 크기로 층을 만든다.
 *   primary  채운 알약 + 흰 글자. 화면의 큰 갈래
 *   subtle   옅은 알약 + 강조색 글자. 그 갈래 안에서의 선택
 */
export type TabVariant = 'primary' | 'subtle'

interface Rect {
  x: number
  width: number
}

/**
 * 필터 탭.
 *
 * 선택된 항목 뒤로 알약이 스프링으로 미끄러져 붙는다. 탭을 바꿀 때 내용이 갑자기 갈리는 대신
 * 인디케이터가 먼저 움직여서 무엇이 바뀌는지 눈이 따라갈 시간을 준다.
 *
 * 레이아웃 주의:
 *   - 인디케이터는 탭 행(rowRef)과 같은 좌표계에 있어야 한다. 바깥에 두고 padding 을 더하면
 *     오프셋이 두 번 먹어서 알약이 엉뚱한 자리에 간다.
 *   - 감싸는 View 에 alignItems 를 주지 않으면 ScrollView 높이만큼 늘어나
 *     top/bottom:0 인 인디케이터가 세로로 길게 뻗는다.
 */
/**
 * 탭 글자 색.
 *
 * 갈래가 넷이라(잠김 · 고른 하위 줄 · 고른 윗줄 · 나머지) 한 줄에 이어 붙이면 네 겹이
 * 되어 무엇이 무엇에 딸린 조건인지 안 읽힌다.
 *
 * 잠긴 항목은 투명도만 낮추면 그냥 흐린 글자로 보이므로 색 자체를 한 단 죽인다.
 * 고른 항목은 윗줄에서는 채운 알약 위에 얹히므로 흰 글자, 하위 줄에서는 옅은 알약 위라
 * 강조색 글자다.
 */
function labelColor(theme: Theme, subtle: boolean, active: boolean, disabled?: boolean) {
  if (disabled) return theme.textDisabled
  if (!active) return theme.textMuted
  if (subtle) return theme.accent
  return '#FFFFFF'
}

export function CategoryTabs({
  tabs,
  value,
  onChange,
  variant = 'primary',
  flush = false,
}: {
  tabs: CategoryTab[]
  value: string
  onChange: (key: string) => void
  variant?: TabVariant
  /** 이미 좌우 여백이 있는 자리에 놓을 때. 자기 여백을 빼서 주변과 왼쪽 끝을 맞춘다 */
  flush?: boolean
}) {
  const theme = useTheme()
  const subtle = variant === 'subtle'
  const scrollRef = useRef<ScrollView>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  /** 마지막으로 스크롤을 맞춘 항목. 사용자가 손으로 민 뒤 다시 끌어오지 않으려고 기억해 둔다 */
  const scrolledTo = useRef<string | null>(null)
  const [rects, setRects] = useState<Record<string, Rect>>({})
  const x = useSharedValue(0)
  const width = useSharedValue(0)

  const onTabLayout = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      const { x: lx, width: lw } = e.nativeEvent.layout
      setRects(prev => {
        // 같은 값이면 상태를 갱신하지 않는다. 레이아웃 이벤트가 반복돼도 리렌더가 없다
        if (prev[key]?.x === lx && prev[key]?.width === lw) return prev
        return { ...prev, [key]: { x: lx, width: lw } }
      })
    },
    [],
  )

  const select = useCallback(
    (key: string) => {
      // 눌리지 않게 막아 두지만, 혹시 뚫려도 인디케이터가 잠긴 칸으로 가지 않게 한다
      if (tabs.find(t => t.key === key)?.disabled) return
      onChange(key)
    },
    [tabs, onChange],
  )

  /**
   * 인디케이터는 value 를 따라간다.
   *
   * 누를 때만 옮기면 밖에서 value 가 바뀌었을 때 제자리에 남는다 — 홈의 "전체 순위" 로
   * 들어오면 내용은 순위인데 알약은 일정에 붙어 있고, 활성 글자(흰색)가 회색 배경 위에
   * 놓여 안 보이게 된다. 선택이 어디서 비롯됐든 여기 한 곳에서 맞춘다.
   */
  useEffect(() => {
    const rect = rects[value]
    if (!rect) return
    // 처음 자리를 잡을 때는 애니메이션 없이 놓는다. 화면에 들어오자마자 알약이 날아오면 산만하다
    if (width.value === 0) {
      x.value = rect.x
      width.value = rect.width
      return
    }
    x.value = withSpring(rect.x, motion.spring.follow)
    width.value = withSpring(rect.width, motion.spring.follow)
  }, [value, rects, x, width])

  /**
   * 고른 항목이 화면 밖에 있으면 끌어온다.
   *
   * 달 필터처럼 항목이 열 개를 넘으면 처음 열 때 선택된 항목이 오른쪽 끝에 잘린 채로 있다.
   * 가운데로 맞춰 두면 앞뒤 달이 같이 보여 어디쯤인지 읽힌다.
   */
  useEffect(() => {
    const rect = rects[value]
    if (!rect || viewportWidth === 0 || scrolledTo.current === value) return
    // 탭은 하나씩 측정된다. 다 재기 전에 옮기면 그때까지의 좁은 내용 폭에 맞춰 잘려 버리고,
    // 뒤늦게 폭이 늘어나도 이미 "옮겼다" 고 기억해 다시 시도하지 않는다
    if (Object.keys(rects).length < tabs.length) return
    scrolledTo.current = value
    const centered = rect.x + rect.width / 2 - viewportWidth / 2
    scrollRef.current?.scrollTo({ x: Math.max(0, centered), animated: true })
  }, [value, rects, tabs.length, viewportWidth])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: width.value,
  }))

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, flush && styles.scrollContentFlush]}
      onLayout={e => setViewportWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {/* 인디케이터와 탭이 같은 좌표계를 쓰도록 한 겹으로 묶는다 */}
      <View style={styles.row}>
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: theme.accent },
            subtle && { backgroundColor: theme.accentSoft },
            indicatorStyle,
          ]}
        />
        {tabs.map(tab => {
          const active = tab.key === value
          return (
            <PressableScale
              key={tab.key}
              scaleTo={0.95}
              onPress={() => select(tab.key)}
              onLayout={onTabLayout(tab.key)}
              style={subtle ? styles.tabSubtle : styles.tab}
              disabled={tab.disabled}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: tab.disabled }}
            >
              <Text
                style={[
                  subtle ? fonts.caption : fonts.label,
                  { color: labelColor(theme, subtle, active, tab.disabled) },
                ]}
              >
                {tab.label}
              </Text>
            </PressableScale>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // 가로 ScrollView 는 세로 flex 컨테이너 안에서 남는 높이를 다 먹는다.
  // flexGrow: 0 으로 내용 높이만 차지하게 묶어야 탭이 화면 가운데로 밀리지 않는다.
  scroll: { flexGrow: 0, flexShrink: 0 },
  // alignItems: center 가 없으면 안쪽 View 가 ScrollView 높이까지 늘어난다.
  // 위아래 여백도 여기서 준다 — 화면마다 감싸는 View 에 따로 주면 탭 줄 높이가 화면끼리 달라진다
  scrollContent: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['100'],
    alignItems: 'center',
  },
  scrollContentFlush: { paddingHorizontal: 0 },
  row: { flexDirection: 'row', gap: spacing['050'] },
  tab: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['100'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 하위 줄은 한 치수 작게. 같은 크기면 두 줄이 대등해 보인다 */
  tabSubtle: {
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['075'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: cornerRadius.full,
  },
})

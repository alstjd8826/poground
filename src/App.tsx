import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as ExpoSplashScreen from 'expo-splash-screen'
import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'

import type { Theme } from '@/styles'
import Animated, { FadeOut, ReduceMotion } from 'react-native-reanimated'

import { ThemeProvider, useTheme } from '@/hooks/theme/ThemeProvider'
import { SplashScreen } from '@/components/splash/SplashScreen'
import { RootNavigator } from '@/navigation/RootNavigator'
import { ProfileGate } from '@/navigation/ProfileGate'
import { clearOnViewerChange, persistsAcrossViewers } from '@/hooks/auth/viewerCaches'

/**
 * 네이티브 스플래시(검정 + 엠블럼, app.json 의 expo-splash-screen)를 JS 가 붙을 때까지 붙잡아 둔다.
 * 그래야 네이티브 -> JS 스플래시로 넘어가는 사이에 빈 화면이 번쩍이지 않는다.
 */
ExpoSplashScreen.preventAutoHideAsync().catch(() => {
  // 이미 숨겨진 뒤에 호출되면 거부된다. 앱을 막을 이유는 없다.
})

/**
 * 저장해 둔 캐시를 며칠씩 쓰지는 않는다.
 *
 * 하루가 지난 순위·일정은 어차피 다시 받아야 하고, 그동안 앱이 바뀌었을 수도 있다.
 * 오래된 것을 되살려 잠깐 보여 주느니 스켈레톤을 보이는 편이 낫다.
 */
const CACHE_MAX_AGE = 24 * 60 * 60_000

/**
 * 저장된 캐시를 통째로 버리는 열쇠.
 *
 * 캐시에는 **그때의 모델 모양** 이 그대로 굳어 있다. 모델을 바꾸고 이 값을 그대로 두면
 * 옛 모양이 새 코드로 복원되어, 없는 필드를 읽거나 타입이 어긋난 채 돌아간다.
 * 모델(models/kleague 의 인터페이스)이나 매퍼가 만드는 모양을 바꿨으면 여기를 올릴 것.
 *
 * **질의의 모양이 바뀔 때도 올려야 한다.** 댓글을 useQuery 에서 useInfiniteQuery 로
 * 옮겼더니 기기에 남아 있던 평평한 배열이 그대로 복원됐고, react-query 가 그 안에서
 * `data.pages.length` 를 읽다 터졌다. 앱을 새로 깐 사람에게는 안 보이고 쓰던 사람에게만
 * 나는 종류라 개발 중에는 놓치기 쉽다.
 *
 *   v1 -> v2  댓글을 쪽 단위(useInfiniteQuery)로 받도록 바꿈
 */
const CACHE_SCHEMA = 'v2'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 수집이 주기적으로 도는 데이터라 화면 복귀마다 다시 받을 이유가 없다
      refetchOnWindowFocus: false,
      retry: 2,
      /**
       * 저장해 둔 것을 되살리려면 메모리에서 먼저 버리지 않아야 한다.
       * react-query 가 gcTime >= maxAge 를 요구한다 — 짧으면 복원해 놓고 곧 비운다.
       */
      gcTime: CACHE_MAX_AGE,
    },
  },
})

// 계정이 바뀌면 보는 사람에 딸린 캐시(내 좋아요·차단 거르기)를 비운다. 앱 내내 한 번만 건다
clearOnViewerChange(queryClient)

/**
 * 쿼리 캐시를 기기에 남긴다.
 *
 * 없으면 앱을 껐다 켤 때마다 목록을 처음부터 다시 받는다. 수집이 30분·1시간 주기로 도는
 * 데이터라 방금 받은 것과 다를 것이 거의 없는데도 매번 스켈레톤부터 보게 된다.
 *
 * 저장은 JSON 이라 **캐시에 담기는 값은 JSON 으로 오갈 수 있어야 한다.** Date 객체를
 * 넣으면 복원될 때 문자열이 되어 조용히 깨진다. 그래서 Match.kickoffAtMs 는 밀리초다.
 */
const persister = createAsyncStoragePersister({ storage: AsyncStorage })

/** 보는 사람에 딸린 캐시(내 좋아요·차단 거르기·신고함)는 기기에 남기지 않는다 (viewerCaches) */
const dehydrateOptions = {
  shouldDehydrateQuery: (query: Parameters<typeof defaultShouldDehydrateQuery>[0]) =>
    defaultShouldDehydrateQuery(query) && persistsAcrossViewers(query.queryKey),
}

/** JS 스플래시가 최소한 이만큼은 보이게 한다. 데이터가 빨리 와도 화면이 번쩍이지 않도록. */
const MIN_SPLASH_MS = 1400

function Shell() {
  const theme = useTheme()
  const [introDone, setIntroDone] = useState(false)
  const [minElapsed, setMinElapsed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  // JS 스플래시가 첫 프레임을 그린 뒤에 네이티브 스플래시를 걷는다. 순서가 반대면 검은 틈이 보인다.
  const onLayout = useCallback(() => {
    ExpoSplashScreen.hideAsync().catch(() => {})
  }, [])

  const onIntroFinish = useCallback(() => setIntroDone(true), [])
  const showSplash = !(introDone && minElapsed)

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]} onLayout={onLayout}>
      {/*
        테마가 들고 있는 barStyle 을 그대로 쓴다. 전에는 key === 'home' 으로 판단해서
        골키퍼(어두운 테마)에 검은 시계가 얹혀 안 보였다. 어두운 테마가 둘이라
        이름으로 가르면 하나를 더할 때마다 여기도 고쳐야 한다.
        스플래시는 항상 검정 바탕이라 그때만 light 로 고정한다.
      */}
      <StatusBar style={statusBarStyle(showSplash, theme.barStyle)} />

      {/* 내비게이션을 먼저 마운트해 두면 스플래시가 걷힐 때 첫 화면이 이미 그려져 있다 */}
      <RootNavigator />

      {/* 첫 로그인이면 닉네임을 받을 때까지 앱을 덮는다 */}
      <ProfileGate />

      {showSplash && (
        <Animated.View
          style={StyleSheet.absoluteFill}
          exiting={FadeOut.duration(320).reduceMotion(ReduceMotion.System)}
          pointerEvents="none"
        >
          <SplashScreen onFinish={onIntroFinish} />
        </Animated.View>
      )}
    </View>
  )
}

/**
 * 상태바 글자 색.
 *
 * 테마 이름으로 가르지 않는다 — 어두운 테마가 둘(홈·골키퍼)이라 하나 더할 때마다 여기도
 * 고쳐야 한다. 스플래시는 늘 검정 바탕이라 그때만 고정한다.
 */
function statusBarStyle(splash: boolean, barStyle: Theme['barStyle']) {
  if (splash) return 'light'
  if (barStyle === 'light-content') return 'light'
  return 'dark'
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: CACHE_SCHEMA, dehydrateOptions }}
        >
          <ThemeProvider>
            <Shell />
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})

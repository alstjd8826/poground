/**
 * 탭 다섯과 그 첫 화면.
 *
 * 탭 하나는 스택 하나다. 첫 화면만 다르고 상세는 detailScreens 로 공유한다.
 * 화면에 내비게이션을 물려주는 일만 여기서 하고, 화면은 콜백만 받는다 — 그 덕에
 * 화면을 시험할 때 내비게이터를 세우지 않아도 된다.
 */
import React, { useCallback, useLayoutEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'

import { HomeScreen } from '@/screens'
import { CompetitionScreen, type CompetitionTab as CompetitionTabKey } from '@/screens/CompetitionScreen'
import { CommunityScreen } from '@/screens/CommunityScreen'
import { ComposeButton } from '@/components/community/ComposeButton'
import { useAuth } from '@/hooks/auth/useAuth'
import { ClubScreen } from '@/screens/ClubScreen'
import { MyScreen } from '@/screens/MyScreen'
import { withBoundary } from '@/navigation/ScreenBoundary'
import { TagScopeProvider } from '@/utils/sharedTransition'
import type { Player } from '@/models/kleague'
import type { Post } from '@/models/community'
import { Stack, useStackOptions } from './stack'
import { detailScreens } from './detailScreens'
import {
  type SeeAllKey,
  seeAllDestination,
  useOpenArticle,
  useOpenMatch,
  useOpenVideo,
  useTabParam,
} from './openers'
import { useTabBarHeight } from './tabBarHeight'
import type { DetailNavigation } from './types'

function HomeMain() {
  const navigation = useNavigation()
  const openMatch = useOpenMatch()
  const openArticle = useOpenArticle()
  const openVideo = useOpenVideo()

  const onSeeAll = useCallback(
    (key: SeeAllKey) => {
      const to = seeAllDestination(key)
      // 소식·영상은 탭이 없다. 홈 스택 위에 목록을 밀어 연다
      if (to.kind === 'stack') {
        ;(navigation as unknown as { navigate: (name: string) => void }).navigate(to.screen)
        return
      }
      // 스택이 탭 안에 들어갔으므로 탭 전환은 부모 내비게이터가 맡는다.
      // 탭 -> 그 안의 스택 -> 스택의 첫 화면까지 한 번에 지목한다. 타입을 세우려면 탭·스택·화면
      // 세 벌의 ParamList 가 필요한데, 목적지가 이 함수 하나뿐이라 여기서만 느슨하게 넘긴다
      const parent = navigation.getParent() as
        { navigate: (name: string, params?: object) => void } | undefined
      parent?.navigate(to.tab, { screen: to.screen, params: { tab: to.inner } })
    },
    [navigation],
  )

  return (
    <HomeScreen
      onSeeAll={onSeeAll}
      onOpenArticle={openArticle}
      onOpenVideo={openVideo}
      onOpenMatch={openMatch}
    />
  )
}

function CompetitionMain() {
  const [tab, setTab] = useTabParam<CompetitionTabKey>('matches')
  return <CompetitionScreen onOpenMatch={useOpenMatch()} tab={tab} onTabChange={setTab} />
}

function MediaMain() {
  const navigation = useNavigation<DetailNavigation>()
  const { session } = useAuth()
  const openPost = useCallback((post: Post) => navigation.navigate('Post', { postId: post.id }), [navigation])
  // 비로그인이면 로그인부터. 로그인하고 돌아오면 다시 누르면 된다
  const compose = useCallback(
    () => (session ? navigation.navigate('PostComposer', {}) : navigation.navigate('Login')),
    [navigation, session],
  )
  const edit = useCallback(
    (post: Post) => navigation.navigate('PostComposer', { postId: post.id }),
    [navigation],
  )
  const requireLogin = useCallback(() => navigation.navigate('Login'), [navigation])
  // 글쓰기는 헤더 오른쪽 연필. 떠 있는 단추는 마지막 카드와 바탕을 가렸다 (2026-09-29)
  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <ComposeButton onPress={compose} /> })
  }, [navigation, compose])
  return (
    <CommunityScreen
      onOpenPost={openPost}
      onOpenMatch={useOpenMatch()}
      onEditPost={edit}
      onRequireLogin={requireLogin}
    />
  )
}

function ClubMain() {
  const navigation = useNavigation<DetailNavigation>()

  const openPlayer = useCallback(
    (player: Player) => navigation.navigate('Player', { playerId: player.playerId!, name: player.name }),
    [navigation],
  )
  return <ClubScreen onOpenPlayer={openPlayer} />
}

function MyMain() {
  const navigation = useNavigation<DetailNavigation>()
  const openTheme = useCallback(() => navigation.navigate('ThemeSettings'), [navigation])
  const openCardMaker = useCallback(() => navigation.navigate('CardCollection'), [navigation])
  const openAccount = useCallback(() => navigation.navigate('Account'), [navigation])
  const openLogin = useCallback(() => navigation.navigate('Login'), [navigation])
  const openReports = useCallback(() => navigation.navigate('ReportInbox'), [navigation])
  const openAttendance = useCallback(() => navigation.navigate('Attendance'), [navigation])
  const openTerms = useCallback(() => navigation.navigate('Terms'), [navigation])
  const openPrivacy = useCallback(() => navigation.navigate('Privacy'), [navigation])
  const openNotifications = useCallback(() => navigation.navigate('NotificationSettings'), [navigation])
  return (
    <MyScreen
      onOpenTheme={openTheme}
      onOpenCardMaker={openCardMaker}
      onOpenAccount={openAccount}
      onOpenLogin={openLogin}
      onOpenReports={openReports}
      onOpenAttendance={openAttendance}
      onOpenTerms={openTerms}
      onOpenPrivacy={openPrivacy}
      onOpenNotifications={openNotifications}
    />
  )
}

/** 탭 하나 = 스택 하나. 첫 화면만 다르고 상세는 공유한다. */
function tabStack(name: string, title: string, Component: React.ComponentType) {
  const Bounded = withBoundary(Component)

  /**
   * 탭의 첫 화면은 탭바 높이만큼 아래를 비운다.
   *
   * 탭바는 화면 흐름에 들어가지 않고 위에 떠 있다 (TabBar 주석). 비우지 않으면 목록
   * 마지막 줄이 탭바 뒤에 깔려 끝까지 내려도 안 보인다.
   *
   * 화면마다 적지 않고 여기 한 번 두는 이유는 두 가지다. 새 탭 화면을 만들 때 저절로
   * 따라오고, 화면 안에서 어디에 줄지 — 스크롤 콘텐츠냐 바깥 상자냐 — 고민할 일이
   * 없어진다. 순위표는 콘텐츠 스타일이 카드 그 자체라 거기에 넣으면 카드가 부푼다.
   *
   * 상세 화면에는 주지 않는다. 그쪽은 탭바가 내려가 있어 비울 것이 없다.
   */
  function TabRoot() {
    const bottom = useTabBarHeight()
    return (
      <View style={[styles.root, { paddingBottom: bottom }]}>
        <Bounded />
      </View>
    )
  }

  return function TabStack() {
    const options = useStackOptions()
    return (
      // 탭마다 공유 전환 태그의 범위를 가른다. 탭은 계속 떠 있어서 범위가 같으면
      // 두 탭에 같은 태그가 동시에 존재하게 된다 (TagScopeProvider 주석 참고)
      <TagScopeProvider value={name}>
        <Stack.Navigator screenOptions={options}>
          <Stack.Screen name={name} component={TabRoot} options={{ title }} />
          {detailScreens()}
        </Stack.Navigator>
      </TagScopeProvider>
    )
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})

export const HomeTab = tabStack('HomeMain', '포그라운드', HomeMain)
export const CompetitionTab = tabStack('CompetitionMain', '경기', CompetitionMain)
export const MediaTab = tabStack('MediaMain', '커뮤니티', MediaMain)
export const ClubTab = tabStack('ClubMain', '포항 스틸러스', ClubMain)
export const MyTab = tabStack('MyMain', '마이', MyMain)

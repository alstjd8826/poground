import { Stack } from './stack'
import { ScreenBoundary } from '@/navigation/ScreenBoundary'
import { ThemeScreen } from '@/screens/ThemeScreen'
import { WebPageScreen } from '@/screens/WebPageScreen'
import { TermsScreen } from '@/screens/TermsScreen'
import { PrivacyScreen } from '@/screens/PrivacyScreen'
import { NotificationSettingsScreen } from '@/screens/NotificationSettingsScreen'
import { VideoPlayerScreen } from '@/screens/VideoPlayerScreen'
import {
  AttendanceRoute,
  ShareCardRoute,
  MatchDetailRoute,
  NewsDetailRoute,
  NewsListRoute,
  PlayerRoute,
  PostRoute,
  VideoListRoute,
} from './routes/detail'
import { CardCollectionRoute, CardMakerRoute } from './routes/card'
import { PostComposerRoute } from './routes/community'
import {
  AccountRoute,
  BlockedUsersRoute,
  HandleRoute,
  LoginRoute,
  NicknameRoute,
  ReportInboxRoute,
} from './routes/account'

/** 탭마다 반복되는 상세 화면 등록을 한곳에 모은다 */
export function detailScreens() {
  return (
    <>
      <Stack.Screen
        name="MatchDetail"
        // 탭 이름이 "경기" 라 헤더까지 "경기" 면 같은 말이 두 번 뜬다. 라운드로 어느 경기인지 알린다
        options={({ route }: any) => ({ title: route.params?.round ? `${route.params.round}R` : '경기' })}
        children={({ route }: any) => (
          <ScreenBoundary>
            <MatchDetailRoute matchId={route.params.matchId} round={route.params.round} />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Player"
        options={({ route }: any) => ({ title: route.params?.name ?? '선수' })}
        children={({ route }: any) => (
          <ScreenBoundary>
            <PlayerRoute playerId={route.params.playerId} />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="NewsDetail"
        options={{ title: '소식' }}
        children={({ route }: any) => (
          <ScreenBoundary>
            <NewsDetailRoute seq={route.params.seq} fallbackTitle={route.params.title} />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Attendance"
        options={{ title: '직관 기록' }}
        children={() => (
          <ScreenBoundary>
            <AttendanceRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="ShareCard"
        options={({ route }: any) => ({ title: route.params?.gameId ? '직관 인증 카드' : '승리요정 카드' })}
        children={({ route }: any) => (
          <ScreenBoundary>
            <ShareCardRoute gameId={route.params?.gameId} />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Post"
        options={{ title: '글' }}
        children={({ route }: any) => (
          <ScreenBoundary>
            <PostRoute postId={route.params.postId} />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="PostComposer"
        options={({ route }: any) => ({ title: route.params?.postId ? '글 고치기' : '글쓰기' })}
        children={({ route }: any) => (
          <ScreenBoundary>
            <PostComposerRoute postId={route.params?.postId} match={route.params?.match} />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="NewsList"
        options={{ title: '소식' }}
        children={() => (
          <ScreenBoundary>
            <NewsListRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="VideoList"
        options={{ title: '영상' }}
        children={() => (
          <ScreenBoundary>
            <VideoListRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="CardCollection"
        options={{ title: '나만의 카드' }}
        children={() => (
          <ScreenBoundary>
            <CardCollectionRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="CardMaker"
        options={({ route }: any) => ({ title: route.params?.id ? '카드 고치기' : '카드 만들기' })}
        children={({ route }: any) => (
          <ScreenBoundary>
            <CardMakerRoute id={route.params?.id} />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Account"
        options={{ title: '내 계정' }}
        children={() => (
          <ScreenBoundary>
            <AccountRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Login"
        options={{ title: '로그인' }}
        children={() => (
          <ScreenBoundary>
            <LoginRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Nickname"
        options={{ title: '닉네임' }}
        children={() => (
          <ScreenBoundary>
            <NicknameRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Handle"
        options={{ title: '아이디' }}
        children={() => (
          <ScreenBoundary>
            <HandleRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Terms"
        options={{ title: '이용약관' }}
        children={() => (
          <ScreenBoundary>
            <TermsScreen />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="NotificationSettings"
        options={{ title: '알림' }}
        children={() => (
          <ScreenBoundary>
            <NotificationSettingsScreen />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="Privacy"
        options={{ title: '개인정보 처리방침' }}
        children={() => (
          <ScreenBoundary>
            <PrivacyScreen />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="BlockedUsers"
        options={{ title: '차단한 사용자' }}
        children={() => (
          <ScreenBoundary>
            <BlockedUsersRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="ReportInbox"
        options={{ title: '신고함' }}
        children={() => (
          <ScreenBoundary>
            <ReportInboxRoute />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="ThemeSettings"
        options={{ title: '테마' }}
        children={() => (
          <ScreenBoundary>
            <ThemeScreen />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="WebPage"
        options={({ route }: any) => ({
          title: route.params?.title ?? '원문',
          /*
            옆에서 미는 대신 아래에서 올라와 **얹힌다.**
            원문은 우리 화면이 아니라 잠깐 들렀다 오는 자리다. 카드가 한 장 겹쳐 쌓이고
            뒤 화면이 살짝 물러나 있으면 "여기가 끝이 아니라 위에 얹힌 것" 으로 읽혀서,
            아래로 쓸어 닫는 몸짓도 자연스럽게 따라온다.
          */
          presentation: 'modal' as const,
        })}
        children={({ route }: any) => (
          <ScreenBoundary>
            <WebPageScreen url={route.params.url} label={route.params.title} />
          </ScreenBoundary>
        )}
      />
      <Stack.Screen
        name="VideoPlayer"
        options={{ title: '영상' }}
        children={({ route }: any) => (
          <ScreenBoundary>
            <VideoPlayerScreen
              youtubeId={route.params.youtubeId}
              title={route.params.title}
              category={route.params.category}
              publishedOn={route.params.publishedOn}
            />
          </ScreenBoundary>
        )}
      />
    </>
  )
}

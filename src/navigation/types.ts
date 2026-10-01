import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import type { PostMatchKey } from '@/models/community'

/**
 * 탭마다 스택을 하나씩 둔다.
 *
 * shared element 전환은 같은 native stack 안에서만 동작한다.
 * React Navigation 문서가 못 박은 제약이다 — "Drawer and bottom tabs navigators are incompatible".
 * 탭 위에 스택을 얹는 구조(Stack > Tabs > 화면)로는 카드에서 상세로 원소가 이어지지 않는다.
 * 탭 안에 스택을 넣어야(Tabs > 탭 > Stack > 화면) 출발과 도착이 같은 스택에 놓인다.
 */
export type DetailParamList = {
  MatchDetail: { matchId: number; round: number | null }
  /** 남의 글은 남의 자리에서 읽는다. 원문을 앱 안에 띄우는 화면 */
  WebPage: { url: string; title: string }
  NewsDetail: { seq: number; title?: string }
  VideoPlayer: { youtubeId: string; title?: string; category?: string | null; publishedOn?: string | null }
  /** 선수는 캐시에서 되찾는다. 객체를 파라미터로 넘기면 상태 복원 시 모양이 깨진다 */
  Player: { playerId: string; name?: string }
  ThemeSettings: undefined
  CardMaker: { id?: string }
  CardCollection: undefined
  /** 게시글. 객체 대신 id 로 넘기고 캐시에서 되찾는다 */
  Post: { postId: string }
  /** 글쓰기·고치기. postId 가 있으면 고치기, match 가 있으면 그 경기의 직관 글 */
  PostComposer: { postId?: string; match?: PostMatchKey }
  /** 소식 전체. 탭이 아니라 홈의 "더 보기" 로 들어온다 */
  NewsList: undefined
  /** 영상 전체. 소식과 같다 */
  VideoList: undefined
  /** 내가 다녀온 경기. 마이 탭에서 들어온다 */
  Attendance: undefined
  /** 공유 카드 미리보기. 경기 번호가 있으면 그 경기의 직관 인증 카드, 없으면 승리요정 카드 */
  ShareCard: { gameId?: number } | undefined
  Account: undefined
  Login: undefined
  Nickname: undefined
  Handle: undefined
  /** 신고함. 관리자만 들어오는 자리라 마이 탭에서도 관리자에게만 보인다 */
  ReportInbox: undefined
  /** 차단한 사용자. 내 계정에서 들어온다 */
  BlockedUsers: undefined
  /** 이용약관 읽기. 마이 탭에서 들어온다 (동의는 ProfileGate 가 받는다) */
  Terms: undefined
  /** 알림 설정. 마이 탭에서 들어온다 */
  NotificationSettings: undefined
  /** 개인정보 처리방침 읽기. 마이 탭에서 들어온다 */
  Privacy: undefined
}

export type RootTabParamList = {
  Home: undefined
  Competition: undefined
  Media: undefined
  Club: undefined
  My: undefined
}

/** 어느 탭에서 열든 상세 화면은 같으므로 내비게이션 타입도 하나로 쓴다 */
export type DetailNavigation = NativeStackNavigationProp<DetailParamList>

import { useCallback, useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'

import { PlayerScreen } from '@/screens/PlayerScreen'
import { NewsDetailScreen } from '@/screens/NewsDetailScreen'
import { MatchDetailScreen } from '@/screens/MatchDetailScreen'
import { AttendanceScreen } from '@/screens/AttendanceScreen'
import { PostDetailScreen } from '@/screens/PostDetailScreen'
import { NewsScreen } from '@/screens/NewsScreen'
import { VideosScreen } from '@/screens/VideosScreen'
import { useMatches, useSquad } from '@/hooks/query/useKleague'
import { openExternal } from '@/utils/openExternal'
import { type Match, ticketUrlOf } from '@/models/kleague'
import type { Post } from '@/models/community'
import { attendanceEntries, attendanceKeyOf, sameKey } from '@/models/attendance'
import { fairyCardData, matchProofData } from '@/models/shareCard'
import { FairyCard } from '@/components/share/FairyCard'
import { MatchProofCard } from '@/components/share/MatchProofCard'
import { useMyAttendancePosts, usePhotoAt } from '@/hooks/community/useCommunity'
import { ShareCardScreen } from '@/screens/ShareCardScreen'
import { InlineState } from '@/components/feedback/States'
import { useAuth } from '@/hooks/auth/useAuth'
import { useProfile } from '@/hooks/auth/useProfile'
import { useAttendances } from '@/hooks/attendance/useAttendances'
import { SEASON_YEAR } from '@/config/env'
import { useOpenArticle, useOpenVideo } from '../openers'
import type { DetailNavigation } from '../types'

export function PlayerRoute({ playerId }: { playerId: string }) {
  const navigation = useNavigation<DetailNavigation>()
  // 선수 객체는 스쿼드 캐시에서 되찾는다. 목록을 지나온 뒤라 이미 들어와 있다
  const { data: squad } = useSquad()
  // 댓글을 쓰려면 로그인이 필요하다. 규격대로 된 카카오 버튼이 있는 화면으로 보낸다
  const requireLogin = useCallback(() => navigation.navigate('Login'), [navigation])
  return <PlayerScreen player={squad?.find(p => p.playerId === playerId)} onRequireLogin={requireLogin} />
}

export function NewsDetailRoute({ seq, fallbackTitle }: { seq: number; fallbackTitle?: string }) {
  const navigation = useNavigation<DetailNavigation>()
  // 댓글을 쓰려면 로그인이 필요하다. 규격대로 된 카카오 버튼이 있는 화면으로 보낸다
  const requireLogin = useCallback(() => navigation.navigate('Login'), [navigation])
  // 원문은 화면을 하나 더 밀어 띄운다. 뒤로 가기가 자연스럽고, 기사 안에서 링크를 타고
  // 들어가도 돌아올 길이 남는다
  const openOriginal = useCallback(
    (url: string, title: string) => navigation.navigate('WebPage', { url, title }),
    [navigation],
  )
  return (
    <NewsDetailScreen
      seq={seq}
      fallbackTitle={fallbackTitle}
      onRequireLogin={requireLogin}
      onOpenOriginal={openOriginal}
    />
  )
}

export function MatchDetailRoute({ matchId, round }: { matchId: number; round: number | null }) {
  const navigation = useNavigation<DetailNavigation>()
  const openVideo = useOpenVideo()
  // 경기 객체를 라우트 파라미터로 넘기면 상태 복원 시 모양이 깨진다. ID 로 넘기고 캐시에서 되찾는다.
  const { data: matches } = useMatches()
  const match = matches?.find(m => m.id === matchId)
  // 예매는 앱을 떠나는 일이라 라우트가 맡는다. 화면은 "눌렸다" 만 알려 준다
  const openTicket = useCallback((m: Match) => {
    const url = ticketUrlOf(m)
    if (url) openExternal(url, '티켓 예매')
  }, [])
  // 댓글을 쓰려면 로그인이 필요하다. 규격대로 된 카카오 버튼이 있는 화면으로 보낸다
  const requireLogin = useCallback(() => navigation.navigate('Login'), [navigation])
  // 직관 사진은 커뮤니티 글로 남긴다. 글쓰기 화면이 이 경기의 #직관·경기 태그를 채운다
  const writePost = useCallback(
    (m: Match) => navigation.navigate('PostComposer', { match: attendanceKeyOf(m) }),
    [navigation],
  )
  const openPost = useCallback((post: Post) => navigation.navigate('Post', { postId: post.id }), [navigation])
  const editPost = useCallback(
    (post: Post) => navigation.navigate('PostComposer', { postId: post.id }),
    [navigation],
  )
  // 끝난 경기를 직관했다고 표시했으면 인증 카드를 만들어 나눈다
  const shareProof = useCallback(
    (m: Match) => navigation.navigate('ShareCard', { gameId: m.id }),
    [navigation],
  )
  return (
    <MatchDetailScreen
      onWritePost={writePost}
      onShareProof={shareProof}
      onOpenPost={openPost}
      onEditPost={editPost}
      match={match}
      round={round}
      onOpenVideo={openVideo}
      onOpenTicket={openTicket}
      onRequireLogin={requireLogin}
    />
  )
}

export function AttendanceRoute() {
  const navigation = useNavigation<DetailNavigation>()
  const openPost = useCallback((post: Post) => navigation.navigate('Post', { postId: post.id }), [navigation])
  // 글 없이 체크만 한 경기에서 쓰면 그 경기 태그가 채워진 글쓰기로 간다
  const writePost = useCallback(
    (m: Match) => navigation.navigate('PostComposer', { match: attendanceKeyOf(m) }),
    [navigation],
  )
  const shareFairy = useCallback(() => navigation.navigate('ShareCard'), [navigation])
  return <AttendanceScreen onOpenPost={openPost} onWritePost={writePost} onShareFairy={shareFairy} />
}

/**
 * 공유 카드 미리보기. 경기 번호가 오면 그 경기의 직관 인증 카드, 없으면 시즌 승리요정 카드다.
 * 카드에 담을 것은 직관 기록·경기 상세와 같은 곳(내 직관 표시, 경기 목록, 내 직관 글)에서 센다.
 */
export function ShareCardRoute({ gameId }: { gameId?: number }) {
  const { session } = useAuth()
  const { profile } = useProfile(session)
  const handle = profile?.handle ?? null
  if (gameId !== undefined) return <MatchProofRoute gameId={gameId} handle={handle} />
  return <FairyRoute handle={handle} />
}

function FairyRoute({ handle }: { handle: string | null }) {
  const { rows } = useAttendances()
  const { data: matches } = useMatches()
  const data = useMemo(() => fairyCardData(attendanceEntries(rows, matches ?? [])), [rows, matches])
  if (!data) return <InlineState message="끝난 직관 경기가 있어야 카드를 만들 수 있습니다" />
  return (
    <ShareCardScreen
      title="승리요정 카드"
      renderCard={ref => <FairyCard ref={ref} data={data} handle={handle} season={SEASON_YEAR} />}
    />
  )
}

function MatchProofRoute({ gameId, handle }: { gameId: number; handle: string | null }) {
  const { data: matches } = useMatches()
  const { posts } = useMyAttendancePosts()
  const match = matches?.find(m => m.id === gameId)
  const data = useMemo(() => (match ? matchProofData(match) : null), [match])
  // 그 경기에 쓴 내 직관 글 중 사진이 있는 가장 최근 글의 첫 장. 없으면 빨강 바탕
  const photoPath = useMemo(() => {
    if (!match) return null
    const key = attendanceKeyOf(match)
    const post = posts.find(p => p.match && sameKey(p.match, key) && p.photos.length > 0)
    return post ? ([...post.photos].sort((a, b) => a.position - b.position)[0]?.path ?? null) : null
  }, [match, posts])
  const photoUri = usePhotoAt(photoPath)
  if (!data) return <InlineState message="끝난 경기만 인증 카드를 만들 수 있습니다" />
  return (
    <ShareCardScreen
      title="직관 인증 카드"
      renderCard={ref => <MatchProofCard ref={ref} data={data} handle={handle} photoUri={photoUri} />}
    />
  )
}

export function PostRoute({ postId }: { postId: string }) {
  const navigation = useNavigation<DetailNavigation>()
  const requireLogin = useCallback(() => navigation.navigate('Login'), [navigation])
  const edit = useCallback(
    (post: Post) => navigation.navigate('PostComposer', { postId: post.id }),
    [navigation],
  )
  const deleted = useCallback(() => navigation.goBack(), [navigation])
  return <PostDetailScreen postId={postId} onRequireLogin={requireLogin} onEdit={edit} onDeleted={deleted} />
}

export function NewsListRoute() {
  return <NewsScreen onOpenArticle={useOpenArticle()} />
}

export function VideoListRoute() {
  return <VideosScreen onOpenVideo={useOpenVideo()} />
}

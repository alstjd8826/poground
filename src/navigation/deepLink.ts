import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { createNavigationContainerRef } from '@react-navigation/native'

import type { CommentSubject } from '@/repositories/comment/remote'

/**
 * 내비게이션을 바깥에서 부르기 위한 손잡이.
 *
 * 딥링크는 **화면이 그려지기 전에** 도착한다. 앱이 꺼져 있을 때 링크를 누르면 주소가
 * 먼저 오고 내비게이터는 그 뒤에 선다. 훅으로는 그 시점을 잡을 수 없어 ref 로 둔다.
 */
export const navigationRef = createNavigationContainerRef()

/**
 * 신고 메일에 싣는 주소. 서버(notify-report)가 만드는 모양과 **같아야 한다**.
 *
 * 스킴은 poground 다(2026-09-29 바꿈). 이미 나간 메일의 옛 steelers:// 링크도 읽는다 — 앱은 두 스킴을
 * 다 받는다(app.json). 메일에는 이 주소를 직접 싣지 않고 https 로 거쳐 온다(open-link 함수).
 */
export function commentUrl(subject: CommentSubject): string {
  return `${COMMENT_PREFIX}?type=${subject.type}&id=${encodeURIComponent(subject.id)}`
}

const COMMENT_PREFIX = 'poground://comment'
/** 옛 스킴. 2026-09-29 전에 나간 신고 메일의 링크 */
const LEGACY_COMMENT_PREFIX = 'steelers://comment'

/**
 * 댓글이 달린 화면은 탭마다 흩어져 있다.
 *
 * 상세 화면은 모든 탭의 스택에 등록돼 있어서 아무 탭에서나 열 수 있지만, 내용에 맞는
 * 탭에서 여는 편이 낫다 — 닫고 나왔을 때 엉뚱한 탭에 서 있지 않는다.
 */
const TAB: Record<CommentSubject['type'], string> = {
  match: 'Competition',
  news: 'Home',
  player: 'Club',
  post: 'Media',
}

function screenFor(subject: CommentSubject) {
  if (subject.type === 'post') return { screen: 'Post', params: { postId: subject.id } }
  if (subject.type === 'match') {
    // 회차는 주소에 없다. 상세 화면이 null 을 받아 스스로 채우므로 지어내지 않는다
    return { screen: 'MatchDetail', params: { matchId: Number(subject.id), round: null } }
  }
  if (subject.type === 'news') return { screen: 'NewsDetail', params: { seq: Number(subject.id) } }
  return { screen: 'Player', params: { playerId: subject.id } }
}

const isSubjectType = (v: unknown): v is CommentSubject['type'] =>
  v === 'match' || v === 'player' || v === 'news' || v === 'post'

/**
 * 주소에서 어느 댓글 자리인지 읽어 낸다. 우리가 아는 모양이 아니면 null 이다.
 *
 * 로그인 콜백(steelers://auth/callback)도 같은 스킴으로 돌아오지만 그쪽은 인앱 브라우저가
 * 스스로 받는다. 여기서 건드리면 로그인이 두 번 처리된다.
 *
 * 화면을 여는 일과 나눠 둔 이유는 이 부분만 따로 시험하기 위해서다 — 서버가 만드는
 * 주소와 여기서 읽는 모양이 어긋나면 링크가 조용히 아무 일도 안 한다.
 */
export function parseCommentUrl(url: string): CommentSubject | null {
  /*
    expo-linking 의 parse 를 쓰지 않는다. 그쪽은 Expo 의 호스트 주소를 먼저 알아내려
    들어서 시험 환경에서 그대로 터지고, 우리가 만든 주소는 모양이 하나뿐이라 그만한
    장치가 필요 없다.
  */
  const prefix = [COMMENT_PREFIX, LEGACY_COMMENT_PREFIX].find(p => url.startsWith(`${p}?`))
  if (!prefix) return null
  const params = new URLSearchParams(url.slice(prefix.length + 1))

  const type = params.get('type')
  const id = params.get('id')
  if (!isSubjectType(type) || id === null || id === '') return null
  return { type, id }
}

/** 주소 하나를 화면으로 옮긴다. 열지 못했으면 false */
export function openFromUrl(url: string): boolean {
  const subject = parseCommentUrl(url)
  if (!subject) return false
  const { type } = subject

  if (!navigationRef.isReady()) return false
  const { screen, params } = screenFor(subject)
  // 탭 안의 스택으로 들어가는 길이라 타입을 좁혀 적기 어렵다. 값은 위에서 다 가렸다
  const navigate = navigationRef.navigate as unknown as (name: string, params: unknown) => void
  // initial: false — 탭의 첫 화면을 밑에 깔고 그 위에 연다. 안 깔면 앱을 링크로 켰을 때(또는 그 탭을 아직 안
  // 열었을 때) 탭 스택이 상세 하나뿐이라 뒤로 갈 곳이 없었다 — 커뮤니티 글에서 피드로 못 나갔다 (2026-09-29)
  navigate(TAB[type], { screen, params, initial: false })
  return true
}

/**
 * 앱이 꺼져 있다 열린 경우와 떠 있는 동안 링크가 온 경우를 모두 받는다.
 *
 * 내비게이터가 아직 안 섰으면 잠시 미룬다. 앱을 링크로 처음 켤 때는 주소가 먼저
 * 도착하는데, 그때 그냥 버리면 링크가 아무 일도 안 한 것처럼 보인다.
 */
export function useDeepLinks(): void {
  useEffect(() => {
    let alive = true

    const handle = (url: string | null) => {
      if (!alive || !url) return
      if (openFromUrl(url)) return
      // 아직 준비 전이면 한 박자 뒤에 한 번만 더 본다
      setTimeout(() => {
        if (alive) openFromUrl(url)
      }, 300)
    }

    void Linking.getInitialURL().then(handle)
    const sub = Linking.addEventListener('url', e => handle(e.url))
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
}

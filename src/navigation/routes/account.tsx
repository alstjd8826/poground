import { useCallback, useLayoutEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'

import { HeaderAction, type SaveAction } from '@/components/foundation/HeaderAction'
import { AccountScreen } from '@/screens/AccountScreen'
import { LoginScreen } from '@/screens/LoginScreen'
import { NicknameScreen } from '@/screens/NicknameScreen'
import { HandleScreen } from '@/screens/HandleScreen'
import { ReportInboxScreen } from '@/screens/ReportInboxScreen'
import { BlockedUsersScreen } from '@/screens/BlockedUsersScreen'
import type { Report } from '@/repositories/comment/reports'
import { useRequireAdmin } from '@/hooks/comment/useIsAdmin'
import { useAuth } from '@/hooks/auth/useAuth'
import { useRequireSession } from '@/hooks/auth/useRequireSession'
import { useProfile } from '@/hooks/auth/useProfile'
import type { DetailNavigation } from '../types'

export function LoginRoute() {
  const navigation = useNavigation<DetailNavigation>()
  // 로그인이 끝나면 닫는다. 첫 로그인이면 ProfileGate 가 이어서 닉네임을 묻는다
  return <LoginScreen onDone={() => navigation.goBack()} />
}

export function AccountRoute() {
  useRequireSession()
  const navigation = useNavigation<DetailNavigation>()
  const openNickname = useCallback(() => navigation.navigate('Nickname'), [navigation])
  const openHandle = useCallback(() => navigation.navigate('Handle'), [navigation])
  const openBlocked = useCallback(() => navigation.navigate('BlockedUsers'), [navigation])
  return <AccountScreen onOpenNickname={openNickname} onOpenHandle={openHandle} onOpenBlocked={openBlocked} />
}

export function HandleRoute() {
  useRequireSession()
  const navigation = useNavigation<DetailNavigation>()
  const { session } = useAuth()
  const { profile, saveHandle } = useProfile(session)

  const onSubmit = useCallback(
    async (handle: string) => {
      await saveHandle(handle)
      navigation.goBack()
    },
    [navigation, saveHandle],
  )

  /*
    저장은 헤더 오른쪽에 건다.

    아래에 두면 키보드가 올라올 때마다 단추가 그 위로 밀려 자리가 바뀐다. 헤더는
    키보드와 무관하게 늘 같은 자리고, 카드 만들기와도 같은 규칙이 된다.
    누를 것은 화면이 쥐고 있으므로 받아서 걸기만 한다.
  */
  const [action, setAction] = useState<SaveAction | null>(null)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (action ? <HeaderAction label="저장" {...action} /> : null),
    })
  }, [navigation, action])

  return <HandleScreen initial={profile?.handle ?? ''} onSubmit={onSubmit} onSaveAction={setAction} />
}

/** 이미 정한 닉네임을 고치는 쪽. 첫 로그인은 ProfileGate 가 맡는다 */
export function NicknameRoute() {
  useRequireSession()
  const navigation = useNavigation<DetailNavigation>()
  const { session } = useAuth()
  const { profile, save } = useProfile(session)

  const onSubmit = useCallback(
    async (nickname: string) => {
      await save(nickname)
      navigation.goBack()
    },
    [navigation, save],
  )

  const [action, setAction] = useState<SaveAction | null>(null)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (action ? <HeaderAction label="저장" {...action} /> : null),
    })
  }, [navigation, action])

  return (
    <NicknameScreen
      initial={profile?.nickname ?? ''}
      first={false}
      onSubmit={onSubmit}
      onSaveAction={setAction}
    />
  )
}

/** 신고함. 들어오는 길이 관리자에게만 보이지만, 여기서도 한 번 더 본다 */
export function ReportInboxRoute() {
  useRequireAdmin()
  const navigation = useNavigation<DetailNavigation>()

  /**
   * 신고당한 글이 달린 화면으로 보낸다.
   *
   * 글 몇 줄만 보고는 판단이 안 된다 — 앞뒤 대화를 봐야 시비인지 농담인지 갈린다.
   *
   * 경기는 회차를 모르는 채로 보낸다. 신고 기록에는 댓글이 어디에 달렸는지만 있고
   * 회차는 없는데, 상세 화면이 null 을 받아 스스로 채우므로 여기서 지어낼 이유가 없다.
   */
  const onOpen = useCallback(
    (subject: Report['subject']) => {
      if (subject.type === 'match') {
        navigation.navigate('MatchDetail', { matchId: Number(subject.id), round: null })
        return
      }
      if (subject.type === 'news') {
        navigation.navigate('NewsDetail', { seq: Number(subject.id) })
        return
      }
      if (subject.type === 'post') {
        navigation.navigate('Post', { postId: subject.id })
        return
      }
      navigation.navigate('Player', { playerId: subject.id })
    },
    [navigation],
  )

  return <ReportInboxScreen onOpen={onOpen} />
}

export function BlockedUsersRoute() {
  useRequireSession()
  return <BlockedUsersScreen />
}

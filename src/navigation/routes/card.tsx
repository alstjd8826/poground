import { useCallback, useLayoutEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'

import { HeaderAction, type SaveAction } from '@/components/foundation/HeaderAction'
import { CardCollectionScreen } from '@/screens/CardCollectionScreen'
import { CardMakerScreen } from '@/screens/CardMakerScreen'
import type { DetailNavigation } from '../types'

export function CardCollectionRoute() {
  const navigation = useNavigation<DetailNavigation>()
  const edit = useCallback((id?: string) => navigation.navigate('CardMaker', { id }), [navigation])
  /**
   * 새로 만들기는 헤더 오른쪽에 건다.
   *
   * 목록 맨 위에 두면 스크롤을 내리는 순간 사라진다 — 카드가 쌓일수록 만들러 가는 길이
   * 멀어진다. 헤더에 두면 몇 장이 쌓이든 늘 같은 자리에 있고, 카드 만들기의 저장과도
   * 같은 자리가 된다.
   */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <HeaderAction label="새로 만들기" onPress={() => edit()} />,
    })
  }, [navigation, edit])
  return <CardCollectionScreen onEdit={edit} />
}

export function CardMakerRoute({ id }: { id?: string }) {
  const navigation = useNavigation<DetailNavigation>()
  /**
   * 저장은 헤더 오른쪽에 건다.
   *
   * 아래에 두면 고를 것이 깔리는 가로 스트립 바로 밑에 붙어, 고르는 일과 끝내는 일이
   * 같은 자리에서 섞인다. 화면을 끝내는 행동은 헤더에 두는 것이 이 앱의 다른 화면과도
   * 맞고, 그만큼을 미리보기가 가져간다.
   *
   * 누를 것은 화면이 쥐고 있으므로 받아서 걸기만 한다.
   */
  const [action, setAction] = useState<SaveAction | null>(null)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (action ? <HeaderAction label="저장" {...action} /> : null),
    })
  }, [navigation, action])
  // 저장하면 보관함으로 돌아간다. 방금 만든 것이 목록 맨 앞에 보여야 한다
  const onSaved = useCallback(() => navigation.goBack(), [navigation])
  /**
   * 로그인이 필요하면 만들기 화면을 닫고 로그인 화면을 연다.
   *
   * 카드는 이미 기기에 담겨 있고 로그인이 끝나면 저장소가 알아서 올린다. 그래서
   * 여기서 돌아올 자리를 붙잡아 둘 필요가 없다 — 보관함에 카드가 나타난다.
   */
  const onRequireLogin = useCallback(() => {
    navigation.goBack()
    navigation.navigate('Login')
  }, [navigation])
  return (
    <CardMakerScreen id={id} onSaved={onSaved} onRequireLogin={onRequireLogin} onSaveAction={setAction} />
  )
}

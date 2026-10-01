import { useRef } from 'react'
import { useScrollToTop } from '@react-navigation/native'

/**
 * 하단 탭을 다시 누르면 그 탭의 목록을 맨 위로 올린다.
 *
 * 이미 열려 있는 탭을 누르면 갈 곳이 없어 아무 일도 안 일어난다. 긴 목록을 한참 내려간
 * 뒤에는 맨 위로 돌아갈 길이 손가락으로 쓸어 올리는 것밖에 없는데, 탭을 누르는 것이
 * iOS 에서 통하는 지름길이라 그걸 붙인다.
 *
 * 내비게이션이 보내는 tabPress 를 useScrollToTop 이 받아서, **포커스된 화면만** 올린다.
 * 그래서 소식 탭처럼 갈래 둘을 함께 띄워 두는 화면에서도 엉뚱한 쪽이 움직이지 않는다.
 *
 * 돌려주는 참조를 스크롤 영역에 걸면 된다. useScrollToTop 은 scrollToTop / scrollTo /
 * scrollToOffset 중 있는 것을 골라 부르므로 ScrollView 와 FlashList 에 모두 통한다.
 * 목록이 아직 안 그려졌으면(로딩·에러) 참조가 비는데, 그때는 조용히 넘어간다.
 */
export function useTabScrollTop<T>() {
  const ref = useRef<T>(null)
  // useScrollToTop 의 타입은 ScrollView 계열만 받도록 좁혀져 있다. FlashList 도 위의
  // 메서드를 갖추고 있어 실제로는 동작하므로, 여기 한 곳에서만 타입을 풀어 준다
  useScrollToTop(ref as never)
  return ref
}

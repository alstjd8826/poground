import { useContext } from 'react'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

/**
 * 탭바가 없는 스택 화면이 스크롤 끝에 더 비워 둘 높이. 아래 안전 영역만큼이다.
 *
 * 안드로이드는 화면이 하단 내비게이션 바 밑까지 그려지고(edge-to-edge), 아이폰은 홈 인디케이터 밑까지
 * 그려진다. 탭 화면은 탭바가 그 자리를 잡지만(useTabBarHeight), 들어간 화면에서는 탭바가 숨는다. 비우지 않으면
 * 마지막 줄이 바 뒤에 깔린다 — 갤럭시에서 내 계정의 "계정 삭제" 가 그랬다 (2026-09-30).
 *
 * 안전 영역을 모르는 곳(Provider 밖, 테스트)에서는 0 이다. 없다고 화면이 죽을 일은 아니다.
 */
export function useBottomSafeGap(): number {
  return useContext(SafeAreaInsetsContext)?.bottom ?? 0
}

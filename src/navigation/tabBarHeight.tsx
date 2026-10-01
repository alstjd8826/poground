import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'

/**
 * 하단 탭바가 차지하는 높이.
 *
 * 탭바는 화면 흐름에 들어가지 않고 **위에 떠 있다.** 그래야 화면에 따라 감출 때
 * 레이아웃이 흔들리지 않는다 — 흐름에 있으면 감추는 순간 화면 높이가 바뀌어, 밀고
 * 들어오는 전환과 겹쳐 목록이 출렁인다 (TabBar 주석 참고).
 *
 * 대신 스크롤 화면이 스스로 그만큼 아래를 비워야 한다. 안 그러면 목록 마지막 줄이
 * 탭바 뒤에 깔린다. 높이는 안전 영역에 따라 기기마다 다르므로 숫자를 박지 않고
 * 탭바가 제 크기를 재서 여기에 올려 둔다.
 */
const TabBarHeightContext = createContext(0)
const ReportContext = createContext<(height: number) => void>(() => {})

export function TabBarHeightProvider({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(0)
  // 값과 보고 통로를 따로 둔다. 같이 두면 높이가 정해질 때 탭바까지 다시 그린다
  const value = useMemo(() => height, [height])
  return (
    <ReportContext.Provider value={setHeight}>
      <TabBarHeightContext.Provider value={value}>{children}</TabBarHeightContext.Provider>
    </ReportContext.Provider>
  )
}

/** 스크롤 화면이 아래에 비워 둘 높이 */
export function useTabBarHeight(): number {
  return useContext(TabBarHeightContext)
}

/** 탭바가 제 높이를 알린다 */
export function useReportTabBarHeight(): (height: number) => void {
  return useContext(ReportContext)
}

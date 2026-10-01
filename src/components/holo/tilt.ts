import { createContext, useContext } from 'react'
import type { SkImage, SkRuntimeEffect, Uniforms } from '@shopify/react-native-skia'
import type { SharedValue } from 'react-native-reanimated'

/**
 * 카드가 지금 얼마나 기울어 있는지, 그리고 홀로를 어떻게 칠하고 있는지.
 *
 * 홀로 표면은 카드 전체를 한 덩어리로 기울이지만, 그 위에 얹은 것들은 카드 면보다
 * 살짝 떠 있는 것처럼 따로 움직여야 한다. 그러려면 기울기 값 자체를 밖에서 읽을 수
 * 있어야 해서 컨텍스트로 내보낸다. UI 스레드에서 읽히도록 공유값 그대로 넘긴다.
 *
 * 셰이더와 유니폼도 같이 내보낸다. 카드 위에 얹힌 그림(선수 누끼)에도 같은 빛이 돌아야
 * 하는데, 그러려면 카드와 **똑같은 계산**을 해야 한다 — 따로 계산하면 손가락을 옮길 때
 * 두 빛이 어긋나 움직인다.
 */
export interface HoloTilt {
  /** 위아래 기울기(도). 양수면 카드 아래쪽이 앞으로 나온다 */
  rotX: SharedValue<number>
  /** 좌우 기울기(도). 양수면 카드 오른쪽이 뒤로 물러난다 */
  rotY: SharedValue<number>
  /** 기울기가 닿을 수 있는 최대 각도(도) */
  limit: number
  /** 지금 걸려 있는 효과. 아직 컴파일 전이면 null */
  source: SkRuntimeEffect | null
  /**
   * 셰이더에 먹이는 값. 카드 좌표계(res = 카드 크기) 기준이다.
   *
   * 스키아는 공유값을 { value } 모양으로만 보므로 리애니메이티드 타입을 그대로 쓰지 않는다.
   */
  uniforms: { value: Uniforms }
  /**
   * 반짝이 타일.
   *
   * 얹히는 그림도 이것을 물려야 한다. 셰이더는 이 슬롯의 **알파를 알갱이 값으로**
   * 읽으므로, 여기에 누끼 사진을 넣으면 사람 안쪽 알파가 전부 1 이라 알갱이 하나가
   * 사람만큼 커진 셈이 되어 통째로 하얗게 번진다.
   */
  sparkle: SkImage | null
  /** 카드 크기(pt). 얹히는 그림도 이 좌표계로 그려야 빛이 맞는다 */
  width: number
  height: number
}

const TiltContext = createContext<HoloTilt | null>(null)

export const TiltProvider = TiltContext.Provider

/** 홀로 표면 밖에서 부르면 null 이다 — 그때는 그냥 안 움직이고 안 반짝이면 된다 */
export function useHoloTilt(): HoloTilt | null {
  return useContext(TiltContext)
}

import { Canvas, Fill, ImageShader, Shader, type SkImage } from '@shopify/react-native-skia'

import { useHoloTilt } from './tilt'

export interface HoloImageProps {
  /** 카드 위에 얹을 그림. 아직 안 불러왔으면 null */
  image: SkImage | null
  /** 카드 안에서 그림이 놓일 자리. 0..1 비율로 준다 */
  rect: { x: number; y: number; width: number; height: number }
}

/**
 * 카드 위에 얹히면서 같은 홀로를 두르는 그림.
 *
 * 실물 카드는 그림창이 곧 홀로가 도는 자리다 — 빛은 그림 위를 지나간다. 그런데 이 앱의
 * 누끼는 카드에서 떠올라 따로 움직여야 해서 바탕에 구워 넣을 수가 없다. 그래서 그림만
 * 담은 캔버스를 하나 더 얹고, 카드와 **같은 셰이더에 같은 유니폼**을 물린다.
 *
 * 두 가지가 맞아야 빛이 이어져 보인다.
 *   · 캔버스를 카드와 같은 크기로 잡는다. 셰이더가 xy/res 로 위치를 재기 때문에 크기가
 *     다르면 카드의 빛줄기와 그림의 빛줄기가 어긋난 자리에 뜬다.
 *   · 그림을 마스크로도 함께 물린다. 그러면 누끼 바깥은 알파가 0 이라 빛이 안 남는다.
 *
 * 반짝이 슬롯에는 **카드와 같은 반짝이 타일** 을 물린다.
 *
 * 전에는 얹히는 그림을 그대로 넣어 두고 "여기서는 알갱이를 깔지 않는다" 고 적어 뒀는데,
 * 셰이더는 그 슬롯의 알파를 알갱이 값으로 읽는다. 누끼는 사람 안쪽 알파가 전부 1 이라
 * 알갱이 하나가 사람만큼 커진 셈이 되어, 알갱이가 튀는 대신 사람이 통째로 하얗게
 * 번졌다. 실물 카드도 반짝이는 그림창 아래까지 깔려 있으므로 같은 타일을 잇는 것이 맞다.
 */
export function HoloImage({ image, rect }: HoloImageProps) {
  const holo = useHoloTilt()
  if (!holo || !image || !holo.source) return null

  const { width: W, height: H, source, uniforms, sparkle } = holo
  const x = rect.x * W
  const y = rect.y * H
  const w = rect.width * W
  const h = rect.height * H

  return (
    <Canvas style={{ width: W, height: H }}>
      <Fill>
        <Shader source={source} uniforms={uniforms}>
          {/* card — 빛이 얹힐 바탕이자, 투명한 곳을 정하는 알파 */}
          <ImageShader image={image} x={x} y={y} width={w} height={h} fit="contain" tx="decal" ty="decal" />
          {/* maskT — 같은 그림. 누끼 모양이 그대로 반짝일 영역이 된다 */}
          <ImageShader image={image} x={x} y={y} width={w} height={h} fit="contain" tx="decal" ty="decal" />
          {/* sparkT — 카드와 같은 타일. 없는 효과에서는 읽히지 않으므로 그림으로 메운다 */}
          <ImageShader image={sparkle ?? image} fit="none" tx="repeat" ty="repeat" />
        </Shader>
      </Fill>
    </Canvas>
  )
}

import { useMemo } from 'react'
import {
  createPicture,
  drawAsImageFromPicture,
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkImage,
  TileMode,
  vec,
} from '@shopify/react-native-skia'

/**
 * 선수 카드의 바탕과 마스크.
 *
 * 포켓몬 카드는 바탕이 이미 그려진 이미지 파일이지만 우리는 그런 파일이 없다. 선수마다
 * 다른 색으로 그 자리에서 그려 만든다 — 파일을 37장 준비하지 않아도 되고, 포지션이
 * 바뀌면 색도 따라 바뀐다.
 *
 * 만들어 낸 그림은 셰이더의 입력이라 SkImage 여야 한다. createPicture 로 그린 뒤
 * drawAsImageFromPicture 로 굽는데, 이 둘은 동기라 첫 프레임부터 바로 쓸 수 있다.
 */

/** 그려 두는 실제 픽셀 폭. 표시 폭과 무관하게 고정해 두면 캐시가 잘 맞는다 */
const ART_WIDTH = 600

export interface PlayerCardArt {
  art: SkImage | null
  mask: SkImage | null
  /** 최고 등급이 쓰는 반짝이 타일. 셰이더가 카드 전체에 반복해 깐다 */
  glitter: SkImage | null
}

/** 반짝이 타일 한 변(px). 셰이더가 카드 폭의 1/50 마다 한 장씩 깐다 */
const GLITTER_SIZE = 256

/** 정보 패널이 시작하는 높이(0..1). 여기부터 바탕을 어둡게 눌러 글자를 받친다 */
const PANEL_TOP = 0.74

/**
 * 빛이 닿는 아래 끝(0..1).
 *
 * 패널이 시작하는 자리와 일부러 다르게 둔다. 글자를 받치는 어두운 바탕은 이름 위에서
 * 시작해야 읽히고, 빛은 이름 위를 조금 지나가야 카드가 반쪽만 빛나 보이지 않는다.
 */
const SHINE_BOTTOM = 0.8

/**
 * 카드 바탕에 새기는 무늬.
 *
 * 등급이 오르면 반짝임만 화려해지는 게 아니라 바탕 그림 자체가 바뀐다 — 실물 카드가
 * 그렇고, 그래야 문지르지 않고 목록에서 봐도 등급이 읽힌다. 어느 등급이 어느 무늬를
 * 쓰는지는 PlayerCard 의 등급표가 정한다.
 */
export type CardPattern = 'streak' | 'comb' | 'halo' | 'lattice' | 'nebula'

/** 무늬는 바탕 위, 정보 패널 아래에 그린다. 세 함수 모두 이 규칙을 지킨다 */
type Painter = (canvas: SkCanvas, w: number, h: number, tint: string) => void

/** 사선 결. 가장 수수한 바탕이다 — 빛이 걸릴 것만 있으면 된다 */
const streak: Painter = (canvas, w, h) => {
  const paint = Skia.Paint()
  paint.setColor(Skia.Color('#FFFFFF'))
  paint.setAlphaf(0.05)
  canvas.save()
  canvas.rotate(-24, w * 0.5, h * 0.5)
  for (let i = -8; i < 20; i += 1) {
    canvas.drawRect(Skia.XYWHRect(-w, i * h * 0.075, w * 3, h * 0.018), paint)
  }
  canvas.restore()
}

/** 사선에 가는 빗살을 교차시킨다. 결이 두 겹이라 금속을 긁어 놓은 것처럼 보인다 */
const comb: Painter = (canvas, w, h) => {
  streak(canvas, w, h, '')
  const paint = Skia.Paint()
  paint.setColor(Skia.Color('#FFFFFF'))
  paint.setAlphaf(0.03)
  canvas.save()
  canvas.rotate(66, w * 0.5, h * 0.5)
  for (let i = -12; i < 24; i += 1) {
    canvas.drawRect(Skia.XYWHRect(-w, i * h * 0.028, w * 3, h * 0.004), paint)
  }
  canvas.restore()
}

/**
 * 선수 뒤에서 퍼지는 동심원.
 *
 * 처음에는 중심에서 뻗는 광선으로 그렸는데 욱일기와 똑같이 보여서 버렸다. 시선을
 * 가운데로 모으는 역할은 그대로 두되, 뻗는 선 대신 퍼지는 원으로 바꿨다.
 */
const halo: Painter = (canvas, w, h, tint) => {
  const cx = w * 0.5
  const cy = h * 0.42
  const max = Math.hypot(w, h)
  const paint = Skia.Paint()
  paint.setStyle(PaintStyle.Stroke)
  paint.setColor(Skia.Color(tint))
  paint.setStrokeWidth(w * 0.014)

  const step = w * 0.085
  for (let r = step; r < max; r += step) {
    // 바깥으로 갈수록 옅어진다. 고르게 그리면 과녁처럼 보인다
    paint.setAlphaf(0.2 * Math.max(1 - r / (max * 0.8), 0))
    canvas.drawCircle(cx, cy, r, paint)
  }
}

/** 마름모 격자. 선이 촘촘해 홀로가 흐를 때 빛이 잘게 쪼개진다 */
const lattice: Painter = (canvas, w, h, tint) => {
  const paint = Skia.Paint()
  paint.setStyle(PaintStyle.Stroke)
  paint.setStrokeWidth(w * 0.004)
  paint.setColor(Skia.Color(tint))
  paint.setAlphaf(0.18)
  const step = w * 0.11
  // 두 방향 사선이 겹치면 마름모가 된다. 격자 하나를 그리는 가장 싼 방법이다
  for (let i = -20; i < 40; i += 1) {
    canvas.drawLine(i * step, 0, i * step + h, h, paint)
    canvas.drawLine(i * step, 0, i * step - h, h, paint)
  }
}

/** 성운. 색 덩어리를 겹쳐 깊이를 만들고 그 위에 잔별을 뿌린다 */
const nebula: Painter = (canvas, w, h, tint) => {
  const blobs: Array<[number, number, number, string]> = [
    [0.26, 0.24, 0.5, tint],
    [0.78, 0.5, 0.42, '#7B5CFF'],
    [0.42, 0.66, 0.38, '#2FC3E3'],
  ]
  for (const [fx, fy, fr, color] of blobs) {
    const paint = Skia.Paint()
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        vec(w * fx, h * fy),
        w * fr,
        [Skia.Color(color), Skia.Color('#00000000')],
        [0, 1],
        TileMode.Clamp,
      ),
    )
    paint.setAlphaf(0.3)
    canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint)
  }

  // 잔별. 씨앗을 고정해 다시 그려도 같은 자리에 뜬다
  let seed = 0x1f123bb5
  const rand = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return ((seed >>> 0) % 100000) / 100000
  }
  const star = Skia.Paint()
  star.setColor(Skia.Color('#FFFFFF'))
  for (let i = 0; i < 160; i += 1) {
    star.setAlphaf(0.2 + rand() * 0.6)
    canvas.drawCircle(rand() * w, rand() * h * PANEL_TOP, w * (0.001 + rand() * 0.003), star)
  }
}

const PAINTERS: Record<CardPattern, Painter> = { streak, comb, halo, lattice, nebula }

function buildArt(w: number, h: number, tint: string, pattern: CardPattern): SkImage | null {
  const picture = createPicture(
    canvas => {
      const paint = Skia.Paint()

      // 바닥: 위는 강철빛 검정, 아래로 갈수록 포지션 색이 배어 나온다
      paint.setShader(
        Skia.Shader.MakeLinearGradient(
          vec(0, 0),
          vec(0, h),
          [Skia.Color('#14161A'), Skia.Color('#1E222A'), Skia.Color(tint)],
          [0, 0.55, 1],
          TileMode.Clamp,
        ),
      )
      canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint)

      // 선수가 설 자리 뒤의 발광. 누끼가 배경에서 떠 보이게 하는 건 이 원이다
      const glow = Skia.Paint()
      glow.setShader(
        Skia.Shader.MakeRadialGradient(
          vec(w * 0.5, h * 0.42),
          w * 0.62,
          [Skia.Color(tint), Skia.Color('#00000000')],
          [0, 1],
          TileMode.Clamp,
        ),
      )
      glow.setAlphaf(0.55)
      canvas.drawRect(Skia.XYWHRect(0, 0, w, h), glow)

      // 등급별 무늬. 홀로가 흐를 때 빛이 걸릴 게 있어야 표면이 평평해 보이지 않는다
      PAINTERS[pattern](canvas, w, h, tint)

      // 아래 정보 패널. 이름과 기록이 얹히는 자리라 어둡게 눌러 둔다
      const panel = Skia.Paint()
      panel.setShader(
        Skia.Shader.MakeLinearGradient(
          vec(0, h * PANEL_TOP - h * 0.12),
          vec(0, h),
          [Skia.Color('#00000000'), Skia.Color('#0B0C0EE6'), Skia.Color('#0B0C0EF2')],
          [0, 0.55, 1],
          TileMode.Clamp,
        ),
      )
      canvas.drawRect(Skia.XYWHRect(0, h * PANEL_TOP - h * 0.12, w, h * 0.12 + h * (1 - PANEL_TOP)), panel)

      // 테두리. 안쪽으로 한 겹 더 넣어 인쇄된 카드처럼 보이게 한다
      const edge = Skia.Paint()
      edge.setStyle(PaintStyle.Stroke)
      edge.setColor(Skia.Color(tint))
      edge.setAlphaf(0.7)
      edge.setStrokeWidth(w * 0.012)
      canvas.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(w * 0.028, w * 0.028, w - w * 0.056, h - w * 0.056), w * 0.03, w * 0.03),
        edge,
      )
    },
    Skia.XYWHRect(0, 0, w, h),
  )

  return drawAsImageFromPicture(picture, { width: w, height: h })
}

function buildMask(w: number, h: number): SkImage | null {
  const picture = createPicture(
    canvas => {
      // 흰 곳만 빛이 흐른다. 테두리 안쪽에서 이름 위를 조금 지난 데까지
      const paint = Skia.Paint()
      paint.setColor(Skia.Color('#FFFFFF'))
      canvas.drawRRect(
        Skia.RRectXY(
          Skia.XYWHRect(w * 0.045, w * 0.045, w - w * 0.09, h * SHINE_BOTTOM - w * 0.045),
          w * 0.025,
          w * 0.025,
        ),
        paint,
      )
    },
    Skia.XYWHRect(0, 0, w, h),
  )

  return drawAsImageFromPicture(picture, { width: w, height: h })
}

/**
 * 반짝이 타일.
 *
 * 원본은 이 무늬를 이미지 파일로 받아 쓰지만, 뿌려진 밝은 점일 뿐이라 그리는 편이 낫다 —
 * 받아 오다 실패할 일이 없고 파일도 안 는다. 셰이더가 타일을 이어 붙이므로 무늬가
 * 네 변에서 끊기면 격자가 눈에 보인다. 가장자리를 넘는 점은 반대편에도 한 번 더 찍어
 * 이음매를 지운다.
 *
 * 난수는 고정 씨앗으로 만든다. 다시 그릴 때마다 별자리가 바뀌면 카드가 깜빡인다.
 */
function buildGlitter(): SkImage | null {
  const n = GLITTER_SIZE
  const picture = createPicture(
    canvas => {
      let seed = 0x9e3779b9
      const rand = () => {
        // xorshift. Math.random 과 달리 씨앗을 고정할 수 있다
        seed ^= seed << 13
        seed ^= seed >>> 17
        seed ^= seed << 5
        return ((seed >>> 0) % 100000) / 100000
      }

      const paint = Skia.Paint()
      for (let i = 0; i < 900; i += 1) {
        const x = rand() * n
        const y = rand() * n
        const r = 0.4 + rand() * 1.6
        // 대부분은 흐릿하고 몇 개만 또렷하다. 고르게 밝으면 모래알처럼 보인다
        paint.setColor(Skia.Color('#FFFFFF'))
        paint.setAlphaf(0.15 + rand() * 0.85)
        canvas.drawCircle(x, y, r, paint)
        // 이음매 지우기: 가장자리를 넘는 점은 반대쪽에도 찍는다
        if (x < r) canvas.drawCircle(x + n, y, r, paint)
        if (x > n - r) canvas.drawCircle(x - n, y, r, paint)
        if (y < r) canvas.drawCircle(x, y + n, r, paint)
        if (y > n - r) canvas.drawCircle(x, y - n, r, paint)
      }
    },
    Skia.XYWHRect(0, 0, n, n),
  )

  return drawAsImageFromPicture(picture, { width: n, height: n })
}

/**
 * 카드 바탕을 만들어 캐시한다.
 *
 * 색과 무늬가 같으면 같은 그림이다. 표시 폭은 셰이더가 늘려 쓰기
 * 때문에 여기 픽셀 크기와 무관하다 — 카드가 여러 크기로 떠도 한 번만 굽는다.
 */
export function usePlayerCardArt(aspect: number, tint: string, pattern: CardPattern): PlayerCardArt {
  const w = ART_WIDTH
  const h = Math.round(w / aspect)

  const art = useMemo(() => buildArt(w, h, tint, pattern), [w, h, tint, pattern])
  const mask = useMemo(() => buildMask(w, h), [w, h])
  // 반짝이는 색과 무관하다. 선수가 몇이든 한 장이면 된다
  const glitter = useMemo(() => buildGlitter(), [])

  return { art, mask, glitter }
}

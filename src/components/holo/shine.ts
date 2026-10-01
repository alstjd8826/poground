/**
 * 카드 표면의 빛.
 *
 * 손가락(또는 기울기)을 따라 카드 위로 빛이 흐르게 하는 셰이더를 만든다. 효과마다
 * "무엇이 빛나는가" 가 다를 뿐, 들어오는 값과 나가는 색의 규칙은 하나로 묶여 있다.
 *
 * 설계 원칙 둘:
 *   · 텍스처에 기대지 않는다. 반짝이만 우리가 그려 넣고 나머지는 전부 계산으로 만든다.
 *     외부 이미지에 묶이면 파일이 늘고 라이선스도 따라붙는다.
 *   · 색은 알파를 곱하지 않은 상태로 다룬다. 스키아가 주는 색은 알파가 곱해져 있어서
 *     그대로 계산하면 반투명한 가장자리(머리카락 끝 같은 곳)가 타 버린다.
 */

/**
 * 효과 키.
 *
 * rainbow·prism 은 **이름만 남은 옛 키다.** 지금 그리는 것은 오로라와 굴절인데,
 * 이미 만들어 둔 카드들이 이 값을 들고 있어서 키는 건드리지 않는다. 키를 바꾸려면
 * 기기와 서버에 있는 카드를 전부 옮겨야 하는데, 얻는 것이 이름뿐이라 그럴 값이 없다.
 */
export type ShineKey = 'none' | 'gloss' | 'brushed' | 'rainbow' | 'prism' | 'sparkle'

/** 화면에 보여줄 이름. 카드 만들기에서 고르는 목록이 이 순서다 */
export const SHINE_LABELS: Record<ShineKey, string> = {
  none: '없음',
  gloss: '광택',
  brushed: '강철',
  rainbow: '오로라',
  prism: '굴절',
  sparkle: '반짝이',
}

export const SHINE_KEYS = Object.keys(SHINE_LABELS) as ShineKey[]

/**
 * 셰이더가 받는 값.
 *
 * card   카드 본체. 빛이 얹힐 바탕이고, 투명한 곳을 정하는 알파이기도 하다
 * maskT  반짝일 영역. 흰 곳만 빛이 흐른다
 * sparkT 반짝이 타일. sparkle 만 쓴다
 * res    캔버스 크기(px). 좌표를 0..1 로 정규화할 때 쓴다
 * pointer 손가락 자리 0..1
 * engage  빛의 세기 0..1. 손을 떼면 0 으로 잦아든다
 * hasMask 마스크를 줬는지
 * glow    효과에 물드는 색. 카드마다 다르다
 * sparkSize 반짝이 타일의 원본 픽셀 크기
 */
const HEAD = `
uniform shader card;
uniform shader maskT;
uniform shader sparkT;
uniform float2 res;
uniform float2 pointer;
uniform float engage;
uniform float hasMask;
uniform float3 glow;
uniform float2 sparkSize;
`

/**
 * 공용 계산.
 *
 * 색상환은 흔히 쓰는 형태를 그대로 쓴다 — 0..1 을 빨강에서 한 바퀴 도는 삼각파 셋으로
 * 만드는 방식이라 표에서 찾아 쓸 것도 없다.
 *
 * 겹치기는 두 가지만 있으면 충분하다. screen 은 어두운 곳을 살리며 밝히고(빛이 더해지는
 * 느낌), overlay 는 원래의 밝고 어두움을 지키며 색을 입힌다. 둘 다 W3C 합성·블렌딩
 * 명세의 식이다.
 */
const PRELUDE = `
const float TAU = 6.2831853;

float3 hue2rgb(float h) {
  float3 p = abs(fract(h + float3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}

float3 screenBlend(float3 a, float3 b) {
  return 1.0 - (1.0 - a) * (1.0 - b);
}

float3 overlayBlend(float3 a, float3 b) {
  float3 lo = 2.0 * a * b;
  float3 hi = 1.0 - 2.0 * (1.0 - a) * (1.0 - b);
  return mix(lo, hi, step(0.5, a));
}

/**
 * 홀로 전체 세기.
 *
 * 효과마다 흩어진 숫자를 하나씩 만지면 서로의 균형이 깨진다. 효과가 빛을 얹는 길은
 * 전부 add() 하나로 모이므로, 여기서 한 번에 눌러 **효과 사이의 비율은 그대로 두고**
 * 전체만 옅게 한다. "홀로가 너무 진하다" 는 이 숫자 하나로 답한다.
 */
const float STRENGTH = 0.6;

/** 빛을 amount 만큼 섞는다. 0 이면 원래 색 그대로 */
float3 add(float3 base, float3 light, float amount) {
  return mix(base, screenBlend(base, light), clamp(amount * STRENGTH, 0.0, 1.0));
}

/**
 * 홀로 포일의 색.
 *
 * hue2rgb 는 원색을 그대로 돌려준다. 그걸 카드에 얹으면 포일이 아니라 **색종이**로
 * 읽힌다 — 실물 홀로 카드에서 새빨강이나 새파랑이 나오는 일은 없다. 흰색 쪽으로
 * 당겨 파스텔로 만들면 빛에 실려 있는 색처럼 보인다.
 */
float3 foil(float h, float sat) {
  return mix(float3(1.0), hue2rgb(fract(h)), sat);
}

/** 반짝일 영역. 마스크가 없으면 카드 전체가 대상이다 */
float shineMask(float2 xy) {
  if (hasMask > 0.5) { return float(maskT.eval(xy).a); }
  return 1.0;
}

/**
 * 손가락에서 번지는 둥근 빛.
 *
 * 카드가 세로로 길어서 좌표를 그대로 쓰면 빛이 세로로 늘어난 타원이 된다. 가로를
 * 비율만큼 늘려 재야 동그랗게 보인다.
 */
float pointerFalloff(float2 uv, float spread) {
  float2 d = uv - pointer;
  d.x *= res.x / res.y;
  return smoothstep(spread, 0.0, length(d));
}
`

/** 모든 효과가 공유하는 마무리. 알파를 되돌렸다 다시 곱한다 */
const TAIL = `
half4 main(float2 xy) {
  float4 base = float4(card.eval(xy));
  float a = base.a;
  float3 col = a > 0.0001 ? base.rgb / a : float3(0.0);
  float2 uv = xy / res;
  float3 lit = clamp(shine(col, xy, uv), 0.0, 1.0);
  return half4(half3(lit * a), half(a));
}
`

// ─────────────────────────────── 효과

/** 아무 빛도 없다. 카드를 기울이기만 할 때 쓴다 */
const NONE = `
float3 shine(float3 col, float2 xy, float2 uv) { return col; }
`

/**
 * 광택 — 손가락 자리에 뜨는 하얀 반사.
 *
 * 인쇄된 카드를 조명 아래에서 기울일 때 보이는 그것이다. 빛 하나만 있으면 밋밋해서,
 * 반대쪽에 옅은 빛을 하나 더 두어 표면이 휘어 보이게 한다.
 */
const GLOSS = `
float3 shine(float3 col, float2 xy, float2 uv) {
  float m = shineMask(xy);
  if (engage < 0.001 || m < 0.001) { return col; }

  float near = pointerFalloff(uv, 0.55);
  float far = pointerFalloff(float2(1.0 - uv.x, 1.0 - uv.y), 0.85);

  col = add(col, float3(1.0), near * 0.42 * engage * m);
  col = add(col, float3(0.75, 0.8, 0.9), far * 0.14 * engage * m);
  return col;
}
`

/**
 * 강철 — 결이 살아 있는 금속.
 *
 * 스틸러스니까 한 벌쯤은 금속이어야 한다. 가는 가로줄을 촘촘히 깔고, 손가락이 지나가는
 * 높이에서만 그 줄이 번쩍이게 한다. 줄 간격을 살짝 흔들어야 인쇄된 격자처럼 안 보인다.
 */
const BRUSHED = `
float3 shine(float3 col, float2 xy, float2 uv) {
  float m = shineMask(xy);
  if (engage < 0.001 || m < 0.001) { return col; }

  // 결. 가로로 긴 줄이라 세로 좌표만 쓴다
  float grain = sin(uv.y * 420.0) * 0.5 + 0.5;
  grain = mix(grain, sin(uv.y * 137.0 + uv.x * 3.0) * 0.5 + 0.5, 0.4);

  // 손가락이 있는 높이에서 멀어질수록 빠르게 죽는다
  float band = smoothstep(0.32, 0.0, abs(uv.y - pointer.y));
  float sheen = grain * band * engage * m;

  col = add(col, float3(1.0), sheen * 0.5);
  // 금속은 아주 어두운 쪽도 같이 밝아진다. 그래야 종이가 아니라 판으로 보인다
  col = add(col, glow, band * engage * m * 0.12);
  return col;
}
`

/**
 * 오로라 — 비스듬히 흐르는 리본.
 *
 * 전에 "무지개" 였던 자리다. 그때 짜쳐 보인 이유는 둘이었다.
 *
 * 1. **색상환을 한 바퀴 다 돌렸다.** 빨강·초록·파랑이 한 카드에 다 나오니 홀로 포일이
 *    아니라 색종이로 읽혔다. 실물 포일은 얇은 막에서 빛이 간섭해 나오는 색이라 좁은
 *    구간만 오간다 — 원래 무지개가 될 수 없다.
 * 2. **overlay 로 얹었다.** overlay 는 바탕의 밝고 어두움을 지키는 겹치기라, 구단
 *    빨강처럼 진한 바탕 위에서는 색이 실리는 대신 **진흙**이 됐다.
 *
 * 그래서 색역을 좁히고, 겹치기를 screen 으로 바꿨다. 홀로는 표면에 얹힌 빛이므로
 * 바탕을 밝히면서 색이 실려야 한다. 리본 사이는 비워 둔다 — 장막이 카드를 다 덮으면
 * 카드가 아니라 무늬만 남는다.
 */
const RAINBOW = `
float3 shine(float3 col, float2 xy, float2 uv) {
  float m = shineMask(xy);
  if (engage < 0.001 || m < 0.001) { return col; }

  // 45° 로 가로지르는 좌표. 손가락을 따라 통째로 밀린다
  float t = (uv.x + uv.y) * 0.5 - (pointer.x - 0.5) * 0.8 - (pointer.y - 0.5) * 0.4;

  // 주기가 어긋난 물결 둘. 간격이 고르면 인쇄된 줄무늬로 읽힌다
  float w = sin(t * TAU * 2.1) * 0.5 + 0.5;
  w = mix(w, sin(t * TAU * 3.7 + 1.7) * 0.5 + 0.5, 0.4);

  // 청록에서 보라까지. 한 바퀴를 다 돌지 않는 것이 핵심이다
  float3 rgb = foil(0.46 + t * 0.42 + w * 0.16, 0.72);

  // 리본 사이를 비워 카드가 보이게 한다
  float ribbon = smoothstep(0.35, 0.95, w);
  col = add(col, rgb, ribbon * engage * m * 0.5);
  // 리본 위에 얇은 반사를 얹어 표면이 있다는 걸 알린다
  col = add(col, float3(1.0), pointerFalloff(uv, 0.5) * engage * m * 0.16);
  return col;
}
`

/**
 * 굴절 — 빛이 가는 빗살에서 쪼개진다.
 *
 * 전에 "프리즘" 이었던 자리다. 손가락을 축으로 색을 빙글 돌렸는데, 소용돌이는 홀로
 * 카드보다 **CD 뒷면**에 가까웠다.
 *
 * 실물에서 비싸 보이는 쪽은 소용돌이가 아니라 빗살이다. 카드 표면에 아주 가는 홈을
 * 새겨 두면 빛이 홈마다 조금씩 다른 각도로 꺾이고, 그래서 결을 따라 색이 어긋나 보인다.
 * 여기서도 같은 방식으로 만든다 — 빗살을 깔고, 색은 카드를 가로지르며 천천히 돌리고,
 * 홈 안에서 한 번 더 어긋낸다.
 *
 * 색을 홈 안에서만 돌려 봤더니 빗살이 그냥 흰 줄무늬로 보였다. 카드를 가로지르며
 * 돌려야 금색에서 분홍·보라로 넘어가는 결이 생긴다.
 */
const PRISM = `
float3 shine(float3 col, float2 xy, float2 uv) {
  float m = shineMask(xy);
  if (engage < 0.001 || m < 0.001) { return col; }

  // 살짝 기울인 빗살. 정확히 세로로 두면 인쇄 격자처럼 보인다
  float axis = uv.x * 0.94 + uv.y * 0.34;
  float line = fract(axis * 30.0 - (pointer.x - 0.5) * 2.4);

  // 색은 카드를 가로지르며 돈다. 홈 안에서 한 번 더 어긋난다
  float h = 0.44 + axis * 0.5 + (line - 0.5) * 0.10 - (pointer.x - 0.5) * 0.3;
  float3 rgb = foil(h, 0.72);

  // 홈의 가운데가 밝고 경계로 갈수록 죽는다
  float ridge = smoothstep(0.0, 0.5, line) * smoothstep(1.0, 0.5, line);

  col = add(col, rgb, ridge * engage * m * 0.55);
  // 손가락 근처의 홈만 흰 반사를 받는다. 전체가 균일하면 인쇄물로 보인다
  col = add(col, float3(1.0), ridge * pointerFalloff(uv, 0.6) * engage * m * 0.22);
  return col;
}
`

/**
 * 반짝이 — 알갱이가 하나씩 튀는 면.
 *
 * 타일 하나를 우리가 그려서 카드 전체에 반복해 깐다. 전부 한꺼번에 빛나면 모래를 뿌린
 * 것 같으니, 손가락에서 가까운 알갱이만 세게 튀게 해서 빛이 지나가는 것처럼 만든다.
 */
const SPARKLE = `
float3 shine(float3 col, float2 xy, float2 uv) {
  float m = shineMask(xy);
  if (engage < 0.001 || m < 0.001) { return col; }

  // 타일을 카드 폭의 1/4 마다 한 장씩 깐다
  float2 tile = res * 0.25;
  float grain = float(sparkT.eval(fract(xy / tile) * sparkSize).a);

  float near = pointerFalloff(uv, 0.7);
  // 알갱이마다 문턱을 달리해 한꺼번에 켜지지 않게 한다
  float spark = smoothstep(0.55 - near * 0.45, 1.0, grain) * near;

  col = add(col, float3(1.0), spark * engage * m * 0.9);
  col = add(col, glow, spark * engage * m * 0.35);
  // 바탕에도 옅은 빛을 깔아 알갱이가 허공에 뜬 것처럼 보이지 않게 한다
  col = add(col, glow, near * engage * m * 0.1);
  return col;
}
`

const BODIES: Record<ShineKey, string> = {
  none: NONE,
  gloss: GLOSS,
  brushed: BRUSHED,
  rainbow: RAINBOW,
  prism: PRISM,
  sparkle: SPARKLE,
}

export function buildShine(key: ShineKey): string {
  return HEAD + PRELUDE + BODIES[key] + TAIL
}

/** 반짝이 타일이 실제로 필요한 효과. 나머지는 빈 이미지를 물려도 된다 */
export function needsSparkle(key: ShineKey): boolean {
  return key === 'sparkle'
}

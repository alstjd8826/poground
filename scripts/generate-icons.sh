#!/usr/bin/env bash
# 앱 아이콘 / 스플래시 에셋 생성.
#
# Expo(CNG) 에서는 ios/ android/ 를 prebuild 가 만들므로, 여기서는 app.json 이 가리키는
# 원본 PNG 만 뽑는다. 밀도별 리사이즈는 Expo 가 알아서 한다.
#
# 필요: rsvg-convert (brew install librsvg)
#   ./scripts/generate-icons.sh
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=assets/icon
mkdir -p "$OUT"

# 아이콘·스플래시에는 그림도 글자도 넣지 않는다.
#
# 구단 엠블럼은 남의 상표라 쓸 수 없다(심사 지침 4.1(c) — 남의 브랜드를 앱 아이콘과
# 이름에 쓰지 말 것). 마스코트를 흉내 내 그리는 것은 그보다 나쁘고, 이름을 글자로 넣는
# 안도 만들어 봤지만 배경만 둔 쪽이 나았다.
#
# 마크가 정해지면 아이콘 SVG 의 배경 뒤에 도형을 얹으면 된다.

# 구단 그라디언트 정의. 스플래시(AnimatedGradientBackground)와 같은 색 구성을 정사각형에 압축한다.
read -r -d '' GRADIENT_DEFS <<'SVG' || true
    <linearGradient id="base" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#000000"/>
      <stop offset="0.55" stop-color="#1A0406"/>
      <stop offset="1" stop-color="#000000"/>
    </linearGradient>
    <radialGradient id="red" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FB342E" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="#FB342E" stop-opacity="0.33"/>
      <stop offset="1" stop-color="#FB342E" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sandal" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FAA74A" stop-opacity="0.8"/>
      <stop offset="0.55" stop-color="#FAA74A" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#FAA74A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="deep" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#8E1A16" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#8E1A16" stop-opacity="0"/>
    </radialGradient>
SVG

# POG 마크. 정사각형 캔버스를 꽉 채우는 직각 선 도형이다.
#
# 원본은 손으로 그린 그림을 윤곽선으로 딴 것이고, 좌표가 전부 격자에 떨어진다 —
# 가로는 벽7+틈6, 세로는 벽4+틈3. 정사각형에 맞출 때 그냥 늘리면 가로 선이 세로 선보다
# 두꺼워져 마크가 무너지므로, **벽 폭(44)은 고정하고 틈만 늘려서** 1024 를 채웠다.
# 그래서 모든 선이 같은 굵기다. 수정할 일이 생기면 굵기가 아니라 틈을 건드릴 것.
#
# 글자마다 <path> 를 따로 둔다. 한 경로에 몰면 앞 글자의 속구멍이 뒤 글자의 채움을
# 지워 버린다(짝홀 규칙).
read -r -d '' POG_MARK <<'SVG' || true
  <path fill="#FFFFFF" fill-rule="evenodd" d="M 370.7 0.0 L 370.7 697.3 L 207.3 697.3 L 207.3 1024.0 L 0.0 1024.0 L 0.0 0.0 Z M 44.0 980.0 L 163.3 980.0 L 163.3 653.3 L 326.7 653.3 L 326.7 44.0 L 44.0 44.0 Z M 207.3 326.7 L 207.3 370.7 L 163.3 370.7 L 163.3 326.7 Z"/>
  <path fill="#FFFFFF" fill-rule="evenodd" d="M 697.3 0.0 L 697.3 1024.0 L 326.7 1024.0 L 326.7 0.0 Z M 370.7 980.0 L 653.3 980.0 L 653.3 44.0 L 370.7 44.0 Z M 534.0 326.7 L 534.0 697.3 L 490.0 697.3 L 490.0 326.7 Z"/>
  <path fill="#FFFFFF" fill-rule="evenodd" d="M 1024.0 0.0 L 1024.0 1024.0 L 653.3 1024.0 L 653.3 0.0 Z M 697.3 980.0 L 980.0 980.0 L 980.0 370.7 L 860.7 370.7 L 860.7 697.3 L 816.7 697.3 L 816.7 326.7 L 980.0 326.7 L 980.0 44.0 L 697.3 44.0 Z"/>
SVG

# ── 1) 앱 아이콘: 구단 빨강 위에 POG 마크
#    그라디언트를 깔아 봤지만 아이콘 크기에서는 색이 뭉개져 평평한 한 색이 낫다.
#
#    바깥 벽(44)은 네 면에서 잘라 낸다. 안 자르면 흰 테두리가 아이콘을 빙 두르는데,
#    iOS 가 모서리를 22% 깎으면 그 테두리가 귀퉁이에서 뭉텅이로 남아 흰 띠처럼 보인다.
#    잘라 내면 붉은 칸이 가장자리에 바로 닿아 글자가 화면 밖으로 이어지는 모양이 된다.
CROP=44
BLEED="scale($(bc -l <<< "1024/(1024-2*${CROP})")) translate(-${CROP},-${CROP})"
cat > "$OUT/icon.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#FB342E"/>
  <g transform="${BLEED}">
${POG_MARK}
  </g>
</svg>
SVG
rsvg-convert -w 1024 -h 1024 "$OUT/icon.svg" -o "$OUT/icon.png"
echo "아이콘          $OUT/icon.png"

# ── 2) Android 적응형 아이콘 전경: 같은 마크를 안전 영역 안에 넣는다
#    런처가 전경을 제 마음대로(원·둥근네모·물방울) 잘라 내는데, 확실히 남는 건 가운데
#    66% 뿐이다. 아이폰처럼 가장자리까지 채우면 바깥 벽이 통째로 잘린다.
#    배경색은 app.json 의 adaptiveIcon.backgroundColor 가 맡는다.
SAFE=0.66
cat > "$OUT/adaptive-foreground.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(174,174) scale(${SAFE})">
    <g transform="${BLEED}">
${POG_MARK}
    </g>
  </g>
</svg>
SVG
rsvg-convert -w 1024 -h 1024 -b none "$OUT/adaptive-foreground.svg" -o "$OUT/adaptive-foreground.png"
echo "적응형 전경     $OUT/adaptive-foreground.png"

# ── 4) 스플래시 마크: 붉은 바탕 위에 올릴 흰 POG
#    네이티브 스플래시는 배경색(app.json 의 backgroundColor)과 이 그림 한 장으로 끝난다.
#    화면 전체를 그린 그림을 깔던 예전 방식은 기기 비율마다 잘리는 자리가 달라져,
#    가운데 그림 하나만 두고 나머지는 단색이 채우게 바꿨다.
#
#    아이콘과 달리 바깥 벽을 안 자른다. 아이콘은 가장자리까지 채워 벽이 잘려도 글자가
#    화면 밖으로 이어지는 것처럼 읽히지만, 붉은 바탕에 떠 있는 마크는 벽이 없으면
#    P 의 왼쪽이 뜯겨 나간 것처럼 보인다.
cat > "$OUT/splash-mark.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">
${POG_MARK}
</svg>
SVG
rsvg-convert -w 1024 -h 1024 -b none "$OUT/splash-mark.svg" -o "$OUT/splash-mark.png"
echo "스플래시 마크   $OUT/splash-mark.png"

"""App Store 스크린샷 생성기 — 시뮬레이터 원본 캡처에 문구와 프레임을 입힌다 (6.9인치, 1320×2868).

    python3 -I scripts/gen-store-screenshots.py <원본 폴더> store/ios/6.9

Flash(alstjd8826/flash)의 같은 스크립트를 옮겨 와 색과 문구만 바꿨다 (2026-11-09).
원본 폴더에는 아래 SHOTS 의 파일 이름으로 iPhone 17 Pro Max 시뮬레이터 캡처(1320×2868)를 둔다.
캡처는 Release 빌드 + `xcrun simctl status_bar <기기> override --time 9:41 …` + Maestro(탭 이동)로 찍는다.
앱 안쪽 글자는 접근성 트리에 안 잡혀서 탭바 밖의 단추(경기 › 순위)는 화면 비율 좌표로 누른다.
스타일은 앱 아이콘과 같은 빨강 바탕(#FB342E), 검정 외곽선·오프셋 그림자. rsvg-convert 필요.
문구에 구단 이름(상표)을 쓰지 않는다 — 부제처럼 지역 이름 "포항" 까지만.
"""
import base64
import struct
import pathlib
import subprocess
import sys

W, H = 1320, 2868
SIZES = {'ios': (1320, 2868), 'android': (1080, 1920)}
BRAND, INK, WHITE = '#FB342E', '#111111', '#FFFFFF'
FONT = 'Apple SD Gothic Neo'

# (원본 파일, 제목, 설명)
SHOTS = [
    ('raw1-home.png', '우리 팀 순위와 다음 경기', '홈에서 한눈에 보는 오늘의 포항'),
    ('raw2-matches.png', '시즌 일정과 결과를 한곳에', '월별 일정, 스코어, 경기장까지'),
    ('raw3-standings.png', 'K리그 순위 바로 확인', '우리 팀 자리와 승점 차이를 한 표에'),
    ('raw4-community.png', '직관 후기 나누는 팬 커뮤니티', '사진과 글로 남기는 그날의 응원'),
    ('raw5-club.png', '선수 명단과 출전 기록', '포지션별 출전·골·도움'),
]

SHADOW = (18, 22)


def png_size(data: bytes) -> tuple[int, int]:
    return struct.unpack('>II', data[16:24])


def frame(raw: pathlib.Path, title: str, sub: str, w: int = W, h: int = H) -> str:
    data = raw.read_bytes()
    img = base64.b64encode(data).decode()
    k = w / W  # 모든 치수는 iOS 1320 너비 기준 — 다른 캔버스는 너비 비율로 줄인다
    rw, rh = png_size(data)
    PHONE_W, PHONE_X, PHONE_Y = round(1060 * k), round((W - 1060) // 2 * k), round(520 * k)
    RADIUS, BORDER = round(72 * k), round(14 * k)
    ph = round(PHONE_W * rh / rw)
    sx, sy = round(SHADOW[0] * k), round(SHADOW[1] * k)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}">
<rect width="{w}" height="{h}" fill="{BRAND}"/>
<text x="{w / 2}" y="{270 * k}" text-anchor="middle" font-family="{FONT}" font-weight="800" font-size="{104 * k}" fill="{WHITE}">{title}</text>
<text x="{w / 2}" y="{380 * k}" text-anchor="middle" font-family="{FONT}" font-weight="500" font-size="{52 * k}" fill="{WHITE}" opacity="0.92">{sub}</text>
<defs><clipPath id="c"><rect x="{PHONE_X}" y="{PHONE_Y}" width="{PHONE_W}" height="{ph}" rx="{RADIUS}"/></clipPath></defs>
<rect x="{PHONE_X - BORDER + sx}" y="{PHONE_Y - BORDER + sy}" width="{PHONE_W + BORDER * 2}" height="{ph + BORDER * 2}" rx="{RADIUS + BORDER}" fill="{INK}"/>
<rect x="{PHONE_X - BORDER}" y="{PHONE_Y - BORDER}" width="{PHONE_W + BORDER * 2}" height="{ph + BORDER * 2}" rx="{RADIUS + BORDER}" fill="{INK}"/>
<image x="{PHONE_X}" y="{PHONE_Y}" width="{PHONE_W}" height="{ph}" clip-path="url(#c)" xlink:href="data:image/png;base64,{img}"/>
</svg>'''


if __name__ == '__main__':
    src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    target = sys.argv[3] if len(sys.argv) > 3 else 'ios'
    w, h = SIZES[target]
    out.mkdir(parents=True, exist_ok=True)
    shots = [s for s in SHOTS if (src / s[0]).exists()] if target == 'android' else SHOTS
    for i, (name, title, sub) in enumerate(shots, 1):
        dst = out / f'{i:02d}.png'
        subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), '-o', str(dst)], input=frame(src / name, title, sub, w, h).encode(), check=True)
        print('wrote', dst.name, '-', title)

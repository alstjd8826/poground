"""App Store Connect API 최소 클라이언트 (표준 라이브러리 + openssl). 키 값은 출력하지 않는다.

    python3 -I scripts/asc/asc.py GET /v1/apps 'filter[bundleId]=com.darby.poground'

설정은 루트 .env 의 ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, ASC_APP_ID (docs/ops/credentials.md).
Flash(alstjd8826/flash)의 scripts/asc 를 옮겨 온 것이다 (2026-11-09).
다른 스크립트에서는 `from asc import api` 로 쓴다.
"""
import base64
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = 'https://api.appstoreconnect.apple.com'


def _env() -> dict:
    text = (ROOT / '.env').read_text()
    return {k: re.search(rf'^{k}=(.*)$', text, re.M).group(1) for k in ('ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_PATH', 'ASC_APP_ID')}


def app_id() -> str:
    v = _env()['ASC_APP_ID'].strip()
    if not v:
        sys.exit('.env 의 ASC_APP_ID 가 비어 있어요 — App Store Connect 에 앱을 만든 뒤 Apple ID(숫자)를 넣어 주세요')
    return v


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode()


def _der_to_raw(der: bytes) -> bytes:
    # ECDSA DER(SEQUENCE{INTEGER r, INTEGER s}) → r||s 각 32바이트 (JWT ES256 형식)
    i = 2
    out = b''
    for _ in range(2):
        assert der[i] == 0x02
        n = der[i + 1]
        v = der[i + 2:i + 2 + n].lstrip(b'\x00')
        out += v.rjust(32, b'\x00')
        i += 2 + n
    return out


def token() -> str:
    e = _env()
    now = int(time.time())
    head = _b64(json.dumps({'alg': 'ES256', 'kid': e['ASC_KEY_ID'], 'typ': 'JWT'}).encode())
    body = _b64(json.dumps({'iss': e['ASC_ISSUER_ID'], 'iat': now, 'exp': now + 15 * 60, 'aud': 'appstoreconnect-v1'}).encode())
    signing = f'{head}.{body}'.encode()
    der = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', e['ASC_KEY_PATH']], input=signing, capture_output=True, check=True).stdout
    return f'{head}.{body}.{_b64(_der_to_raw(der))}'


def api(method: str, path: str, body: dict | None = None, query: str = '') -> dict:
    url = BASE + path + (('?' + query) if query else '')
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': f'Bearer {token()}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        detail = err.read().decode()[:3000]
        raise RuntimeError(f'{method} {path} → {err.code}: {detail}') from None


if __name__ == '__main__':
    m, p = sys.argv[1], sys.argv[2]
    q = sys.argv[3] if len(sys.argv) > 3 else ''
    print(json.dumps(api(m, p, None, q), ensure_ascii=False, indent=1)[:4000])

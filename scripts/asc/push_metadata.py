"""store/ios/metadata.md 를 App Store Connect 에 올린다 (한국어 로캘, 제출 준비 중인 버전).

    python3 -I scripts/asc/push_metadata.py

올리는 것: 부제·개인정보 처리방침 URL(앱 정보), 설명·키워드·홍보 문구·지원 URL(버전), 카테고리, 심사 메모.
이름은 App Store Connect 에서 정한 그대로 둔다. 개인정보 항목·연령 등급 설문은 웹에서 직접 한다.
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import ROOT, api, app_id  # noqa: E402

LOCALE = 'ko'
CATEGORIES = ('SPORTS', 'SOCIAL_NETWORKING')


def sections(md: str) -> dict:
    out, cur = {}, None
    for line in md.splitlines():
        m = re.match(r'^## (.+?)(?: \(.*\))?$', line)
        if m:
            cur = m.group(1).strip()
            out[cur] = []
        elif cur:
            out[cur].append(line)
    return {k: '\n'.join(v).strip() for k, v in out.items()}


def url_of(text: str, label: str) -> str:
    return re.search(rf'{label}:\s*(\S+)', text).group(1)


def upsert_localization(kind: str, parent_rel: str, parent_type: str, parent_id: str, attrs: dict) -> None:
    existing = api('GET', f'/v1/{parent_type}/{parent_id}/{kind}')['data']
    loc = next((x for x in existing if x['attributes']['locale'] == LOCALE), None)
    if loc:
        api('PATCH', f'/v1/{kind}/{loc["id"]}', {'data': {'type': kind, 'id': loc['id'], 'attributes': attrs}})
    else:
        api('POST', f'/v1/{kind}', {'data': {'type': kind, 'attributes': {'locale': LOCALE, **attrs},
                                             'relationships': {parent_rel: {'data': {'type': parent_type, 'id': parent_id}}}}})
    print('ok', kind, ', '.join(attrs))


if __name__ == '__main__':
    s = sections((ROOT / 'store/ios/metadata.md').read_text())
    version = next(v for v in api('GET', f'/v1/apps/{app_id()}/appStoreVersions')['data']
                   if v['attributes']['appStoreState'] in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'))
    info = next(i for i in api('GET', f'/v1/apps/{app_id()}/appInfos')['data']
                if i['attributes']['appStoreState'] in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'))

    upsert_localization('appInfoLocalizations', 'appInfo', 'appInfos', info['id'], {
        'subtitle': s['부제'],
        'privacyPolicyUrl': url_of(s['URL'], '개인정보 처리방침 URL'),
    })
    upsert_localization('appStoreVersionLocalizations', 'appStoreVersion', 'appStoreVersions', version['id'], {
        'description': s['설명'],
        'keywords': s['키워드'],
        'promotionalText': s['홍보 문구'],
        'supportUrl': url_of(s['URL'], '지원 URL'),
    })
    api('PATCH', f'/v1/appInfos/{info["id"]}', {'data': {'type': 'appInfos', 'id': info['id'], 'relationships': {
        'primaryCategory': {'data': {'type': 'appCategories', 'id': CATEGORIES[0]}},
        'secondaryCategory': {'data': {'type': 'appCategories', 'id': CATEGORIES[1]}},
    }}})
    print('ok categories', CATEGORIES)

    notes = '\n'.join(l.lstrip('- ') for l in s['심사 메모'].splitlines() if l.strip())
    rd = api('GET', f'/v1/appStoreVersions/{version["id"]}/appStoreReviewDetail').get('data')
    if rd:
        # 이미 있으면 Apple 이 연락처(이름·전화)까지 함께 요구한다 — 연락처는 웹에서 넣으므로 메모가 같으면 건너뛴다
        if rd['attributes'].get('notes') == notes:
            print('ok review notes (unchanged)')
            sys.exit(0)
        print('심사 메모가 바뀌었어요 — App Store Connect 웹의 앱 심사 정보에서 고쳐 주세요 (연락처 필수)')
        sys.exit(0)
    else:
        api('POST', '/v1/appStoreReviewDetails', {'data': {'type': 'appStoreReviewDetails', 'attributes': {'notes': notes, 'demoAccountRequired': False},
                                                           'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': version['id']}}}}})
    print('ok review notes')

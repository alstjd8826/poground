"""store/ios/6.9/*.png 스크린샷과 store/ios/preview-6.9.mp4 미리보기를 App Store Connect 에 올린다 (한국어, 제출 준비 중 버전).

    python3 -I scripts/asc/push_media.py [screenshots|preview|all]

같은 세트에 이미 올린 파일은 지우고 다시 올린다(순서 = 파일 이름 순서).
"""
import hashlib
import pathlib
import sys
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import ROOT, api, app_id  # noqa: E402

LOCALE = 'ko'
SHOT_TYPE = 'APP_IPHONE_67'      # 6.9인치(1320×2868)도 이 슬롯에 들어간다 — 아래 main 에서 실제로 확인
PREVIEW_TYPE = 'IPHONE_67'


def version_localization() -> str:
    version = next(v for v in api('GET', f'/v1/apps/{app_id()}/appStoreVersions')['data']
                   if v['attributes']['appStoreState'] in ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'))
    locs = api('GET', f'/v1/appStoreVersions/{version["id"]}/appStoreVersionLocalizations')['data']
    return next(l['id'] for l in locs if l['attributes']['locale'] == LOCALE)


def upload(kind: str, parent_rel: str, parent_type: str, parent_id: str, path: pathlib.Path) -> None:
    data = path.read_bytes()
    created = api('POST', f'/v1/{kind}', {'data': {'type': kind, 'attributes': {'fileName': path.name, 'fileSize': len(data)},
                                                   'relationships': {parent_rel: {'data': {'type': parent_type, 'id': parent_id}}}}})['data']
    for op in created['attributes']['uploadOperations']:
        chunk = data[op['offset']:op['offset'] + op['length']]
        req = urllib.request.Request(op['url'], data=chunk, method=op['method'],
                                     headers={h['name']: h['value'] for h in op['requestHeaders']})
        urllib.request.urlopen(req).read()
    api('PATCH', f'/v1/{kind}/{created["id"]}', {'data': {'type': kind, 'id': created['id'], 'attributes': {
        'uploaded': True, 'sourceFileChecksum': hashlib.md5(data).hexdigest()}}})
    print('uploaded', kind, path.name)


def fresh_set(set_kind: str, type_attr: str, type_value: str, loc_id: str, item_kind: str) -> str:
    sets = api('GET', f'/v1/appStoreVersionLocalizations/{loc_id}/{set_kind}')['data']
    s = next((x for x in sets if x['attributes'][type_attr] == type_value), None)
    if s:
        for item in api('GET', f'/v1/{set_kind}/{s["id"]}/{item_kind}')['data']:
            api('DELETE', f'/v1/{item_kind}/{item["id"]}')
        return s['id']
    return api('POST', f'/v1/{set_kind}', {'data': {'type': set_kind, 'attributes': {type_attr: type_value},
                                                    'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': loc_id}}}}})['data']['id']


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    loc = version_localization()
    if what in ('screenshots', 'all'):
        sid = fresh_set('appScreenshotSets', 'screenshotDisplayType', SHOT_TYPE, loc, 'appScreenshots')
        for p in sorted((ROOT / 'store/ios/6.9').glob('*.png')):
            upload('appScreenshots', 'appScreenshotSet', 'appScreenshotSets', sid, p)
    if what in ('preview', 'all'):
        pid = fresh_set('appPreviewSets', 'previewType', PREVIEW_TYPE, loc, 'appPreviews')
        upload('appPreviews', 'appPreviewSet', 'appPreviewSets', pid, ROOT / 'store/ios/preview-6.9.mp4')

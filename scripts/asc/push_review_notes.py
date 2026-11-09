"""심사 메모(App Review Information › Notes)와 첨부 영상을 App Store Connect 에 올린다.

    python3 -I scripts/asc/push_review_notes.py [notes|attachment|all]

메모 = store/ios/review-notes.md 의 첫 '---' 와 마지막 '---' 사이 본문.
첨부 = store/ios/review-demo.mp4 (git 제외). 같은 심사 정보에 이미 있는 첨부는 지우고 다시 올린다.
연락처(이름·전화·이메일)는 웹에서 넣은 값을 그대로 다시 보낸다 — PATCH 에 빠지면 Apple 이 거부한다.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from asc import ROOT, api, app_id  # noqa: E402
from push_media import upload  # noqa: E402

EDITABLE = ('PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED')
CONTACT = ('contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail', 'demoAccountRequired')


def notes_text() -> str:
    md = (ROOT / 'store/ios/review-notes.md').read_text()
    first, last = md.index('\n---\n') + 5, md.rindex('\n---')
    body = md[first:last].strip()
    if len(body) > 4000:
        sys.exit(f'메모가 {len(body)}자 — 4000자 이내로 줄여 주세요')
    return body


def review_detail() -> dict:
    version = next(v for v in api('GET', f'/v1/apps/{app_id()}/appStoreVersions')['data']
                   if v['attributes']['appStoreState'] in EDITABLE)
    rd = api('GET', f'/v1/appStoreVersions/{version["id"]}/appStoreReviewDetail').get('data')
    if not rd:
        sys.exit('심사 정보가 없어요 — App Store Connect 웹에서 연락처를 먼저 넣어 주세요')
    return rd


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    rd = review_detail()
    if what in ('notes', 'all'):
        attrs = {k: rd['attributes'][k] for k in CONTACT if rd['attributes'].get(k) is not None}
        attrs['notes'] = notes_text()
        api('PATCH', f'/v1/appStoreReviewDetails/{rd["id"]}', {'data': {'type': 'appStoreReviewDetails', 'id': rd['id'], 'attributes': attrs}})
        print('ok notes', len(attrs['notes']), 'chars')
    if what in ('attachment', 'all'):
        for old in api('GET', f'/v1/appStoreReviewDetails/{rd["id"]}/appStoreReviewAttachments')['data']:
            api('DELETE', f'/v1/appStoreReviewAttachments/{old["id"]}')
            print('deleted old attachment', old['attributes'].get('fileName'))
        upload('appStoreReviewAttachments', 'appStoreReviewDetail', 'appStoreReviewDetails', rd['id'], ROOT / 'store/ios/review-demo.mp4')

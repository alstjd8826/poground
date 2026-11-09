# 포그라운드 계정·키·파일 목록

어디에 무엇이 있는지만 적는다. **값(키·비밀번호·토큰)은 이 문서와 레포에 절대 쓰지 않는다.**
루트 `.env` 는 git 에 안 올라가고 본인만 읽을 수 있다(chmod 600). "백업" 표시가 있는 것은 이 Mac 이 망가지면 다시
만들기 어려우니 비밀번호 관리자나 개인 클라우드에 따로 보관한다. Flash(`alstjd8826/flash`)의 같은 문서를 틀로 썼다.

## 운영 계정

| 서비스 | 계정 / 식별자 | 용도 |
|---|---|---|
| 운영 메일 | htk4064@gmail.com (운영자 darby) | 약관·처리방침 문의처, 신고 알림 수신, 스토어 연락처 |
| GitHub | `alstjd8826/poground` (공개) | 코드. 푸시 전 `gh auth switch -u alstjd8826`, 끝나면 `Darby22` 로 되돌림. 옛 `Darby22/steelers-app` 은 안 쓴다 |
| Supabase | 프로젝트 ref `ylzpydqepwgnrmrlpqe` | DB·인증·Storage·Edge Function |
| Vercel | 개인 계정(팀 `darbyhobby`), 프로젝트 `poground-web` | 약관·처리방침·계정 삭제 안내 https://poground-web.vercel.app (`web/`). Git 연결은 끊었다(루트가 배포되는 사고 방지) — 배포는 `cd web && npx vercel --prod` 로만 |
| Apple Developer | 개인 유료 팀 `M45QFAAT7S` (alstjd8826@naver.com) | 서명, App Store Connect. 번들 ID `com.darby.poground` |
| Resend | 운영 메일 계정 | 신고 알림 메일 발송 (`notify-report`) |
| Kakao Developers | 포그라운드 앱 | 카카오 로그인 (Supabase 웹 OAuth) |
| Google Cloud | OAuth 클라이언트 | 구글 로그인 (Supabase 웹 OAuth), OAuth 동의 화면에 처리방침 URL |

## 키·비밀 파일 (이 Mac)

| 무엇 | 위치 | 쓰는 곳 | 백업 |
|---|---|---|---|
| App Store Connect API 키 (Flash 와 같은 팀 키) | `~/.flash-keys/AuthKey_<키ID>.p8` | 스토어 등록정보·빌드 자동화 (`scripts/asc/`). 키 ID·Issuer ID·경로·앱 ID 는 루트 `.env` 의 `ASC_*` | **백업** (Apple 에서 다시 못 받음) |
| 루트 `.env` | `poground/.env` | 앱 빌드 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`(공개용) / 배포 `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` / 스토어 `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`, `ASC_APP_ID` | 대부분 콘솔에서 다시 받을 수 있음 |

service_role 키는 Edge Function 안에서만 쓴다. 앱 번들에 넣지 않는다.

## 클라우드에 넣어 둔 비밀 (값은 각 서비스 안에만)

| 어디 | 이름 | 용도 |
|---|---|---|
| Supabase Edge Function secrets | `CRON_SECRET`, `RESEND_API_KEY`, `REPORT_FROM`, `SEASON_YEAR`, `CLUB_TEAM_ID` | 수집 함수, 신고 알림 |
| Supabase Vault | `functions_url`, `cron_secret` | pg_cron 이 수집 함수를 부를 때 (0002 주석) |
| Supabase Auth | Kakao, Google, Apple 공급자. Apple Client IDs = `com.darby.poground` | 로그인 |

## 주기적으로 할 일

- **iPhone Duo 스크린샷: 2027-04 부터 필수** (외부 1398×2034, 펼침 2007×2853) — Xcode 업데이트 후
- 출시 직전: 클라우드 테스트 데이터(테스트 글·댓글, `@test_fan` 계정) 정리

## 레포 안 스토어 자료

- `store/ios/metadata.md` 등록정보 → `python3 -I scripts/asc/push_metadata.py`
- `store/ios/review-notes.md` 심사 메모 → `python3 -I scripts/asc/push_review_notes.py`
- `store/ios/6.9/` 스크린샷 → `python3 -I scripts/asc/push_media.py screenshots`
- `web/` 약관·처리방침 (`npm run web` 이 `docs/*.md` 에서 만든다)

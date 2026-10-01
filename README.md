# 포그라운드 (Poground)

**K리그 팬이 만든 포항 스틸러스 팬 앱.** 경기 일정·순위·선수 기록을 보고, 경기마다 댓글로 같이 보고, 다녀온 경기를
사진과 글로 남겨 "승리요정" 승률을 쌓는다.

> 개인이 만든 **비공식** 앱입니다. 포항 스틸러스 구단·한국프로축구연맹과 관련이 없고 승인을 받지 않았습니다.
> 경기 자료는 K리그가 공개한 자료를 모아 보여 줍니다(자료 제공: 한국프로축구연맹, kleague.com).

React Native(Expo) 앱과 Supabase 백엔드(Postgres·Edge Functions)가 한 저장소에 있습니다.

---

## 무엇을 하나

**경기와 기록**

- 홈: 다음 경기·최근 경기, 우리 팀 주변 순위, 소식·영상
- 경기 탭: 달별 일정, 리그 순위표
- 경기 상세: 득점 기록, 라인업, 관중 수, 중계, 티켓 예매, 경기 영상
- 구단 탭: 선수 명단과 출전 기록, 선수 프로필

**커뮤니티**

- 사진(최대 4장)과 글로 직관 후기·자유 글. 글마다 전체 공개 / 나만 보기
- 본문의 `#직관` 태그로 직관 글을 가르고, 경기 칩을 누르면 `#9월20일서울전` 같은 경기 태그가 붙는다
- 글·댓글·답글 좋아요, `@아이디` 언급과 아이디 자동 완성
- 신고(사유 선택·직접 입력), 사용자 차단과 해제, 운영자 신고함·삭제, 신고 메일 알림

**직관 기록**

- 경기마다 "직관했어요 / 직관 가요" 체크 → 승리요정 승률(승 ÷ 끝난 경기)
- 내 `#직관` 글을 3열 격자로 모아 보기(나만 보기 글에는 자물쇠)
- 승리요정 카드·한 경기 직관 인증 카드를 9:16 이미지로 만들어 공유

**알림과 잠금 화면**

- 기기가 스스로 울리는 로컬 알림: 직관 경기 전날 저녁 8시·킥오프 1시간 전, 모든 경기 킥오프 1시간 전(따로 켜고 끔)
- 경기 일정을 폰 캘린더에 추가(운영체제의 일정 추가 화면을 연다 — 권한 없음)
- iOS Live Activity: 직관 경기 당일 잠금 화면·다이내믹 아일랜드에 킥오프 카운트다운

**나만의 팬카드**

- 사진·이름·등번호로 홀로그램 카드를 만든다(누끼 자동 따기, 6가지 효과). 본인만 본다

**계정**

- 카카오·구글 로그인, 닉네임·아이디·프로필 이미지, 연결된 로그인 잇기·끊기
- 이용약관 동의, 앱 안 계정 삭제(댓글은 "탈퇴한 사용자의 댓글" 로 자리만 남긴다)
- 테마 두 가지(홈 유니폼 빨강·검정 / 원정 유니폼 흰색·빨강), 기본은 기기 외관 설정을 따른다

---

## 기술 스택

| 영역   | 쓴 것                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| 앱     | Expo SDK 57 · React Native 0.86 · TypeScript · React Navigation                                            |
| 상태   | TanStack Query 5 (AsyncStorage 에 캐시 저장, 보는 사람에 딸린 캐시는 저장하지 않음)                        |
| 화면   | Reanimated 4(공유 요소 전환), FlashList 2, Skia(홀로 카드), react-native-svg                               |
| 기기   | expo-notifications(로컬 알림), expo-calendar, react-native-view-shot + expo-sharing, Voltra(Live Activity) |
| 백엔드 | Supabase — Postgres(RLS), Storage(비공개 버킷 + 서명 URL), Edge Functions(Deno), pg_cron, pg_net, Vault    |
| 메일   | Resend(신고 알림)                                                                                          |
| 테스트 | Jest + Testing Library(앱), `deno test`(함수), PGlite 로 SQL 정책 검증(`deno task sql-check`)              |

---

## 저장소 구조

```
.
├── src/
│   ├── screens/          화면
│   ├── components/       UI (도메인별 폴더 + foundation·feedback)
│   ├── navigation/       탭 다섯 개 + 탭마다 스택, 딥링크
│   ├── models/           도메인 모델과 순수 함수 (계획·판단 로직은 여기서 테스트한다)
│   ├── repositories/     Supabase 읽기·쓰기
│   ├── hooks/            react-query 훅, 인증·프로필, 테마
│   ├── notifications/    로컬 알림 계획·예약·탭 처리
│   ├── liveActivity/     잠금 화면 킥오프 카운트다운
│   ├── content/          앱 안 이용약관·개인정보 처리방침(docs/ 의 글을 싣는다)
│   └── styles/           색·글꼴·간격·모서리·모션 토큰
├── supabase/
│   ├── migrations/       스키마·RLS·트리거·크론 (0001 ~ 0029, 차례로 적용)
│   ├── tests/            마이그레이션 검증 SQL (SQL Editor 에 붙여 넣거나 PGlite 로 로컬 실행)
│   └── functions/        Edge Functions
│       ├── collect-*     K리그 자료 수집(일정·순위·라인업·소식·영상) — 크론이 부른다
│       ├── notify-report 신고 알림 메일 — DB 트리거가 부른다
│       ├── open-link     메일 속 https 링크를 앱 주소(poground://)로 넘긴다
│       └── delete-account 앱 안 계정 삭제
├── plugins/              Expo 설정 플러그인 (한글 표시 이름, 무료 팀용 자격 걷어내기)
├── __tests__/            Jest 테스트
├── docs/                 개인정보 처리방침·이용약관·앱스토어 제출 문안·설계 문서
└── scripts/              아이콘 생성, 파서 검증, 수집 드라이런, 방침 싣기
```

`ios/`, `android/` 는 `expo prebuild` 가 만든다(CNG). 손으로 고치지 않고 `app.json` 과 `plugins/` 를 고친다.

---

## 시작하기

### 준비물

- Node 22, npm
- Deno 2 (Edge Functions·SQL 검증)
- Xcode(iOS), Android Studio·JDK 17(안드로이드)
- Supabase 프로젝트 하나

### 앱

```bash
npm install
cp .env.example .env        # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY 를 채운다
npx expo prebuild           # ios/ android/ 생성
npm run ios                 # 또는 npm run android
```

`EXPO_PUBLIC_` 이 붙은 값만 앱에 들어간다. service_role / secret 키는 절대 넣지 않는다 — RLS 를 통째로 우회한다.

### 백엔드

1. `supabase/migrations/` 를 번호 순서대로 SQL Editor 에서 실행한다.
2. Edge Functions 를 배포한다(`supabase/functions/*`). `notify-report`·`open-link`·`delete-account` 는
   `verify_jwt: false` 로 둔다 — 각자 안에서 인증을 확인한다.
3. 함수 시크릿: `CRON_SECRET`, `SEASON_YEAR`, `CLUB_TEAM_ID`(기본 `K03`), `RESEND_API_KEY`.
4. 크론이 함수를 부를 수 있게 Vault 에 `functions_url`·`cron_secret` 을 넣는다(0002 주석 참고).
5. 인증 제공자(카카오·구글)와 Redirect URL(`poground://**`)을 Supabase 대시보드에서 켠다.

### 무료 Apple 개발자 계정으로 빌드할 때

유료 회원만 쓸 수 있는 자격(애플 로그인, 푸시 알림)이 빌드를 막는다. `plugins/withoutAppleSignIn`,
`plugins/withoutPushEntitlement` 가 prebuild 때 그 자격을 걷어낸다. 유료 가입 뒤에는 이 둘을 `app.json` 에서 지운다.
`withoutPushEntitlement` 는 `expo-notifications` **앞에** 있어야 한다(설정 플러그인의 mod 는 역순으로 돈다).

---

## 테스트

```bash
npm test                    # Jest — 모델·화면·훅
npm run typecheck           # tsc --noEmit
npm run lint                # prettier + eslint
deno task test              # 수집 매퍼 단위 테스트
deno test supabase/functions/delete-account/
deno task sql-check supabase/migrations/0023_community.sql … supabase/tests/0029_check.sql
```

`sql-check` 는 PGlite 위에 Supabase 흉내(`supabase/tests/prelude.sql`)를 깔고 마이그레이션과 검증 SQL 을 돌린다.
정책이 서로 어떻게 맞물리는지 보는 용도이고, 마지막 확인은 실제 SQL Editor 에서 같은 검증 SQL 로 한다.

---

## 데이터 출처

공식 공개 API 가 없어 `kleague.com` 이 홈페이지에서 쓰는 엔드포인트를 **서버(Edge Function)에서만** 부르고
DB 에 쌓는다. 앱은 Supabase 만 본다. 소식은 제목·분류만 저장하고 본문과 썸네일은 저장하지 않는다 — 읽기는 원문
페이지에서 한다. 선수 사진은 앱이 제공하지 않는다(사용자가 앨범에서 넣고 본인만 본다).

| 대상             | 방식                                                |
| ---------------- | --------------------------------------------------- |
| 일정·스코어·구단 | `POST /getScheduleList.do` (JSON)                   |
| 순위             | `POST /record/teamRank.do` (JSON)                   |
| 스쿼드           | `POST /record/selectPersonalRecordByClub.do` (JSON) |
| 소식             | `GET /news_list.do` (SSR HTML 파싱)                 |
| 영상             | `GET /video_list.do` (SSR HTML 파싱)                |

밟아 보고 코드에 방어를 남긴 것들:

1. **`Accept-Language: ko-KR,ko` 가 필수다.** 빼면 2018년에 갱신이 멈춘 영문 DB 로 붙어 에러 없이 옛 기사를 준다.
2. **안 한 경기의 점수가 `0` 으로 온다**(null 이 아니다). `status` 로 판단해 비운다.
3. **`record/rankSort.do` 는 `teamId` 를 무시한다.** 구단 스쿼드는 `selectPersonalRecordByClub.do` 로.
4. **영상 썸네일 주소에 유튜브 ID 가 들어 있어** 목록만으로 영상을 연다.
5. **포항 예매는 티켓링크라 경기별 딥링크가 없다.** 구단 예매 주소로 대신한다.

---

## 설계 메모

몇 가지는 실제로 밟고 나서 정한 것이다. 코드 주석에 까닭을 남겨 두었다.

- **나만 보기는 정책으로 지킨다.** 글·사진·댓글 읽기가 모두 `can_read_post()` 를 따른다. 운영자도 나만 보기 글은
  못 보고, 처리 안 된 신고가 있는 글만 읽는다. 쓰기(댓글·좋아요·신고)는 운영자 갈래 없는 `can_write_post()`.
- **탈퇴해도 남의 답글은 지킨다.** 댓글 글쓴이는 `on delete set null`, 탈퇴할 때 내용만 지우고 자리를 남긴다.
- **계정이 바뀌면 보는 사람에 딸린 캐시를 비운다**(좋아요·차단 거르기·신고함). 그 캐시는 기기에도 저장하지 않는다.
- **FlashList 안에서는 레이아웃 애니메이션(entering)을 쓰지 않는다.** 안드로이드에서 entering 이 자리를 붙잡아
  카드가 앞 카드에 올라탔다. 등장은 `useAppear`(투명도·위치 스타일)로 한다.
- **모달 안의 `autoFocus` 는 안드로이드에서 키보드를 부르지 못한다.** RN 은 이미 포커스된 칸의 `focus()` 를
  넘기므로, 입력 줄은 모달이 뜬 뒤 한 번 놓았다가 다시 포커스를 준다.
- **알림은 통째로 다시 예약한다.** 직관 표시·일정·설정이 바뀌거나 앱으로 돌아오면 잡아 둔 것을 지우고 새로 잡는다.
  시각은 한국 시간으로 센다.

---

## 라이선스

코드는 [MIT](LICENSE) 다.

다음은 MIT 에 들지 않고 각 소유자의 조건을 따른다.

- `assets/fonts/` — G마켓 산스(Gmarket Sans) 글꼴
- `assets/kakao/`, `assets/google/` — 카카오·구글 로그인 버튼 이미지(각 사의 디자인 가이드)
- 포항 스틸러스, K리그 및 관련 이름·상표 — 각 권리자

경기 자료의 권리는 한국프로축구연맹에 있다. 이 저장소의 코드로 자료를 모아 쓸 때는 kleague.com 의 이용 약관을 따른다.

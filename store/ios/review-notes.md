# App Review Information › Notes (첫 제출용, 2026-11-09)

`scripts/asc/push_review_notes.py` 가 아래 '---' 사이 본문을 그대로 심사 메모에 넣는다 (4000자 이내).
신규 앱 첫 심사는 2.1 정보 요청(녹화·목적·사용법·외부 서비스·지역·제3자 콘텐츠)이 기본으로 올 수 있어서
Flash(2026-11) 때 받은 질문 항목에 처음부터 답해 둔다. 녹화 영상은 같은 스크립트가 심사 첨부파일로 올린다
(`store/ios/review-demo.mp4`, git 제외).

---
1. SCREEN RECORDING
Attached to this submission (App Review attachment "review-demo.mp4"). It starts from launching the app and shows: browsing matches, standings and the community without logging in, Sign in with Apple, the first-login consent (Terms of Use, age 14+), writing a post and a comment, reporting a post, blocking its author and unblocking in My Page, and deleting the account.

2. PURPOSE AND AUDIENCE
Poground is an unofficial fan app made by an individual K League fan for supporters of the Pohang club. It shows match schedules, results, standings and player records from data published by the K League, and gives fans a place to keep a record of the matches they attended and to share posts and photos with other fans. Audience: K League fans in Korea. Browsing is open to everyone; posting and commenting require login and age 14+.

The app is not affiliated with or endorsed by the club or the Korea Professional Football League. The app name and icon do not use the club's trademarks or emblem, and the app states that it is unofficial in the App Store description, the Terms of Use and in the app (My tab).

3. HOW TO USE / ACCESS
- No login needed to browse: 포그라운드 (home: next/recent matches), 경기 (schedule, standings), 커뮤니티 (community posts), 포항 스틸러스 (squad, players), 마이 (settings).
- Login: 마이 → 로그인 → "Apple로 로그인" (Sign in with Apple). No demo account is needed. After the first login the app asks for a nickname and shows the Terms of Use with a required "age 14+" checkbox.
- Write a post: 커뮤니티 → write button. Comment: open a post → comment box at the bottom.
- Report: "⋮" menu on a post or comment → 신고 (choose or write a reason). The operator is notified by email and handles reports within 24 hours in the in-app report inbox (delete content, restrict users).
- Block: "⋮" menu → 이 사용자 차단. That user's posts and comments are hidden for you immediately. Unblock: 마이 → 내 계정 → 차단한 사용자.
- Delete account: 마이 → 내 계정 → 계정 삭제 (one confirmation). Account, posts, photos, likes, fan cards and attendance records are deleted; comments are replaced with "deleted user" placeholders so replies stay readable.

4. EXTERNAL SERVICES
- Supabase: database, authentication, file storage and server functions.
- Sign in with Apple, Kakao Login and Google Sign-In (web OAuth through Supabase): authentication.
- Resend: sends report notification emails to the operator.
- YouTube (official embedded player): the club's public YouTube videos are played with the official embed; videos are not downloaded or re-hosted.
- K League public website (kleague.com): our server reads public match, standings and player data.
No payments, ads, analytics/tracking SDKs or AI services.

5. REGIONAL DIFFERENCES
Distributed in Korea only, Korean UI. All features behave the same everywhere.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not a regulated industry. Match records and player information are public data published by the K League and are credited in the app ("자료 제공: 한국프로축구연맹"). Club news is not copied: the app shows the headline and opens the original page in an in-app browser. Club emblems are shown only to identify the teams next to match data, as in any scoreboard (they also appear that way in the screenshots); they are not used in the app name or icon. Player photos are not provided by the app.
---

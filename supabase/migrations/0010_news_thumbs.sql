-- 뉴스 목록 썸네일을 우리 쪽에 줄여 둔다.
--
-- 왜 필요한가. 앱의 뉴스 목록은 썸네일을 120x88pt 로 그리는데, 원본 주소를 그대로 쓰면
-- K리그가 올린 **원본 사진**이 그대로 내려온다. 2026-09-18 기준 최신 30건을 실제로 재 보니
-- 이랬다:
--
--     4.53 MB  press.kleague.com
--     4.52 MB  press.kleague.com
--     0.65 MB  press.kleague.com
--     ...
--     30장 합계 16.8 MB
--
-- 30건 중 8건이 press.kleague.com 원본이고 나머지는 CloudFront 가 줄여 둔 것(50KB 안팎)이다.
-- 게다가 두 호스트 모두 Cache-Control 을 내려주지 않아(ETag/Last-Modified 뿐) 기기 캐시도
-- 제대로 붙지 않는다. 목록을 한 번 여는 데 16.8MB 를 받는 셈이라 "소식이 늦게 뜬다" 의 원인이다.
--
-- 그래서 선수 사진(player-photos)에서 쓰던 방법을 그대로 쓴다. collect-news-thumbs 가 원본을
-- 받아 400px WebP 로 줄여 Storage 에 올리고, 그 경로를 여기에 적는다.
--
-- 전체 주소가 아니라 **경로**를 담는다. 주소를 담으면 프로젝트 주소가 행마다 박혀서 프로젝트를
-- 옮길 때 전부 고쳐야 한다. 앱이 SUPABASE_URL 을 앞에 붙여 읽는다 — playerPhotoUrl 과 같은 방식이다.
--
-- 원본 thumbnail_url 은 지우지 않는다. 아직 줄이지 못한 기사는 그걸로 보여주고, 나중에 저장 폭을
-- 바꿔 다시 받아야 할 때도 출처가 남아 있어야 한다.

alter table public.news add column if not exists thumb_path text;

-- 아직 줄이지 않은 기사를 collect-news-thumbs 가 찾는 길. 대부분의 행이 채워지면
-- 남는 것은 몇 건뿐이라 부분 인덱스가 알맞다.
create index if not exists news_thumb_pending_idx
  on public.news (seq desc)
  where thumb_path is null and thumbnail_url is not null;

-- 썸네일 줄이기 — 30분마다, 뉴스 수집 5분 뒤. 새로 들어온 기사를 따라잡는다.
-- 수집과 같은 시각에 두지 않는 이유는 그때 아직 행이 없어 헛돌기 때문이다.
select cron.schedule(
  'collect-news-thumbs', '5,35 * * * *',
  $$select public.call_collector('collect-news-thumbs')$$
);

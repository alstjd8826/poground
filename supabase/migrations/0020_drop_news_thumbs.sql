-- ─────────────────────────────────────────── 소식 썸네일을 버린다
--
-- collect-news-thumbs 가 press.kleague.com 사진을 받아 줄인 뒤 공개 버킷(news-thumbs)에
-- 올려 두었다. 남의 사진을 우리가 복제해 재배포하는 구조라 선수 사진과 같은 문제다.
-- 원본을 바로 거는 것도 장당 최대 4.5MB 라 쓸 수 없다. 소식 목록은 글자만으로 그린다.
--
-- 순서가 있다: 썸네일 칸을 안 쓰는 collect-news 를 먼저 배포하고 collect-news-thumbs 를
-- 지운 뒤에 돌린다. 버킷은 대시보드에서 비우고 지운다.
--
-- 다시 돌려도 깨지지 않게 쓴다. 부분 인덱스(news_thumb_pending_idx)는 칸과 함께 사라진다.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'collect-news-thumbs') then
    perform cron.unschedule('collect-news-thumbs');
  end if;
end $$;

alter table public.news
  drop column if exists thumb_path,
  drop column if exists thumbnail_url;

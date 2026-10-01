-- 영상을 경기에 잇기 위한 라운드 컬럼.
--
-- 원본(kleague)이 영상에 경기 ID 를 달아주지 않아서, 제목의 "R29" / "29R" 표기가 유일한 단서다.
-- 수집 시점에 한 번 파싱해서 여기 저장하고(mappers.toRoundId), 앱은 컬럼으로 조회한다.
-- 매번 클라이언트에서 정규식을 돌리면 목록 스크롤마다 비용이 나간다.
alter table public.videos add column if not exists round_id int;

-- "이 경기의 영상" 조회가 주 용도다
create index if not exists videos_round_idx on public.videos (round_id, published_on desc);

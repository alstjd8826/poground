-- ─────────────────────────────────────────── 소식에도 댓글
--
-- 0015 가 대상을 경기·선수 둘로 열어 뒀다. 여기에 소식을 더한다. 표도 정책도 그대로고
-- 허용하는 갈래만 넓힌다 — 대상을 칸으로 뺀 보람이 이것이다.
--
-- 소식의 대상 id 는 news.seq 다. 경기(game_id)와 마찬가지로 숫자지만 칸이 문자열이므로
-- 넣을 때 문자열로 넣는다 (앱이 그렇게 보낸다).

alter table public.comments drop constraint if exists comments_subject_known;
alter table public.comments
  add constraint comments_subject_known check (subject_type in ('match', 'player', 'news'));

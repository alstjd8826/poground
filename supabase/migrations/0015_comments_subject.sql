-- ─────────────────────────────────────────── 댓글이 붙는 대상을 넓힌다
--
-- 0011 은 댓글을 경기에만 달 수 있게 만들었다(match_comments.match_id). 선수에게도
-- 달게 되면서 대상을 둘로 가른다 — 앞으로 커뮤니티 글이 생겨도 갈래만 하나 더 붙인다.
--
-- 표를 따로 만들지 않는다. player_comments 를 새로 파면 정책·트리거·신고·차단이 통째로
-- 한 벌 더 생기고, 그때부터 두 벌을 나란히 고쳐야 한다. 대상만 칸으로 빼면 그 모든 것이
-- 하나로 남는다.
--
-- 대상 id 는 **문자열**이다. 경기는 숫자(game_id)지만 선수는 문자열이라, 둘을 한 칸에
-- 담으려면 넓은 쪽을 골라야 한다.
--
-- 이름도 바꾼다. 선수 댓글이 match_comments 에 들어앉으면 이름이 거짓말이 된다.
-- 정책·트리거·인덱스·외래키는 표를 따라오므로 다시 만들지 않는다.
--
-- 0011 과 0013 은 옛 이름을 쓴다. 그 둘을 다시 돌릴 일이 있으면 이 파일도 이어서 돌려야
-- 한다 (0012 와 같은 사정이다).

alter table if exists public.match_comments rename to comments;

alter table public.comments add column if not exists subject_type text not null default 'match';
alter table public.comments add column if not exists subject_id   text;

-- 있던 경기 댓글을 옮겨 심는다. 칸이 이미 사라진 뒤(다시 돌릴 때)에는 건너뛴다
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments' and column_name = 'match_id'
  ) then
    update public.comments set subject_id = match_id::text where subject_id is null;
    alter table public.comments drop column match_id;
  end if;
end
$$;

alter table public.comments alter column subject_id set not null;

alter table public.comments drop constraint if exists comments_subject_known;
alter table public.comments
  add constraint comments_subject_known check (subject_type in ('match', 'player'));

-- 한 대상의 댓글을 시간 순으로. match_id 를 지우면서 옛 인덱스도 같이 사라졌다
create index if not exists comments_subject_idx
  on public.comments (subject_type, subject_id, created_at);

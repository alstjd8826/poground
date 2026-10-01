-- 포항 스틸러스 팬앱 · 수집 데이터 스키마
--
-- 원칙
--   1. 원본 키(K리그의 seq / gameId)를 그대로 PK 로 써서 재수집이 멱등이 되게 한다.
--   2. 앱은 anon 키로 읽기만 한다. 쓰기는 service_role(Edge Function)만.
--   3. "아직 값이 없다"와 "값이 0이다"를 구분한다. 미시작 경기의 0-0 은 NULL 로 넣는다.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─────────────────────────────────────────── 구단

create table public.clubs (
  team_id            text primary key,          -- K리그 구단 코드. 포항 = K03
  name               text not null,
  name_short         text,
  homepage           text,
  youtube_channel_id text,                      -- UC... (/channel/ 형태에서만 확보됨)
  youtube_url        text,
  instagram_url      text,
  facebook_url       text,
  twitter_url        text,
  emblem_url         text,
  updated_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────── 경기

create type public.match_status as enum ('scheduled', 'live', 'finished');

create table public.matches (
  year            int  not null,
  league_id       int  not null,
  game_id         int  not null,
  round_id        int,
  kickoff_at      timestamptz not null,
  match_date      date not null,
  home_team_id    text not null,
  home_team_name  text not null,
  away_team_id    text not null,
  away_team_name  text not null,
  home_goal       int,                           -- 미시작이면 NULL (원본은 0 을 준다)
  away_goal       int,
  status          public.match_status not null,
  raw_status      text,                          -- 원본 gameStatus. 새 코드가 생기면 여기서 발견한다
  field_name      text,
  field_name_full text,
  audience_qty    int,
  broadcast       text,
  ticket_company  text,                          -- T=티켓링크 I=인터파크 E=기타
  ticket_url      text,                          -- 인터파크/기타만. 티켓링크 구단은 NULL
  meet_name       text,
  updated_at      timestamptz not null default now(),
  primary key (year, league_id, game_id)
);

create index matches_kickoff_idx on public.matches (kickoff_at);
-- 포항 경기만 뽑는 쿼리가 가장 잦다
create index matches_team_idx on public.matches (home_team_id, away_team_id, kickoff_at desc);

-- ─────────────────────────────────────────── 순위

create table public.standings (
  year          int  not null,
  league_id     int  not null,
  team_id       text not null,
  team_name     text not null,
  rank          int  not null,
  points        int  not null,
  played        int  not null,
  win           int  not null,
  draw          int  not null,
  loss          int  not null,
  goals_for     int  not null,
  goals_against int  not null,
  goal_diff     int  not null,
  recent_form   text[] not null default '{}',    -- 최근 6경기, 최신순 승/무/패
  updated_at    timestamptz not null default now(),
  primary key (year, league_id, team_id)
);

-- ─────────────────────────────────────────── 선수

create table public.players (
  year         int  not null,
  team_id      text not null,
  name         text not null,
  back_no      int,
  appearances  int,
  goals        int,
  assists      int,
  shots        int,
  fouls        int,
  yellow_cards int,
  red_cards    int,
  photo_url    text,
  updated_at   timestamptz not null default now(),
  -- 원본이 선수 고유 ID 를 안 주는 구간이 있어 이름+등번호로 식별한다.
  primary key (year, team_id, name)
);

-- ─────────────────────────────────────────── 뉴스

create table public.news (
  seq           bigint primary key,              -- kleague news_view.do?seq
  category      text,                            -- club / league / notice / fan / youth
  club_tag      text,                            -- 제목의 "[포항]" 접두어
  title         text not null,
  published_on  date,
  view_count    int,
  thumbnail_url text,
  body          text,                            -- 상세를 아직 안 긁었으면 NULL
  images        text[],
  collected_at  timestamptz not null default now()
);

create index news_published_idx on public.news (published_on desc, seq desc);
create index news_club_tag_idx  on public.news (club_tag) where club_tag is not null;
-- 본문 미수집분을 찾는 용도
create index news_pending_body_idx on public.news (seq) where body is null;

-- ─────────────────────────────────────────── 영상

create table public.videos (
  seq           bigint primary key,              -- kleague video_view.do?seq
  category      text,                            -- goal / highlight / club / etc
  title         text not null,
  published_on  date,
  view_count    int,
  youtube_id    text,
  thumbnail_url text,
  source        text not null default 'kleague', -- kleague | youtube(구단 채널)
  collected_at  timestamptz not null default now()
);

create index videos_published_idx on public.videos (published_on desc, seq desc);
create index videos_category_idx  on public.videos (category);

-- ─────────────────────────────────────────── 수집 실행 로그
-- 파서가 조용히 깨지는 걸 잡으려면 "몇 건 들어왔는지"를 남겨야 한다.

create table public.collect_runs (
  id          bigserial primary key,
  job         text not null,
  ok          boolean not null,
  fetched     int not null default 0,
  upserted    int not null default 0,
  error       text,
  duration_ms int,
  ran_at      timestamptz not null default now()
);

create index collect_runs_job_idx on public.collect_runs (job, ran_at desc);

-- ─────────────────────────────────────────── RLS
-- 앱은 anon 으로 읽기만 한다. Edge Function 은 service_role 이라 RLS 를 우회한다.

alter table public.clubs        enable row level security;
alter table public.matches      enable row level security;
alter table public.standings    enable row level security;
alter table public.players      enable row level security;
alter table public.news         enable row level security;
alter table public.videos       enable row level security;
alter table public.collect_runs enable row level security;

create policy "public read" on public.clubs     for select to anon, authenticated using (true);
create policy "public read" on public.matches   for select to anon, authenticated using (true);
create policy "public read" on public.standings for select to anon, authenticated using (true);
create policy "public read" on public.players   for select to anon, authenticated using (true);
create policy "public read" on public.news      for select to anon, authenticated using (true);
create policy "public read" on public.videos    for select to anon, authenticated using (true);
-- collect_runs 는 운영용이라 공개하지 않는다 (정책 없음 = 전부 거부)

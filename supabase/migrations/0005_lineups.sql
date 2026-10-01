-- 경기 라인업과 선수별 기록.
--
-- 출처는 match.do 의 HTML 이다. 같은 페이지의 /api/ddf/match/* 는 로그인 없이는 빈 객체만 주므로
-- 팀 합계(점유율·슈팅 수·코너킥)는 애초에 얻을 수 없다. 여기 담기는 건 선수 단위 정보뿐이다.
-- 자세한 사정은 functions/_shared/kleague/parsers/lineup.ts 주석 참고.

create type public.lineup_side as enum ('home', 'away');

create table public.match_lineups (
  year        int  not null,
  league_id   int  not null,
  game_id     int  not null,
  player_id   text not null,                     -- playerDetailPop 의 선수 고유 ID
  side        public.lineup_side not null,
  team_id     text not null,
  back_no     int,                               -- 없을 수 있다
  position    text,                              -- GK / DF / MF / FW
  name        text not null,
  is_captain  boolean not null default false,
  -- 페이지에 선발/벤치 표시가 없다. 팀별 등장 순서 앞 11명이 선발이라는 게 유일한 근거다.
  is_starter  boolean not null default false,
  lineup_order int not null,                     -- 팀 안에서의 등장 순서(0부터)
  records     text[] not null default '{}',      -- 기록 뱃지. 예: {파울,경고,유효슈팅,교체}
  substituted_at   int,                          -- 교체 시각(분). 교체된 선수만
  substituted_with text,                         -- 맞교체된 상대 선수 이름
  collected_at timestamptz not null default now(),
  -- 한 경기에 한 선수는 한 번만 나온다. 재수집이 멱등이 되도록 원본 키를 그대로 쓴다
  primary key (year, league_id, game_id, player_id)
);

-- 화면은 늘 "이 경기의 라인업 전부"를 뽑고 원본 순서대로 보여준다
create index match_lineups_game_idx on public.match_lineups (year, league_id, game_id, side, lineup_order);

create table public.match_coaches (
  year      int  not null,
  league_id int  not null,
  game_id   int  not null,
  side      public.lineup_side not null,
  name      text not null,
  collected_at timestamptz not null default now(),
  primary key (year, league_id, game_id, side)
);

-- ─────────────────────────────────────────── RLS

alter table public.match_lineups enable row level security;
alter table public.match_coaches enable row level security;

create policy "public read" on public.match_lineups for select to anon, authenticated using (true);
create policy "public read" on public.match_coaches for select to anon, authenticated using (true);

-- ─────────────────────────────────────────── 수집 스케줄
-- 시각은 UTC. 주석은 KST(UTC+9) 기준이다.

-- 경기 창에서 5분마다. 선발 명단이 뜨고, 경기 중 교체·경고가 붙는 구간이다.
-- has_live_window() 가 false 면 함수를 부르지 않으므로 평소에는 DB 조회 한 번으로 끝난다.
select cron.schedule(
  'collect-lineups-live', '*/5 * * * *',
  $$select public.call_collector('collect-lineups') where public.has_live_window()$$
);

-- 매일 03:00 KST. 경기 창을 놓쳤거나 지난 경기가 비어 있으면 여기서 따라잡는다.
select cron.schedule('collect-lineups-daily', '0 18 * * *', $$select public.call_collector('collect-lineups')$$);

-- ─────────────────────────────────────────── 포항 경기만 둔다
--
-- 일정 원본은 리그 전체를 한꺼번에 주고, 수집기는 그것을 전부 저장해 왔다. 앱은 포항
-- 경기만 읽는다(matchRepository.findByTeam). 쓰지 않는 연맹 자료를 쌓아 두면 필요 이상으로
-- 복제하는 셈이라, 수집기가 포항 경기만 저장하도록 바꾸고 이미 쌓인 나머지를 지운다.
--
-- 라이브 창(has_live_window)은 이 표만 본다. 다른 팀 경기가 사라지면 1분마다 도는 라이브
-- 수집도 저절로 포항 경기 때만 열린다 — 2026 시즌 기준 15,380분에서 5,280분으로 준다.
--
-- 라이브 호출은 이번 달만 받게 한다(?live=1). 전에는 1분마다 두 달 치를 받았다.
--
-- 순서: 포항만 저장하는 collect-matches 를 먼저 배포하고 돌린다. 옛 수집기가 돌면 지운
-- 경기가 다시 들어온다. 다시 돌려도 깨지지 않게 쓴다.

delete from public.matches
  where home_team_id <> 'K03' and away_team_id <> 'K03';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'collect-matches-live') then
    perform cron.unschedule('collect-matches-live');
  end if;
end $$;

select cron.schedule(
  'collect-matches-live', '* * * * *',
  $$select public.call_collector('collect-matches', '?live=1') where public.has_live_window()$$
);

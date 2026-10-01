-- 수집 스케줄.
--
-- pg_cron 의 시각은 UTC 다. 아래 주석의 시각은 KST 기준(UTC+9)이니 헷갈리지 말 것.
-- 사전 준비: 프로젝트 설정에 아래 두 값을 넣어둔다.
--   alter database postgres set app.functions_url = 'https://<ref>.supabase.co/functions/v1';
--   alter database postgres set app.cron_secret   = '<CRON_SECRET 과 동일한 값>';
--
-- 로컬(supabase start)에서는 위 설정이 없으므로 아래 기본값으로 떨어진다.
-- current_setting(..., true) 의 두 번째 인자가 "없으면 NULL 을 반환" 이다.
-- 이게 없으면 설정이 비었을 때 크론 잡이 매번 예외로 죽는다.

create or replace function public.call_collector(fn text, query text default '')
returns bigint
language sql
security definer
set search_path = public
as $$
  select net.http_post(
    url     := coalesce(current_setting('app.functions_url', true), 'http://host.docker.internal:54321/functions/v1')
               || '/' || fn || query,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;

/**
 * 경기 중(킥오프 10분 전 ~ 종료 추정 시각)인지. 라이브 폴링을 이 창에서만 돌려
 * 하루 1,440번짜리 크론이 함수를 실제로 깨우는 건 경기 때뿐이게 한다.
 * 축구 한 경기는 하프타임 포함 대략 2시간이면 끝나므로 여유를 둬 150분을 본다.
 */
create or replace function public.has_live_window()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.matches
    where status <> 'finished'
      and now() between kickoff_at - interval '10 minutes'
                    and kickoff_at + interval '150 minutes'
  );
$$;

-- 일정/구단 — 매일 06:00 KST. 새 일정 공개와 구단 메타 갱신용.
select cron.schedule('collect-matches-daily', '0 21 * * *', $$select public.call_collector('collect-matches')$$);

-- 시즌 전체 재적재 — 매주 월요일 05:00 KST. 지난 경기 정정(관중수/구장 변경 등)을 흡수한다.
select cron.schedule('collect-matches-full', '0 20 * * 0', $$select public.call_collector('collect-matches', '?full=1')$$);

-- 라이브 스코어 — 매분 확인하되 경기 창에서만 실제 호출한다.
select cron.schedule(
  'collect-matches-live', '* * * * *',
  $$select public.call_collector('collect-matches') where public.has_live_window()$$
);

-- 순위 + 스쿼드 — 매일 00:30 KST(경기 종료 후) 와 12:00 KST.
select cron.schedule('collect-standings', '30 15,3 * * *', $$select public.call_collector('collect-standings')$$);

-- 뉴스 — 30분마다. 목록 폴링 + 본문 미수집분 따라잡기.
select cron.schedule('collect-news', '*/30 * * * *', $$select public.call_collector('collect-news')$$);

-- 영상 — 1시간마다. 하이라이트는 경기 후 몇 시간 뒤에 올라온다.
select cron.schedule('collect-videos', '0 * * * *', $$select public.call_collector('collect-videos')$$);

-- 실행 로그 정리 — 매일 04:00 KST, 30일치만 남긴다.
select cron.schedule(
  'prune-collect-runs', '0 19 * * *',
  $$delete from public.collect_runs where ran_at < now() - interval '30 days'$$
);

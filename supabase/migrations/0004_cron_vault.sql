-- 크론이 Edge Function 을 부를 때 쓰는 주소와 시크릿을 Vault 에서 읽는다.
--
-- 0002_cron.sql 은 이 값들을 `alter database postgres set app.*` 로 넣는 걸 전제했는데,
-- 그 방법은 쓸 수 없다. Supabase 의 postgres 롤은 superuser 가 아니라서 커스텀 파라미터를
-- 설정할 수 없고, 대시보드 SQL Editor 에서도 막힌다:
--
--   ERROR: 42501: permission denied to set parameter "app.functions_url"
--
-- 그래서 Vault 로 옮긴다. 값은 마이그레이션에 넣지 않는다 — 시크릿이 git 에 들어가면 안 되므로
-- 프로젝트마다 한 번 SQL Editor 에서 심는다:
--
--   delete from vault.secrets where name in ('functions_url', 'cron_secret');
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_url');
--   select vault.create_secret('<CRON_SECRET 과 같은 값>',                'cron_secret');
--
-- 크론 잡 자체(cron.schedule)는 0002 가 잡아 둔 것을 그대로 쓴다. 여기서는 잡이 부르는
-- call_collector 의 속만 바꾸므로 스케줄을 다시 등록할 필요가 없다.

create extension if not exists supabase_vault with schema vault;

create or replace function public.call_collector(fn text, query text default '')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  base   text;
  secret text;
begin
  -- Vault 에 없으면 로컬(supabase start) 기본값으로 떨어진다.
  -- 여기서 예외를 던지면 크론 잡이 매번 죽으므로 조용히 기본값을 쓴다.
  select decrypted_secret into base   from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';

  return net.http_post(
    url     := coalesce(base, 'http://host.docker.internal:54321/functions/v1') || '/' || fn || query,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', coalesce(secret, '')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

/**
 * 배선이 맞는지 한눈에 보는 용도. 시크릿 값은 돌려주지 않고 "심겼는지"만 알려준다.
 *   select * from public.cron_config_check();
 */
create or replace function public.cron_config_check()
returns table (functions_url text, cron_secret_len int, jobs int)
language sql
security definer
set search_path = public
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url'),
    (select length(decrypted_secret) from vault.decrypted_secrets where name = 'cron_secret'),
    (select count(*)::int from cron.job);
$$;

-- 점검 함수는 운영자만 쓴다. 앱(anon)에는 열지 않는다.
revoke all on function public.cron_config_check() from anon, authenticated;

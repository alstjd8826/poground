-- ─────────────────────────────────────────── 신고 알림
--
-- 신고가 들어오면 운영자에게 메일이 가야 한다. 표에 쌓아 두기만 하면 대시보드를 열어
-- 볼 때까지 아무도 모른다 — 심사 지침 1.2 는 신고 수단만이 아니라 "제때 응답" 까지
-- 요구한다.
--
-- 앱이 아니라 여기서 부른다. 앱이 부르면 신고만 넣고 알림은 빼먹는 요청을 만들 수 있고,
-- 그런 호출을 가려낼 방법도 마땅치 않다. 행이 생기는 것과 알림이 나가는 것을 한자리에
-- 묶어 둬야 어긋나지 않는다.
--
-- 주소와 시크릿은 0004 가 심어 둔 Vault 값을 그대로 쓴다.

create or replace function public.notify_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base   text;
  secret text;
begin
  select decrypted_secret into base   from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';

  /*
    메일이 안 나가도 신고 자체는 남아야 한다.
    net.http_post 는 비동기로 큐에 넣고 곧바로 돌아오므로 신고를 넣는 사람이 기다리지
    않는다. 그래도 Vault 가 비어 있는 등으로 여기서 예외가 나면 신고가 통째로 실패하므로
    한 번 더 감싼다 — 알림은 곁가지고 기록이 본체다.
  */
  begin
    perform net.http_post(
      url     := coalesce(base, 'http://host.docker.internal:54321/functions/v1') || '/notify-report',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'x-cron-secret', coalesce(secret, '')
                 ),
      body    := jsonb_build_object(
                   'comment_id', new.comment_id,
                   'reporter',   new.reporter,
                   'reason',     new.reason
                 ),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning '신고 알림을 보내지 못했습니다: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists comment_reports_notify on public.comment_reports;
create trigger comment_reports_notify
  after insert on public.comment_reports
  for each row execute function public.notify_report();

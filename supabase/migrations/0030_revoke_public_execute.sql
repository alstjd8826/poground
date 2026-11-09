-- ─────────────────────────────────────────── 0030 PUBLIC 실행 권한 걷어내기 (2026-11-09)
--
-- Postgres 는 함수를 만들 때 **PUBLIC** 에 EXECUTE 를 준다. 0004 는 `revoke ... from anon, authenticated` 로
-- 막았다고 여겼지만, anon·authenticated 는 PUBLIC 을 통해 여전히 실행할 수 있었다
-- (`has_function_privilege('anon', …)` 가 true, `supabase db advisors` 의
-- anon_security_definer_function_executable).
--
-- 그중 위험한 것은 call_collector 다. 로그인하지 않은 사람이 /rest/v1/rpc/call_collector 를 부르면 DB 가
-- x-cron-secret 을 붙여 Edge Function 을 대신 불러 준다 — 아무나 수집 함수를 돌릴 수 있었다.
-- cron_config_check 는 functions_url 과 비밀값 길이를 보여 준다.
--
-- 여기서 걷어내는 것은 앱이 직접 부를 일이 없는 함수뿐이다.
--   · 크론 전용: call_collector, cron_config_check — pg_cron 은 postgres 로 돌아 영향이 없다
--   · 트리거 전용: notify_report, notify_post_report, posts_guard, profiles_admin_lock, mark_comment_deleter,
--     touch_updated_at — 트리거는 발동할 때 호출자의 EXECUTE 를 보지 않는다
-- RLS 정책 안에서 쓰는 함수(can_read_post, is_admin, agreed_terms …)는 호출자 권한으로 돌므로 그대로 둔다.
-- 관리자 함수(grant_admin, revoke_admin, find_user)는 안에서 can_manage_admins() 로 막고, 운영자 화면이
-- 로그인한 채 부르므로 anon 에서만 걷는다.

revoke execute on function public.call_collector(text, text) from public, anon, authenticated;
revoke execute on function public.cron_config_check() from public, anon, authenticated;

revoke execute on function public.notify_report() from public, anon, authenticated;
revoke execute on function public.notify_post_report() from public, anon, authenticated;
revoke execute on function public.posts_guard() from public, anon, authenticated;
revoke execute on function public.profiles_admin_lock() from public, anon, authenticated;
revoke execute on function public.mark_comment_deleter() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

revoke execute on function public.grant_admin(uuid, text, text) from public, anon;
revoke execute on function public.revoke_admin(uuid) from public, anon;
revoke execute on function public.find_user(text) from public, anon;
grant execute on function public.grant_admin(uuid, text, text) to authenticated;
grant execute on function public.revoke_admin(uuid) to authenticated;
grant execute on function public.find_user(text) to authenticated;

-- 앞으로 만드는 함수도 PUBLIC 에 주지 않는다. 새 함수는 필요한 역할에 직접 grant 한다
alter default privileges in schema public revoke execute on functions from public;

-- ─────────────────────────────────────────── 0030 PUBLIC 실행 권한 걷어내기 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. 끝에서 rollback 한다.
-- 어긋나면 'FAIL: …', 끝까지 가면 'OK: 0030 검증 통과'.
--
--   1. 크론·트리거 전용 함수를 anon·authenticated 가 실행하지 못한다
--   2. 관리자 함수는 anon 이 못 부르고 authenticated 는 부를 수 있다(안에서 다시 막는다)
--   3. 정책에서 쓰는 함수는 그대로 부를 수 있다
--   4. 트리거는 그대로 돈다 — 로그인한 사람이 프로필을 고치면 updated_at 이 바뀐다

begin;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.call_collector(text, text)', 'public.cron_config_check()',
    'public.notify_report()', 'public.notify_post_report()', 'public.posts_guard()',
    'public.profiles_admin_lock()', 'public.mark_comment_deleter()', 'public.touch_updated_at()'
  ] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'FAIL: anon 이 % 를 실행한다', f; end if;
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'FAIL: authenticated 가 % 를 실행한다', f; end if;
  end loop;

  foreach f in array array['public.grant_admin(uuid, text, text)', 'public.revoke_admin(uuid)', 'public.find_user(text)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'FAIL: anon 이 % 를 실행한다', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'FAIL: authenticated 가 % 를 못 부른다', f; end if;
  end loop;

  foreach f in array array['public.is_admin()', 'public.agreed_terms()'] loop
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'FAIL: 정책 함수 % 를 못 부른다', f; end if;
  end loop;
end $$;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'e1@check.local');
insert into public.profiles (id, nickname, handle, updated_at) values
  ('00000000-0000-4000-8000-0000000000e1', '이원', 'check_e1', now() - interval '1 day');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
update public.profiles set nickname = '이원2' where id = '00000000-0000-4000-8000-0000000000e1';
reset role;

do $$ begin
  if (select updated_at from public.profiles where id = '00000000-0000-4000-8000-0000000000e1') < now() - interval '1 hour' then
    raise exception 'FAIL: 트리거(touch_updated_at)가 돌지 않았다';
  end if;
end $$;

select 'OK: 0030 검증 통과' as result;

rollback;

-- ─────────────────────────────────────────── 0026 운영자 이름 잠금 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. a(일반) c(운영자). 끝에서 rollback 한다.
-- 어긋나면 'FAIL: …', 끝까지 가면 'OK: 0026 검증 통과'.

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@check.local'),
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c@check.local');
insert into public.admins (user_id, note) values ('00000000-0000-4000-8000-00000000000c', '0026 검증');
insert into public.profiles (id, nickname, handle) values
  ('00000000-0000-4000-8000-00000000000a', '일반', 'check_fan_a'),
  ('00000000-0000-4000-8000-00000000000c', '운영자', 'check_admin_c');

-- ── 1. 운영자는 앱에서 제 아이디·닉네임을 바꾸지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$ begin
  begin
    update public.profiles set handle = 'check_admin_x' where id = '00000000-0000-4000-8000-00000000000c';
    raise exception 'FAIL: 운영자가 아이디를 바꾼다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    update public.profiles set nickname = '바뀐 이름' where id = '00000000-0000-4000-8000-00000000000c';
    raise exception 'FAIL: 운영자가 닉네임을 바꾼다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
-- 사진은 바꿀 수 있다
update public.profiles set avatar_url = 'x' where id = '00000000-0000-4000-8000-00000000000c';
reset role;

do $$ begin
  if (select avatar_url from public.profiles where id = '00000000-0000-4000-8000-00000000000c') is distinct from 'x' then
    raise exception 'FAIL: 운영자가 프로필 사진도 못 바꾼다';
  end if;
end $$;

-- ── 2. 일반 사용자는 그대로 바꾼다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
update public.profiles set handle = 'check_fan_b', nickname = '새 이름' where id = '00000000-0000-4000-8000-00000000000a';
reset role;

do $$ begin
  if (select handle from public.profiles where id = '00000000-0000-4000-8000-00000000000a') <> 'check_fan_b' then
    raise exception 'FAIL: 일반 사용자가 아이디를 못 바꾼다';
  end if;
end $$;

-- ── 3. SQL Editor(로그인 없는 운영 작업)에서는 운영자 이름을 바꿀 수 있다
update public.profiles set handle = 'check_admin_y' where id = '00000000-0000-4000-8000-00000000000c';
do $$ begin
  if (select handle from public.profiles where id = '00000000-0000-4000-8000-00000000000c') <> 'check_admin_y' then
    raise exception 'FAIL: SQL Editor 에서도 운영자 이름을 못 바꾼다';
  end if;
end $$;

select 'OK: 0026 검증 통과' as result;

rollback;

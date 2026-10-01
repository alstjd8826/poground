-- ─────────────────────────────────────────── 0027 옛 직관 사진 걷어내기 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. 끝에서 rollback 한다.
-- 어긋나면 'FAIL: …', 끝까지 가면 'OK: 0027 검증 통과'.

begin;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendances' and column_name = 'photo_path'
  ) then
    raise exception 'FAIL: attendances.photo_path 가 남아 있다';
  end if;
  if exists (select 1 from pg_policies where tablename = 'objects' and policyname like 'my-attendance-photos%') then
    raise exception 'FAIL: 옛 직관 사진 스토리지 정책이 남아 있다';
  end if;
end $$;

-- 직관 기록 자체는 그대로 쓴다
insert into auth.users (id, aud, role, email)
  values ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@check.local');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.attendances (owner, year, league_id, game_id)
  values ('00000000-0000-4000-8000-00000000000a', 2026, 1, 180);
do $$ begin
  if not exists (select 1 from public.attendances where game_id = 180) then
    raise exception 'FAIL: 직관 기록을 못 남긴다';
  end if;
end $$;
reset role;

select 'OK: 0027 검증 통과' as result;

rollback;

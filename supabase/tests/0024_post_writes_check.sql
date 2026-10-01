-- ─────────────────────────────────────────── 0024 글 쓰기 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. 가짜 사용자 a(작성자), b(다른 사람)로 확인하고 끝에서
-- rollback 한다 — 아무것도 남지 않는다. 어긋나면 'FAIL: …' 로 멈추고, 끝까지 가면
-- 'OK: 0024 검증 통과' 가 뜬다.
--
--   a        00000000-0000-4000-8000-00000000000a
--   b        00000000-0000-4000-8000-00000000000b
--   a 의 글   00000000-0000-4000-8000-0000000000a1
--   b 의 글   00000000-0000-4000-8000-0000000000b1
--   사진 이름 00000000-0000-4000-8000-0000000000f1, …f2, …f3

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@check.local'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'b@check.local');

-- ── 1. 새 글과 사진 행을 한 번에 만든다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select public.save_post(
  '00000000-0000-4000-8000-0000000000a1', '첫 글', 'public', null, null, null,
  array[
    '00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-0000000000f1',
    '00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-0000000000f2'
  ]
);
reset role;

do $$ begin
  if (select count(*) from public.post_photos where post_id = '00000000-0000-4000-8000-0000000000a1') <> 2 then
    raise exception 'FAIL: 새 글의 사진 행이 안 생긴다';
  end if;
  if (select path from public.post_photos where post_id = '00000000-0000-4000-8000-0000000000a1' and position = 1)
     not like '%0000000000f2' then
    raise exception 'FAIL: 사진 순서가 보낸 순서와 다르다';
  end if;
  if (select author from public.posts where id = '00000000-0000-4000-8000-0000000000a1')
     is distinct from '00000000-0000-4000-8000-00000000000a' then
    raise exception 'FAIL: 작성자가 부른 사람으로 안 적힌다';
  end if;
end $$;

-- ── 2. 고치기: 본문·공개 설정·순서가 바뀌고, 빠진 사진 행이 사라진다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select public.save_post(
  '00000000-0000-4000-8000-0000000000a1', '고친 글', 'private', 2026, 1, 180,
  array[
    '00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-0000000000f2'
  ]
);
reset role;

do $$ declare p record; begin
  select * into p from public.posts where id = '00000000-0000-4000-8000-0000000000a1';
  if p.body <> '고친 글' or p.visibility <> 'private' or p.match_game_id is distinct from 180 then
    raise exception 'FAIL: 고치기가 반영되지 않는다';
  end if;
  if (select count(*) from public.post_photos where post_id = p.id) <> 1 then
    raise exception 'FAIL: 뺀 사진 행이 남는다';
  end if;
  if (select path from public.post_photos where post_id = p.id and position = 0) not like '%0000000000f2' then
    raise exception 'FAIL: 남은 사진이 첫 자리로 오지 않는다';
  end if;
end $$;

-- ── 3. 사진은 4장까지
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ declare base text := '00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000a1/'; begin
  begin
    perform public.save_post('00000000-0000-4000-8000-0000000000a1', '다섯 장', 'public', null, null, null,
      array[base || gen_random_uuid(), base || gen_random_uuid(), base || gen_random_uuid(),
            base || gen_random_uuid(), base || gen_random_uuid()]);
    raise exception 'FAIL: 사진 다섯 장이 들어간다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 4. 사진 행은 제 글 폴더의 uuid 이름만 가리킨다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.save_post('00000000-0000-4000-8000-0000000000a1', '남의 파일', 'public', null, null, null,
      array['00000000-0000-4000-8000-00000000000b/00000000-0000-4000-8000-0000000000b1/00000000-0000-4000-8000-0000000000f3']);
    raise exception 'FAIL: 남의 폴더 파일을 내 글 사진으로 단다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.save_post('00000000-0000-4000-8000-0000000000a1', '다른 글 폴더', 'public', null, null, null,
      array['00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000b1/00000000-0000-4000-8000-0000000000f3']);
    raise exception 'FAIL: 다른 글 폴더의 파일을 단다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.save_post('00000000-0000-4000-8000-0000000000a1', '이상한 이름', 'public', null, null, null,
      array['00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000a1/../x']);
    raise exception 'FAIL: uuid 가 아닌 파일 이름이 들어간다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 5. 남의 글 id 로 부르면 덮지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select public.save_post('00000000-0000-4000-8000-0000000000b1', 'b 의 글', 'public', null, null, null, array[]::text[]);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.save_post('00000000-0000-4000-8000-0000000000b1', '가로챔', 'public', null, null, null, array[]::text[]);
    raise exception 'FAIL: 남의 글을 덮는다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  if (select body from public.posts where id = '00000000-0000-4000-8000-0000000000b1') <> 'b 의 글' then
    raise exception 'FAIL: 남의 글 본문이 바뀌었다';
  end if;
end $$;

-- ── 6. 지운 글은 저장으로 되살리지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
update public.posts set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000a1';
do $$ begin
  begin
    perform public.save_post('00000000-0000-4000-8000-0000000000a1', '되살림', 'public', null, null, null, array[]::text[]);
    raise exception 'FAIL: 지운 글이 저장으로 되살아난다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  if (select deleted_at from public.posts where id = '00000000-0000-4000-8000-0000000000a1') is null then
    raise exception 'FAIL: 지운 글이 되살아났다';
  end if;
end $$;

-- ── 7. 로그인 안 한 사람은 부르지 못한다
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    perform public.save_post(gen_random_uuid(), '익명', 'public', null, null, null, array[]::text[]);
    raise exception 'FAIL: 로그인 없이 글을 쓴다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 8. 글을 만들기 전에 올린 내 사진은 내가 볼 수 있다 (그래야 실패했을 때 지울 수 있다)
-- 스토리지의 remove 는 delete 정책과 함께 select 정책도 요구한다. 글이 아직 없으면 글을 따르는
-- 읽기 정책이 거짓이라, 올리기가 중간에 실패한 사진을 지우지 못하고 버킷에 남는다
insert into storage.objects (bucket_id, name) values (
  'post-photos',
  '00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000c9/00000000-0000-4000-8000-0000000000f9'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from storage.objects where name like '%0000000000c9/%') then
    raise exception 'FAIL: 글 없이 올린 내 사진을 내가 못 본다 (실패한 올리기를 못 치운다)';
  end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from storage.objects where name like '%0000000000c9/%') then
    raise exception 'FAIL: 남이 올린, 글 없는 사진이 보인다';
  end if;
end $$;
reset role;

select 'OK: 0024 검증 통과' as result;

rollback;

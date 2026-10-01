-- ─────────────────────────────────────────── 0029 계정 삭제·약관 동의 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. a(탈퇴할 사람) b(남) c(관리자). 끝에서 rollback 한다.
-- 어긋나면 'FAIL: …', 끝까지 가면 'OK: 0029 검증 통과'.
--
-- 0029 뒤에는 약관에 동의하지 않은 사람이 글·댓글을 못 쓴다. 그래서 0023~0028 검증은 0029 앞에서만 돈다.
--
--   a 의 댓글 …d1(b 가 답글 …d2)  a 의 관리자가 지운 댓글 …d3  a 의 글 …a1

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@check.local'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'b@check.local'),
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c@check.local');
insert into public.profiles (id, nickname, handle) values
  ('00000000-0000-4000-8000-00000000000a', '에이', 'check_a'),
  ('00000000-0000-4000-8000-00000000000b', '비', 'check_b'),
  ('00000000-0000-4000-8000-00000000000c', '씨', 'check_c');
insert into public.admins (user_id, note) values ('00000000-0000-4000-8000-00000000000c', '0029 검증');

-- ── 1. 약관에 동의하지 않으면 글·댓글을 쓰지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.comments (author, subject_type, subject_id, body)
      values ('00000000-0000-4000-8000-00000000000a', 'match', '1', '동의 전');
    raise exception 'FAIL: 약관 동의 전에 댓글을 쓴다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    insert into public.posts (author, body) values ('00000000-0000-4000-8000-00000000000a', '동의 전');
    raise exception 'FAIL: 약관 동의 전에 글을 쓴다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- ── 2. 동의하면 쓸 수 있다. 시각은 서버가 적는다
select public.agree_terms(1);
do $$ begin
  if not exists (
    select 1 from public.profiles
    where id = '00000000-0000-4000-8000-00000000000a' and terms_version = 1 and terms_agreed_at is not null
  ) then
    raise exception 'FAIL: 약관 동의가 남지 않았다';
  end if;
end $$;
insert into public.comments (id, author, subject_type, subject_id, body) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000000a', 'match', '1', 'a 의 댓글'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-00000000000a', 'match', '1', '걸린 댓글');
insert into public.posts (id, author, body)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'a 의 글');

-- ── 3. 탈퇴 처리 함수는 앱에서 부르지 못한다 (서버 함수만)
do $$ begin
  begin
    perform public.withdraw_comments('00000000-0000-4000-8000-00000000000b');
    raise exception 'FAIL: 앱이 남의 댓글을 탈퇴 처리한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- b 가 a 의 댓글에 답글을 단다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select public.agree_terms(1);
insert into public.comments (id, author, parent_id, subject_type, subject_id, body) values (
  '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-00000000000b',
  '00000000-0000-4000-8000-0000000000d1', 'match', '1', 'b 의 답글'
);
reset role;
-- 관리자가 d3 을 지운다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
update public.comments set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000d3';
reset role;

-- ── 4. 탈퇴: 댓글은 내용만 지우고 자리를 남긴다. 관리자가 지운 표시는 그대로 둔다
select public.withdraw_comments('00000000-0000-4000-8000-00000000000a');
do $$ begin
  if not exists (
    select 1 from public.comments
    where id = '00000000-0000-4000-8000-0000000000d1'
      and deleted_at is not null and not deleted_by_admin and body <> 'a 의 댓글'
  ) then
    raise exception 'FAIL: 탈퇴한 사람의 댓글이 스스로 지운 자리로 남지 않았다';
  end if;
  if not exists (
    select 1 from public.comments where id = '00000000-0000-4000-8000-0000000000d3' and deleted_by_admin
  ) then
    raise exception 'FAIL: 관리자가 지운 표시가 탈퇴로 덮였다';
  end if;
end $$;

-- ── 5. 계정을 지워도 댓글 자리와 남의 답글은 남고, 글은 사라진다
delete from auth.users where id = '00000000-0000-4000-8000-00000000000a';
do $$ begin
  if not exists (select 1 from public.comments where id = '00000000-0000-4000-8000-0000000000d1' and author is null) then
    raise exception 'FAIL: 탈퇴한 사람의 댓글 자리가 사라졌다';
  end if;
  if not exists (select 1 from public.comments where id = '00000000-0000-4000-8000-0000000000d2') then
    raise exception 'FAIL: 탈퇴한 사람 댓글에 달린 남의 답글이 사라졌다';
  end if;
  if exists (select 1 from public.posts where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: 탈퇴한 사람의 글이 남았다';
  end if;
end $$;

-- ── 6. 운영자 계정은 탈퇴 처리하지 않는다
do $$ begin
  begin
    perform public.withdraw_comments('00000000-0000-4000-8000-00000000000c');
    raise exception 'FAIL: 운영자 계정을 탈퇴 처리한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

select 'OK: 0029 검증 통과' as result;

rollback;

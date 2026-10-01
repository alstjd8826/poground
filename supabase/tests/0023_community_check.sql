-- ─────────────────────────────────────────── 0023 권한 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. 가짜 사용자 셋(작성자 a, 다른 사람 b, 관리자 c)을
-- 만들어 권한을 하나씩 확인하고, 끝에서 rollback 한다 — 아무것도 남지 않는다.
--
-- 어긋나면 'FAIL: …' 로 멈춘다. 끝까지 가면 마지막 줄에 'OK: 0023 검증 통과' 가 뜬다.
-- 로컬에서는 deno task sql-check 로 PGlite 에 돌린다.
--
-- 임시 표·임시 함수를 쓰지 않는다. Supabase 의 postgres 역할에서 역할을 바꾸면 임시 표를
-- 못 찾았다. 글·댓글 id 는 고정값으로 넣는다.
--
--   a        00000000-0000-4000-8000-00000000000a   작성자
--   b        00000000-0000-4000-8000-00000000000b   다른 사람
--   c        00000000-0000-4000-8000-00000000000c   관리자
--   공개 글   00000000-0000-4000-8000-0000000000a1
--   나만 보기 00000000-0000-4000-8000-0000000000a2
--   비밀 댓글 00000000-0000-4000-8000-0000000000c1

begin;

-- ── 준비 (postgres 권한으로)
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@check.local'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'b@check.local'),
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c@check.local');
insert into public.admins (user_id, note) values ('00000000-0000-4000-8000-00000000000c', '0023 검증');

-- ── 1. 작성 시각은 서버가 정한다 (피드 맨 위 고정 막기)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.posts (id, author, body, created_at, deleted_by) values (
  '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', '공개 글',
  '2099-01-01', '00000000-0000-4000-8000-00000000000c'
);
insert into public.posts (id, author, body, visibility) values (
  '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', '나만 보기 글', 'private'
);
reset role;

do $$ declare p record; begin
  select * into p from public.posts where id = '00000000-0000-4000-8000-0000000000a1';
  if p.created_at > now() + interval '1 minute' then raise exception 'FAIL: 작성 시각을 앞날로 박을 수 있다'; end if;
  if p.deleted_by is not null then raise exception 'FAIL: 새 글에 지운 사람을 적을 수 있다'; end if;
end $$;

-- ── 2. 나만 보기 글은 남과 로그인 안 한 사람에게 안 보인다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.posts where id = '00000000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL: 남이 나만 보기 글을 본다';
  end if;
  if not exists (select 1 from public.posts where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: 공개 글이 안 보인다';
  end if;
end $$;
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  if exists (select 1 from public.posts where id = '00000000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL: 로그인 안 한 사람이 나만 보기 글을 본다';
  end if;
end $$;
reset role;

-- ── 3. 작성자는 작성 시각·지운 사람을 고칠 수 없다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
update public.posts set created_at = '2099-01-01', deleted_by = '00000000-0000-4000-8000-00000000000c'
  where id = '00000000-0000-4000-8000-0000000000a1';
reset role;

do $$ declare p record; begin
  select * into p from public.posts where id = '00000000-0000-4000-8000-0000000000a1';
  if p.created_at > now() + interval '1 minute' then raise exception 'FAIL: 작성 시각을 고쳐 맨 위로 올릴 수 있다'; end if;
  if p.deleted_by is not null then raise exception 'FAIL: 지운 사람을 꾸밀 수 있다'; end if;
end $$;

-- ── 4. 관리자는 지우기만 할 수 있고, 본문은 못 고친다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$ begin
  begin
    update public.posts set body = '관리자가 고침' where id = '00000000-0000-4000-8000-0000000000a1';
  exception when others then null;
  end;
end $$;
select public.admin_delete_post('00000000-0000-4000-8000-0000000000a1');
reset role;

do $$ declare p record; begin
  select * into p from public.posts where id = '00000000-0000-4000-8000-0000000000a1';
  if p.body = '관리자가 고침' then raise exception 'FAIL: 관리자가 남의 본문을 고친다'; end if;
  if p.deleted_at is null then raise exception 'FAIL: 관리자가 지우지 못한다'; end if;
  if p.deleted_by is distinct from '00000000-0000-4000-8000-00000000000c' then
    raise exception 'FAIL: 지운 사람이 관리자로 안 적힌다';
  end if;
end $$;

-- 관리자가 아니면 그 함수를 못 쓴다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.admin_delete_post('00000000-0000-4000-8000-0000000000a2');
    raise exception 'FAIL: 관리자가 아닌데 남의 글을 지운다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 5. 작성자는 관리자가 지운 글을 되살리지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin
    update public.posts set deleted_at = null where id = '00000000-0000-4000-8000-0000000000a1';
  exception when others then null;
  end;
end $$;
reset role;

do $$ begin
  if (select deleted_at from public.posts where id = '00000000-0000-4000-8000-0000000000a1') is null then
    raise exception 'FAIL: 관리자가 지운 글을 되살린다';
  end if;
end $$;

-- ── 6. 사진 행은 자기 경로만 가리킨다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.post_photos (post_id, position, path)
      values ('00000000-0000-4000-8000-0000000000a2', 0, '00000000-0000-4000-8000-00000000000b/x/0');
    raise exception 'FAIL: 사진 행이 남의 파일을 가리킨다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 7. 사진 읽기는 글쓴이 폴더에 있을 때만 (남의 글 이름으로 파일 걸기 막기)
do $$ begin
  if public.can_read_post_photo('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL: 남의 폴더 파일이 이 글의 사진으로 읽힌다';
  end if;
  if public.can_read_post_photo('x', repeat('-', 36)) then raise exception 'FAIL: 모양이 틀린 id 가 통과한다'; end if;
end $$;

-- ── 8. 게시글 댓글의 대상은 uuid 여야 한다 (한 줄이 댓글 조회 전체를 깨지 않게)
do $$ begin
  begin
    insert into public.comments (author, subject_type, subject_id, body)
      values ('00000000-0000-4000-8000-00000000000a', 'post', 'not-a-uuid', 'x');
    raise exception 'FAIL: 게시글 댓글에 uuid 아닌 대상이 들어간다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- ── 9. 나만 보기 글의 댓글과 좋아요는 남이 못 보고 못 누른다
insert into public.comments (id, author, subject_type, subject_id, body) values (
  '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000a', 'post',
  '00000000-0000-4000-8000-0000000000a2', '내 비밀 댓글'
);
insert into public.post_likes (post_id, user_id)
  values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.comments where id = '00000000-0000-4000-8000-0000000000c1') then
    raise exception 'FAIL: 나만 보기 글의 댓글이 새어 나간다';
  end if;
  if exists (select 1 from public.post_likes where post_id = '00000000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL: 나만 보기 글의 좋아요 목록이 보인다';
  end if;
  begin
    insert into public.comment_likes (comment_id, user_id)
      values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000000b');
    raise exception 'FAIL: 볼 수 없는 댓글 id 를 알면 좋아요를 누른다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

select 'OK: 0023 검증 통과' as result;

rollback;

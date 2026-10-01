-- ─────────────────────────────────────────── 0028 정리 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. a(글쓴이) b(다른 사람) c(관리자). 끝에서 rollback 한다.
-- 어긋나면 'FAIL: …', 끝까지 가면 'OK: 0028 검증 통과'.
--
--   a 의 공개 글(나중에 나만 보기) …a1   a 의 나만 보기(신고 없음) …a2   b 의 댓글 …d1

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@check.local'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'b@check.local'),
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c@check.local');
insert into public.admins (user_id, note) values ('00000000-0000-4000-8000-00000000000c', '0028 검증');
insert into public.posts (id, author, body, visibility) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', '신고될 글', 'public'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', '그냥 나만 보기', 'private');
insert into public.comments (id, author, subject_type, subject_id, body) values (
  '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000000b', 'post',
  '00000000-0000-4000-8000-0000000000a1', '댓글'
);

-- ── 1. 자기 글은 신고하지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.post_reports (post_id, reporter, reason)
      values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'x');
    raise exception 'FAIL: 자기 글을 신고한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 2. 지운 댓글에는 좋아요를 누르지 못한다
update public.comments set deleted_at = now() where id = '00000000-0000-4000-8000-0000000000d1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.comment_likes (comment_id, user_id)
      values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000000a');
    raise exception 'FAIL: 지운 댓글에 좋아요를 누른다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;
update public.comments set deleted_at = null where id = '00000000-0000-4000-8000-0000000000d1';

-- ── 3. 신고된 글이 나만 보기로 바뀌어도 관리자는 글·댓글·사진을 읽는다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.post_reports (post_id, reporter, reason)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000b', '욕설');
reset role;
-- 글쓴이가 나만 보기로 바꾼다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
update public.posts set visibility = 'private' where id = '00000000-0000-4000-8000-0000000000a1';
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from public.posts where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: 관리자가 신고된 나만 보기 글을 못 연다';
  end if;
  if not exists (select 1 from public.comments where id = '00000000-0000-4000-8000-0000000000d1') then
    raise exception 'FAIL: 관리자가 신고된 나만 보기 글의 댓글을 못 본다';
  end if;
  if not public.can_read_post_photo('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: 관리자가 신고된 나만 보기 글의 사진을 못 연다';
  end if;
  -- 신고 없는 나만 보기 글은 관리자도 못 본다 — "나만 보기는 본인만" 을 넓히지 않는다
  if exists (select 1 from public.posts where id = '00000000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL: 관리자가 신고 없는 나만 보기 글을 본다';
  end if;
end $$;
reset role;

-- ── 4. 남은 여전히 못 본다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.posts where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: 신고한 사람이 나만 보기로 바뀐 글을 본다';
  end if;
end $$;
reset role;

-- ── 5. 관리자 갈래는 읽기뿐이다. 신고된 나만 보기 글에 관리자가 댓글·좋아요·신고를 넣지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.comments (author, subject_type, subject_id, body) values (
      '00000000-0000-4000-8000-00000000000c', 'post', '00000000-0000-4000-8000-0000000000a1', '관리자 댓글');
    raise exception 'FAIL: 관리자가 남의 나만 보기 글에 댓글을 단다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    insert into public.post_likes (post_id, user_id)
      values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000c');
    raise exception 'FAIL: 관리자가 남의 나만 보기 글에 좋아요를 누른다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    insert into public.post_reports (post_id, reporter, reason)
      values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000c', 'x');
    raise exception 'FAIL: 관리자가 남의 나만 보기 글을 신고한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 6. 볼 수 없는 댓글과 자기 댓글은 신고하지 못한다. 댓글 신고도 글을 운영자에게 여는 열쇠라서다
insert into public.comments (id, author, subject_type, subject_id, body) values (
  '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-00000000000a', 'post',
  '00000000-0000-4000-8000-0000000000a2', '내 글에 내 댓글'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.comment_reports (comment_id, reporter, reason)
      values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-00000000000a', 'x');
    raise exception 'FAIL: 자기 댓글을 신고한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.comment_reports (comment_id, reporter, reason)
      values ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-00000000000b', 'x');
    raise exception 'FAIL: 볼 수 없는 나만 보기 글의 댓글을 신고한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 7. 신고를 다 처리하면 다시 본인만 본다
update public.post_reports set resolved_at = now() where post_id = '00000000-0000-4000-8000-0000000000a1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.posts where id = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: 처리 끝난 신고 글을 관리자가 계속 본다';
  end if;
end $$;
reset role;

select 'OK: 0028 검증 통과' as result;

rollback;

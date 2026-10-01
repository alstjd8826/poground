-- ─────────────────────────────────────────── 0025 신고·좋아요 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. a(글쓴이) b(다른 사람) c(관리자). 끝에서 rollback 한다.
-- 어긋나면 'FAIL: …', 끝까지 가면 'OK: 0025 검증 통과'.
-- SQL Editor 에서는 "7." 블록을 지우고 돌린다 — 끝에서 rollback 되지만, Vault·pg_net 흉내를 진짜 DB 에서 건드릴 이유가 없다
--
--   a 00000000-0000-4000-8000-00000000000a   b …0b   c …0c
--   a 의 공개 글  00000000-0000-4000-8000-0000000000a1
--   a 의 나만 보기 00000000-0000-4000-8000-0000000000a2
--   a1 에 b 가 쓴 댓글 00000000-0000-4000-8000-0000000000d1

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@check.local'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'b@check.local'),
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c@check.local');
insert into public.admins (user_id, note) values ('00000000-0000-4000-8000-00000000000c', '0025 검증');
insert into public.posts (id, author, body, visibility) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', '공개 글', 'public'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', '나만 보기', 'private');
insert into public.comments (id, author, subject_type, subject_id, body) values (
  '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000000b', 'post',
  '00000000-0000-4000-8000-0000000000a1', '댓글'
);

-- ── 1. 다른 사람은 공개 글을 신고한다. 메일 호출이 나간다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.post_reports (post_id, reporter, reason)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000b', '욕설');
reset role;

-- 메일 호출은 로컬 흉내(net.calls)에서만 센다. 진짜 DB 에서는 폰 확인 때 메일이 오는지로 본다
do $$ begin
  if to_regclass('net.calls') is null then return; end if;
  if not exists (select 1 from net.calls where body ->> 'post_id' = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: 게시글 신고 메일을 부르지 않는다';
  end if;
end $$;

-- ── 2. 볼 수 없는 글은 id 를 알아도 신고하지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.post_reports (post_id, reporter, reason)
      values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000b', 'x');
    raise exception 'FAIL: 볼 수 없는 글을 신고한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    insert into public.post_reports (post_id, reporter, reason)
      values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'x');
    raise exception 'FAIL: 남의 이름으로 신고한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;
reset role;

-- ── 3. 댓글 신고 하나를 더 넣고, 글을 나만 보기로 바꾼다 (1단계 I4)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.comment_reports (comment_id, reporter, reason)
  values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000000a', '시비');
update public.posts set visibility = 'private' where id = '00000000-0000-4000-8000-0000000000a1';
reset role;

-- ── 4. 관리자는 신고함에서 둘 다 본다 — 나만 보기로 바뀐 글의 것도
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from public.report_inbox_page(true, 0, 30);
  if n <> 2 then raise exception 'FAIL: 관리자 신고함에 % 건 (2 건이어야 한다)', n; end if;
  if not exists (
    select 1 from public.report_inbox_page(true, 0, 30)
    where kind = 'post' and target_id = '00000000-0000-4000-8000-0000000000a1' and body = '공개 글'
  ) then raise exception 'FAIL: 나만 보기로 바뀐 글의 신고가 신고함에서 사라진다'; end if;
  if not exists (
    select 1 from public.report_inbox_page(true, 0, 30)
    where kind = 'comment' and subject_type = 'post' and body = '댓글'
  ) then raise exception 'FAIL: 나만 보기로 바뀐 글의 댓글 신고가 신고함에서 사라진다'; end if;
end $$;
select public.resolve_post_report('00000000-0000-4000-8000-0000000000a1');
do $$ begin
  if exists (select 1 from public.report_inbox_page(true, 0, 30) where kind = 'post') then
    raise exception 'FAIL: 처리한 게시글 신고가 미처리에 남는다';
  end if;
  if not exists (select 1 from public.report_inbox_page(false, 0, 30) where kind = 'post' and resolved) then
    raise exception 'FAIL: 처리한 게시글 신고가 전체 보기에서 처리됨으로 안 보인다';
  end if;
end $$;
reset role;

-- ── 4-1. 관리자는 나만 보기로 바뀐 글의 댓글도 지운다 — 읽기 정책에 걸려 0 행이 되면 안 된다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select public.admin_delete_comment('00000000-0000-4000-8000-0000000000d1');
reset role;
do $$ begin
  if (select deleted_at from public.comments where id = '00000000-0000-4000-8000-0000000000d1') is null then
    raise exception 'FAIL: 관리자가 나만 보기 글의 댓글을 지우지 못한다';
  end if;
  if not (select deleted_by_admin from public.comments where id = '00000000-0000-4000-8000-0000000000d1') then
    raise exception 'FAIL: 관리자가 지운 댓글로 적히지 않는다';
  end if;
end $$;

-- ── 5. 관리자가 아니면 신고함과 처리 함수를 부르지 못한다
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  begin
    perform * from public.report_inbox_page(false, 0, 30);
    raise exception 'FAIL: 관리자가 아닌데 신고함을 본다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.admin_delete_comment('00000000-0000-4000-8000-0000000000d1');
    raise exception 'FAIL: 관리자가 아닌데 댓글을 지운다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.resolve_post_report('00000000-0000-4000-8000-0000000000a1');
    raise exception 'FAIL: 관리자가 아닌데 신고를 처리한다';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  if exists (select 1 from public.post_reports where reporter <> '00000000-0000-4000-8000-00000000000b') then
    raise exception 'FAIL: 남의 신고 기록이 보인다';
  end if;
end $$;
reset role;

-- ── 6. 댓글 좋아요 수는 뷰가 센다
insert into public.comment_likes (comment_id, user_id) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000000a'),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000000c');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  if (select like_count from public.comment_like_stats where comment_id = '00000000-0000-4000-8000-0000000000d1')
     is distinct from 2 then
    raise exception 'FAIL: 댓글 좋아요 수를 못 센다';
  end if;
end $$;
reset role;

-- ── 7. 메일 호출이 실패해도 신고는 남는다
update vault.decrypted_secrets set decrypted_secret = null;
create or replace function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int)
returns bigint language plpgsql as $$ begin raise exception 'down'; end $$;
update public.posts set visibility = 'public' where id = '00000000-0000-4000-8000-0000000000a1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
insert into public.post_reports (post_id, reporter, reason)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000c', '재확인');
reset role;
do $$ begin
  if (select count(*) from public.post_reports) <> 2 then
    raise exception 'FAIL: 메일이 실패하면 신고가 사라진다';
  end if;
end $$;

select 'OK: 0025 검증 통과' as result;

rollback;

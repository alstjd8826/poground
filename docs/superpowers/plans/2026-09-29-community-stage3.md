# 커뮤니티 3단계 — 반응과 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 댓글·대댓글에 좋아요를 누르고, 남의 게시글을 신고·차단하며, 운영자가 신고함과 메일로 게시글 신고까지 받아 처리한다.

**Architecture:** DB 는 0025 한 장 — `post_reports` 표와 메일 트리거, 댓글 좋아요 수 뷰, 그리고 신고함을 **관리자 전용 서버 함수**(security definer)로 바꿔 댓글·게시글 신고를 한 목록으로 돌려준다. 앱은 게시글 좋아요(2단계)와 같은 낙관적 반영으로 댓글 좋아요를 붙이고, 게시글 ⋮ 차림표를 내 글(수정·삭제)과 남의 글(신고·차단, 관리자면 삭제)로 넓힌다.

**Tech Stack:** Expo 57 / React Native, Supabase(Postgres RLS·security definer·pg_net·Vault, Edge Function + Resend), @tanstack/react-query, jest, PGlite(deno), deno test.

**Spec:** `docs/superpowers/specs/2026-09-28-community-design.md` ("나눠서 만들기" 3단계. 게시글 좋아요는 2단계 중에 끝났다)

## Global Constraints

- 반응: 게시글·댓글·대댓글 좋아요. 댓글 좋아요는 앱 전체 댓글(경기·선수·소식·게시글)에 적용
- 좋아요: 즉시 반영, 실패하면 되돌림, 끝날 때까지 잠금
- 읽기는 누구나. 쓰기·좋아요·댓글·신고는 로그인 — 비로그인이면 로그인 화면부터
- 남의 글을 신고·차단할 수 있고, 운영자가 신고함에서 처리한다 (심사 지침 1.2)
- `post_reports(post_id, reporter, reason, created_at, resolved_at, resolved_by)` — `comment_reports` 와 같은 모양. `(post_id, reporter)` 유일
- 신고함은 대상 종류(`comment` / `post`)를 칸으로 둔다. 신고 메일(`notify-report`)에 게시글 신고도 걸고 본문에 대상 종류를 적는다
- 차단: 기존 `user_blocks`. 앱이 차단한 사람의 글을 피드·상세에서 가린다(1단계에서 이미 가린다)
- 볼 수 없는 글·지워진 글에 댓글·좋아요·신고는 정책이 막고 앱은 "볼 수 없는 글입니다"
- 아이콘은 글자 기호가 아니라 SVG(K리그 서체에 ♡ ⋮ 같은 글자가 없다)
- 커밋·주석은 사무적 한국어. prettier `printWidth 110`, `arrowParens avoid`
- SQL 은 PGlite(`deno task sql-check`)로 먼저, 적용 뒤 SQL Editor 에서 같은 검증 스크립트를 다시

## Review Focus

1. 나만 보기로 바뀐 글의 댓글·글에 걸린 신고가 신고함에서 사라지는 경우(1단계 I4) — 관리자는 계속 봐야 한다. Task 1 검증 "나만 보기로 바뀐 글의 신고도 관리자에게 보인다"
2. 관리자가 아닌 사람이 신고함 함수·처리 함수를 부르는 경우 — 빈 목록이 아니라 거절. Task 1 검증
3. 볼 수 없는 글(남의 나만 보기, 지운 글)을 id 만 알고 신고하는 경우 — 막혀야 한다. Task 1 검증
4. 댓글 좋아요를 연타하거나 실패하는 경우, 그리고 차단한 사람·지워진 댓글의 하트 — 잠금·되돌림, 가린 댓글엔 하트 없음. Task 3 테스트
5. 메일 트리거가 실패해도(Vault 비어 있음 등) 신고 자체는 남아야 한다 — 0014 와 같은 감싸기. Task 1 검증 "메일 호출이 실패해도 신고는 남는다"

---

## 파일 구조

| 파일                                                                                                           | 할 일                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/0025_reports_and_reactions.sql` (새)                                                      | `post_reports`·정책·메일 트리거, `comment_like_stats` 뷰, 신고함 함수 `report_inbox_page`, 처리 함수 `resolve_post_report`, 옛 뷰 `report_inbox` 삭제 |
| `supabase/tests/prelude.sql`                                                                                   | `comment_reports`(0011+0017 칸), `net.http_post`·`vault.decrypted_secrets` 흉내                                                                       |
| `supabase/tests/0025_reports_check.sql` (새)                                                                   | 검증                                                                                                                                                  |
| `supabase/functions/notify-report/mail.ts` (새) + `mail.test.ts` (새)                                          | 메일 본문 만들기(순수 함수), 댓글·게시글 갈래                                                                                                         |
| `supabase/functions/notify-report/index.ts`                                                                    | 게시글 신고면 게시글을 읽어 메일                                                                                                                      |
| `src/repositories/comment/remote.ts`                                                                           | 댓글에 `likeCount`·`likedByMe`, `likeComment`·`unlikeComment`                                                                                         |
| `src/hooks/comment/useComments.ts`                                                                             | `useCommentLike` (낙관적)                                                                                                                             |
| `src/components/comment/CommentList.tsx`                                                                       | 답글 옆 하트                                                                                                                                          |
| `src/repositories/community/remote.ts`                                                                         | `reportPost`, `adminDeletePost`                                                                                                                       |
| `src/hooks/community/useCommunity.ts`                                                                          | `usePostModeration` (신고·차단·관리자 삭제)                                                                                                           |
| `src/components/community/PostMenu.tsx` (새, PostOwnerMenu 대체)                                               | 내 글: 수정·삭제 / 남의 글: 신고·차단(+관리자 삭제)                                                                                                   |
| `src/components/community/PostCard.tsx`, `src/screens/CommunityScreen.tsx`, `src/screens/PostDetailScreen.tsx` | 차림표·신고 시트 연결                                                                                                                                 |
| `src/repositories/comment/reports.ts`, `src/hooks/comment/useReports.ts`, `src/screens/ReportInboxScreen.tsx`  | 신고함이 댓글·게시글 두 갈래를 다룸                                                                                                                   |
| `docs/privacy.md`                                                                                              | 신고 기록·메일 항목에 게시글                                                                                                                          |

---

### Task 1: 0025 — 게시글 신고, 댓글 좋아요 수, 관리자 신고함

**Files:**

- Create: `supabase/migrations/0025_reports_and_reactions.sql`
- Create: `supabase/tests/0025_reports_check.sql`
- Modify: `supabase/tests/prelude.sql` (끝에 덧붙임)

**Interfaces:**

- Consumes: 0023 `posts`·`can_read_post`·`admin_delete_post`·`comment_likes`, 0011/0017 `comment_reports`, 0012 `is_admin`, 0014 의 Vault 이름 `functions_url`·`cron_secret`
- Produces:
  - 표 `public.post_reports(post_id uuid, reporter uuid, reason text, created_at, resolved_at, resolved_by)`, PK `(post_id, reporter)`
  - 뷰 `public.comment_like_stats(comment_id uuid, like_count int)` (security_invoker)
  - 함수 `public.report_inbox_page(p_only_open boolean, p_offset int, p_limit int) returns table(kind text, target_id uuid, report_count int, last_reported_at timestamptz, resolved boolean, reasons text[], subject_type text, subject_id text, body text, author uuid, deleted boolean)` — 관리자만, 최신 신고순
  - 함수 `public.resolve_post_report(p_post_id uuid) returns void` — 관리자만
  - 트리거 `post_reports_notify` → `public.notify_post_report()` → `notify-report` 에 `{ post_id, reporter, reason }`

- [ ] **Step 1: prelude 를 넓힌다**

`supabase/tests/prelude.sql` 끝에 덧붙인다. 진짜 Supabase 에는 이미 있는 것들이다.

```sql
-- ── 0011·0017 의 댓글 신고 (신고함 검증에 필요)
create table public.comment_reports (
  comment_id uuid not null references public.comments on delete cascade,
  reporter   uuid not null references auth.users on delete cascade,
  reason     text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users on delete set null,
  primary key (comment_id, reporter)
);
alter table public.comment_reports enable row level security;
create policy "own insert" on public.comment_reports
  for insert to authenticated with check (auth.uid() = reporter);
create policy "own or admin select" on public.comment_reports
  for select to authenticated using (auth.uid() = reporter or public.is_admin());

-- ── pg_net·Vault 흉내. 트리거가 부르는 모양만 맞춘다. http_post 는 부른 것을 적어 둔다
create schema if not exists net;
create table net.calls (url text, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int)
returns bigint language plpgsql security definer as $$
begin
  insert into net.calls values (url, body);
  return 1;
end $$;
grant usage on schema net to anon, authenticated;
create schema if not exists vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);
insert into vault.decrypted_secrets values ('functions_url', 'http://fn'), ('cron_secret', 's');
```

- [ ] **Step 2: 실패하는 검증 스크립트를 쓴다**

`supabase/tests/0025_reports_check.sql` — 0023·0024 검증과 같은 규칙(임시 표 없이, 고정 id, `set local role`, 끝에서 `rollback`).

```sql
-- ─────────────────────────────────────────── 0025 신고·좋아요 검증
--
-- SQL Editor 에 통째로 붙여 넣어 돌린다. a(글쓴이) b(다른 사람) c(관리자). 끝에서 rollback 한다.
-- 어긋나면 'FAIL: …', 끝까지 가면 'OK: 0025 검증 통과'.
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

do $$ begin
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
```

7번의 `create or replace function net.http_post` 는 PGlite 흉내에서만 뜻이 있다. **SQL Editor 에서는 7번 블록을 지우고 돌린다** — 진짜 `net.http_post` 를 바꾸면 안 된다. 스크립트 머리 주석에 이 줄을 적는다: `-- SQL Editor 에서는 "7." 블록을 지우고 돌린다(pg_net 을 바꾸는 흉내다)`.

- [ ] **Step 3: 실패를 본다**

Run: `deno task sql-check ./supabase/migrations/0023_community.sql ./supabase/migrations/0024_post_writes.sql ./supabase/tests/0025_reports_check.sql; git checkout -- deno.lock`
Expected: `relation "public.post_reports" does not exist`

- [ ] **Step 4: migration 을 쓴다**

`supabase/migrations/0025_reports_and_reactions.sql`:

```sql
-- ─────────────────────────────────────────── 신고와 반응
--
-- 게시글 신고(post_reports)를 댓글 신고와 같은 모양으로 두고, 들어오면 운영자에게 메일로 민다.
-- 신고함은 뷰(report_inbox)를 버리고 관리자 전용 함수로 바꾼다 — 뷰는 security_invoker 라 관리자도
-- 글 읽기 정책에 걸려, 나만 보기로 바뀐 글의 댓글·글 신고가 목록에서 사라졌다(1단계 검토 I4).
-- 댓글 좋아요 수는 뷰가 센다(좋아요 표와 정책은 0023).
--
-- 다시 돌려도 깨지지 않게 쓴다.

create table if not exists public.post_reports (
  post_id     uuid not null references public.posts on delete cascade,
  reporter    uuid not null references auth.users on delete cascade,
  reason      text not null default '',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users on delete set null,
  primary key (post_id, reporter)
);

alter table public.post_reports enable row level security;

-- 내 이름으로, 내가 볼 수 있는 글만. 안 보이는 글을 id 로 찔러 신고할 수 없게
drop policy if exists "own insert" on public.post_reports;
create policy "own insert" on public.post_reports
  for insert to authenticated
  with check (reporter = auth.uid() and public.can_read_post(post_id));

drop policy if exists "own or admin select" on public.post_reports;
create policy "own or admin select" on public.post_reports
  for select to authenticated using (reporter = auth.uid() or public.is_admin());

/* 게시글 신고 알림. 0014 의 notify_report 와 같다 — 알림은 곁가지고 기록이 본체다 */
create or replace function public.notify_post_report()
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
  begin
    perform net.http_post(
      url     := coalesce(base, 'http://host.docker.internal:54321/functions/v1') || '/notify-report',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', coalesce(secret, '')),
      body    := jsonb_build_object('post_id', new.post_id, 'reporter', new.reporter, 'reason', new.reason),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning '신고 알림을 보내지 못했습니다: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists post_reports_notify on public.post_reports;
create trigger post_reports_notify
  after insert on public.post_reports
  for each row execute function public.notify_post_report();

-- ── 댓글 좋아요 수. 부르는 사람 권한으로 센다 — 볼 수 없는 댓글의 수는 새지 않는다
drop view if exists public.comment_like_stats;
create view public.comment_like_stats
with (security_invoker = true) as
select comment_id, count(*)::int as like_count
from public.comment_likes
group by comment_id;

grant select on public.comment_like_stats to anon, authenticated;

-- ── 신고함
/*
  관리자 전용. 댓글 신고와 게시글 신고를 한 목록으로, 마지막 신고가 최신인 순으로.
  줄 단위는 신고 건이 아니라 **신고당한 대상**이다(0017 과 같다 — 열 명이 신고해도 판단은 하나).
  security definer 로 돈다. 관리자도 나만 보기 글은 읽기 정책에 걸리므로, 뷰로는 그런 신고가
  사라졌다. 여기서 is_admin() 을 먼저 본다.
*/
create or replace function public.report_inbox_page(p_only_open boolean, p_offset int, p_limit int)
returns table (
  kind text,
  target_id uuid,
  report_count int,
  last_reported_at timestamptz,
  resolved boolean,
  reasons text[],
  subject_type text,
  subject_id text,
  body text,
  author uuid,
  deleted boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다';
  end if;

  return query
  select * from (
    select
      'comment'::text,
      r.comment_id,
      count(*)::int,
      max(r.created_at),
      bool_and(r.resolved_at is not null),
      array_remove(array_agg(distinct nullif(btrim(r.reason), '')), null),
      c.subject_type,
      c.subject_id,
      c.body,
      c.author,
      c.deleted_at is not null
    from public.comment_reports r
    join public.comments c on c.id = r.comment_id
    group by r.comment_id, c.subject_type, c.subject_id, c.body, c.author, c.deleted_at
    union all
    select
      'post'::text,
      r.post_id,
      count(*)::int,
      max(r.created_at),
      bool_and(r.resolved_at is not null),
      array_remove(array_agg(distinct nullif(btrim(r.reason), '')), null),
      'post'::text,
      r.post_id::text,
      p.body,
      p.author,
      p.deleted_at is not null
    from public.post_reports r
    join public.posts p on p.id = r.post_id
    group by r.post_id, p.body, p.author, p.deleted_at
  ) inbox (kind, target_id, report_count, last_reported_at, resolved, reasons, subject_type, subject_id, body, author, deleted)
  where not p_only_open or not inbox.resolved
  order by inbox.last_reported_at desc
  offset p_offset
  limit p_limit;
end;
$$;

revoke all on function public.report_inbox_page(boolean, int, int) from public, anon;
grant execute on function public.report_inbox_page(boolean, int, int) to authenticated;

/* 게시글 신고 처리 표시. 0017 의 resolve_report 와 같다 — 표에 update 를 열지 않는다 */
create or replace function public.resolve_post_report(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다';
  end if;
  update public.post_reports
     set resolved_at = now(), resolved_by = auth.uid()
   where post_id = p_post_id and resolved_at is null;
end;
$$;

revoke all on function public.resolve_post_report(uuid) from public, anon;
grant execute on function public.resolve_post_report(uuid) to authenticated;

-- 옛 신고함 뷰. 앱은 이제 report_inbox_page() 를 부른다
drop view if exists public.report_inbox;
```

- [ ] **Step 5: 통과와 되돌리기 검사**

Run: `deno task sql-check ./supabase/migrations/0023_community.sql ./supabase/migrations/0024_post_writes.sql ./supabase/migrations/0025_reports_and_reactions.sql ./supabase/tests/0025_reports_check.sql; git checkout -- deno.lock`
Expected: `[{"result":"OK: 0025 검증 통과"}]`

그리고 scratchpad 에 0025 를 복사해 ① `and public.can_read_post(post_id)` 를 뺀 판 ② `report_inbox_page` 의 `security definer` 를 `security invoker` 로 바꾼 판 ③ `if not public.is_admin()` 검사를 뺀 판을 만들어 각각 돌린다.
Expected: ① `FAIL: 볼 수 없는 글을 신고한다` ② `FAIL: 나만 보기로 바뀐 글의 신고가 …` 또는 `… 댓글 신고가 …` ③ `FAIL: 관리자가 아닌데 신고함을 본다`. 0023·0024 검증도 0025 를 얹어 통과해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/0025_reports_and_reactions.sql supabase/tests/0025_reports_check.sql supabase/tests/prelude.sql
git commit -m "게시글 신고와 댓글 좋아요 수를 두고 신고함을 관리자 함수로 바꾼다"
```

---

### Task 2: 신고 메일에 게시글 갈래

**Files:**

- Create: `supabase/functions/notify-report/mail.ts`
- Create: `supabase/functions/notify-report/mail.test.ts`
- Modify: `supabase/functions/notify-report/index.ts`

**Interfaces:**

- Consumes: Task 1 의 트리거 본문 `{ post_id, reporter, reason }`, 0014 의 `{ comment_id, reporter, reason }`
- Produces: `buildReportMail(input: MailInput): { subject: string; text: string }`

```ts
export interface MailInput {
  kind: 'comment' | 'post'
  targetId: string
  reason: string
  reporter: string // 이미 사람 이름으로 바꾼 문자열
  author: string // 같다
  /** 댓글이면 달린 곳, 게시글이면 'post' 와 글 id */
  subjectType: string | null
  subjectId: string | null
  body: string | null
  createdAt: string | null
}
```

- [ ] **Step 1: 실패하는 테스트**

`supabase/functions/notify-report/mail.test.ts`:

```ts
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { buildReportMail } from './mail.ts'

const base = {
  reason: '욕설',
  reporter: '@b (비)',
  author: '@a (에이)',
  body: '문제의 글',
  createdAt: '2026-09-29T00:00:00Z',
}

Deno.test('게시글 신고는 제목과 본문에 게시글이라고 적고 글을 여는 링크를 단다', () => {
  const mail = buildReportMail({
    ...base,
    kind: 'post',
    targetId: 'p1',
    subjectType: 'post',
    subjectId: 'p1',
  })
  assertEquals(mail.subject, '[포그라운드] 게시글 신고 1건')
  assertStringIncludes(mail.text, '대상: 게시글')
  assertStringIncludes(mail.text, 'steelers://comment?type=post&id=p1')
  assertStringIncludes(mail.text, '게시글 id: p1')
})

Deno.test('댓글 신고는 달린 곳을 적는다', () => {
  const mail = buildReportMail({
    ...base,
    kind: 'comment',
    targetId: 'c1',
    subjectType: 'match',
    subjectId: '180',
  })
  assertEquals(mail.subject, '[포그라운드] 댓글 신고 1건')
  assertStringIncludes(mail.text, '대상: 댓글')
  assertStringIncludes(mail.text, '달린 곳: match 180')
  assertStringIncludes(mail.text, '댓글 id: c1')
})

Deno.test('글을 못 읽었으면 그 자리만 비우고 보낸다', () => {
  const mail = buildReportMail({
    ...base,
    kind: 'post',
    targetId: 'p1',
    subjectType: null,
    subjectId: null,
    body: null,
  })
  assertStringIncludes(mail.text, '(글을 읽지 못했습니다)')
  assert(!mail.text.includes('앱에서 열기'))
})
```

Run: `deno test --allow-read --no-lock supabase/functions/notify-report`
Expected: FAIL — `mail.ts` 가 없다

- [ ] **Step 2: 구현**

`supabase/functions/notify-report/mail.ts`:

```ts
/**
 * 신고 메일 본문. 댓글과 게시글이 같은 틀을 쓴다 — 무엇이 신고됐는지만 다르다.
 *
 * 앱 링크 모양은 앱의 navigation/deepLink.ts 가 읽는 것과 같아야 한다(`steelers://comment?type=&id=`).
 * 게시글은 type=post, id=글 id 로 글 상세가 열린다.
 */
export interface MailInput {
  kind: 'comment' | 'post'
  targetId: string
  reason: string
  reporter: string
  author: string
  subjectType: string | null
  subjectId: string | null
  body: string | null
  createdAt: string | null
}

const LABEL = { comment: '댓글', post: '게시글' } as const

export function appLink(type: string | null, id: string | null): string | null {
  if (!type || !id) return null
  return `steelers://comment?type=${type}&id=${encodeURIComponent(id)}`
}

export function buildReportMail(input: MailInput): { subject: string; text: string } {
  const label = LABEL[input.kind]
  const link = appLink(input.subjectType, input.subjectId)
  const lines = [
    `대상: ${label}`,
    ...(input.kind === 'comment' ? [`달린 곳: ${input.subjectType ?? '?'} ${input.subjectId ?? '?'}`] : []),
    `글쓴이: ${input.author}`,
    `신고한 사람: ${input.reporter}`,
    `신고 사유: ${input.reason || '(적지 않음)'}`,
    `쓴 시각: ${input.createdAt ?? '?'}`,
    '',
    '내용',
    '----',
    input.body ?? '(글을 읽지 못했습니다)',
    '',
    // 링크는 앱이 깔린 기기에서만 열린다. 열리지 않을 때를 위해 아래 id 를 함께 남긴다
    ...(link ? [`앱에서 열기: ${link}`, ''] : []),
    `${label} id: ${input.targetId}`,
    '신고함: 앱 → 마이 → 신고함',
  ]
  return { subject: `[포그라운드] ${label} 신고 1건`, text: lines.join('\n') }
}
```

`index.ts` — `appLink` 와 `lines` 조립을 지우고 `mail.ts` 를 쓴다. `Payload` 를 `{ comment_id?: string; post_id?: string; reporter: string; reason: string }` 로 넓히고, 본문 읽기를 두 갈래로:

```ts
import { buildReportMail } from './mail.ts'

// …(비밀·키 확인은 그대로)
const payload = (await req.json()) as Payload
const db = adminClient()
const kind = payload.post_id ? 'post' : 'comment'
const targetId = (payload.post_id ?? payload.comment_id)!

// 메일에 담을 내용. 하나라도 못 읽으면 그 자리만 비우고 보낸다 — 알림이 늦는 것보다 낫다
const target =
  kind === 'post'
    ? (await db.from('posts').select('body, author, created_at').eq('id', targetId).maybeSingle()).data
    : (
        await db
          .from('comments')
          .select('subject_type, subject_id, body, author, created_at')
          .eq('id', targetId)
          .maybeSingle()
      ).data

const ids = [target?.author, payload.reporter].filter(Boolean) as string[]
const { data: people } = await db.from('profiles').select('id, handle, nickname').in('id', ids)
const who = (id: string | undefined) => {
  const p = people?.find(x => x.id === id)
  return p ? `@${p.handle} (${p.nickname})` : (id ?? '알 수 없음')
}

const mail = buildReportMail({
  kind,
  targetId,
  reason: payload.reason,
  reporter: who(payload.reporter),
  author: who(target?.author),
  subjectType:
    kind === 'post'
      ? target
        ? 'post'
        : null
      : ((target as { subject_type?: string })?.subject_type ?? null),
  subjectId:
    kind === 'post' ? (target ? targetId : null) : ((target as { subject_id?: string })?.subject_id ?? null),
  body: target?.body ?? null,
  createdAt: target?.created_at ?? null,
})
```

그리고 Resend 호출의 `subject`·`text` 를 `mail.subject`·`mail.text` 로.

Run: `deno test --allow-read --no-lock supabase/functions/notify-report && deno check supabase/functions/notify-report/index.ts; git checkout -- deno.lock`
Expected: 3 passed, 타입 오류 없음

- [ ] **Step 3: 커밋**

```bash
git add supabase/functions/notify-report
git commit -m "신고 메일이 게시글 신고도 다룬다"
```

배포는 Task 7 에서 사용자와 함께 한다(관리 API multipart — 메모리 `supabase-cli-deploy-hangs`).

---

### Task 3: 댓글 좋아요

**Files:**

- Modify: `src/repositories/comment/remote.ts`
- Modify: `src/hooks/comment/useComments.ts`
- Modify: `src/components/comment/CommentList.tsx`
- Test: `__tests__/comment-like.test.tsx` (새)

**Interfaces:**

- Consumes: Task 1 의 `comment_like_stats`, 0023 `comment_likes`. 2단계의 `LikeButton({ liked, count, onPress })`
- Produces:
  - `Comment` 에 `likeCount: number`, `likedByMe: boolean`
  - `likeComment(commentId: string, userId: string): Promise<void>`, `unlikeComment(commentId: string, userId: string): Promise<void>`
  - `useCommentLike(subject: CommentSubject): { toggle: (c: Comment) => Promise<void>; signedIn: boolean }`

- [ ] **Step 1: 실패하는 테스트**

`__tests__/comment-like.test.tsx` — 저장소는 `post-like.test.ts` 와 같은 표별 흉내로(`comments`·`profiles`·`comment_like_stats`·`comment_likes` 행을 돌려주는 chain), 훅은 `community-hooks.test.tsx` 의 좋아요 묶음과 같은 방식(캐시를 심고 즉시 반영·되돌림·잠금)으로, 화면은 `CommentList` 를 `useComments`·`useCommentLike` 흉내와 함께 그린다.

```tsx
// 저장소
it('댓글 한 쪽을 읽을 때 좋아요 수와 내가 눌렀는지 함께 받는다', async () => {
  const page = await listCommentPage({ type: 'match', id: '180' }, 0)
  expect(page.comments[0]).toMatchObject({ likeCount: 2, likedByMe: true })
})
it('로그인 전이면 내 좋아요는 묻지 않는다', async () => {
  mockSession = null
  const page = await listCommentPage({ type: 'match', id: '180' }, 0)
  expect(page.comments[0]).toMatchObject({ likeCount: 2, likedByMe: false })
  expect(mockReads.some(([table]) => table === 'comment_likes')).toBe(false)
})
it('누르고 푼다', async () => {
  await likeComment('c1', 'me')
  await unlikeComment('c1', 'me')
  expect(mockWrites).toEqual([
    ['comment_likes', 'insert', { comment_id: 'c1', user_id: 'me' }],
    ['comment_likes', 'delete', { comment_id: 'c1', user_id: 'me' }],
  ])
})

// 훅 — commentKeys.comments(subject) 캐시({ pages: [{ comments: [c], totalRoots: 1 }] })를 심고
it('누르는 즉시 반영하고 실패하면 되돌린다', async () => {
  /* likePost 묶음과 같은 모양 */
})
it('끝나기 전에 또 누르면 한 번만 보낸다', async () => {
  /* 같다 */
})

// 화면
it('댓글과 답글에 하트가 있고 누르면 좋아요를 보낸다', () => {
  // useComments 흉내가 댓글 하나(likeCount 1)를 준다
  fireEvent.press(screen.getByRole('button', { name: '좋아요 1' }))
  expect(mockToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }))
})
it('지워진 댓글과 차단한 사람의 댓글에는 하트가 없다', () => {
  /* 답글 단추와 같은 조건 */
})
it('로그인 전이면 로그인부터 청한다', () => {
  /* signedIn false → onRequireLogin */
})
```

훅 두 테스트의 본문은 `__tests__/community-hooks.test.tsx` 의 `describe('좋아요')` 를 그대로 옮기되 캐시 모양만 댓글 쪽(`{ pages: [{ comments: Comment[]; totalRoots }] }`)으로 바꾼다. 흉내 이름은 `mock` 으로 시작해야 한다(jest.mock 호이스팅).

Run: `npx jest __tests__/comment-like.test.tsx`
Expected: FAIL — `likeComment` 등이 없다

- [ ] **Step 2: 구현**

`remote.ts` — `Comment` 에 두 칸, `toComment(row, who, stats, liked)`, `listCommentPage` 끝에서 사람 읽기와 함께 두 번 더 묻는다:

```ts
const ids = rows.map(r => r.id)
const [statsRes, liked] = await Promise.all([
  supabase.from('comment_like_stats').select('comment_id,like_count').in('comment_id', ids),
  likedCommentsAmong(ids),
])
// 수를 못 읽어도 댓글은 보여 준다. 0 으로 뜨는 편이 빈 화면보다 낫다
const stats = new Map(
  ((statsRes.error ? [] : statsRes.data) as { comment_id: string; like_count: number }[]).map(s => [
    s.comment_id,
    s.like_count,
  ]),
)
```

```ts
async function likedCommentsAmong(ids: string[]): Promise<Set<string>> {
  const { data } = await supabase.auth.getSession()
  const me = data.session?.user.id
  if (!me || ids.length === 0) return new Set()
  const { data: rows, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', me)
    .in('comment_id', ids)
  if (error) return new Set()
  return new Set((rows as { comment_id: string }[]).map(r => r.comment_id))
}

export async function likeComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId })
  if (error) throw error
}

export async function unlikeComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)
  if (error) throw error
}
```

`useComments.ts` — `usePostLike` 와 같은 틀(모듈 수준 `pendingCommentLikes`, 캐시 `commentKeys.comments(subject)` 의 `pages[].comments[]` 를 고친다, 실패하면 되돌린다):

```ts
export function useCommentLike(subject: CommentSubject) {
  const client = useQueryClient()
  const { session } = useAuth()
  const me = session?.user.id ?? null
  const toggle = useCallback(
    async (comment: Comment) => {
      if (!me) throw new Error('로그인이 필요합니다')
      if (pendingCommentLikes.has(comment.id)) return
      pendingCommentLikes.add(comment.id)
      const on = !comment.likedByMe
      const flip = (to: boolean) => (c: Comment) =>
        c.id === comment.id ? { ...c, likedByMe: to, likeCount: Math.max(0, c.likeCount + (to ? 1 : -1)) } : c
      const patch = (to: boolean) =>
        client.setQueryData<InfiniteData<CommentPage>>(commentKeys.comments(subject), data =>
          data
            ? { ...data, pages: data.pages.map(p => ({ ...p, comments: p.comments.map(flip(to)) })) }
            : data,
        )
      patch(on)
      try {
        if (on) await likeComment(comment.id, me)
        else await unlikeComment(comment.id, me)
      } catch (e) {
        patch(!on)
        throw e
      } finally {
        pendingCommentLikes.delete(comment.id)
      }
    },
    [client, me, subject],
  )
  return { toggle, signedIn: me !== null }
}
```

(`commentKeys.comments(subject)` 의 실제 캐시 모양은 파일의 `useInfiniteQuery` 가 돌려주는 `pages` 를 먼저 읽고 맞춘다. 다르면 Ruling.)

`CommentList.tsx` — `CommentRow` 의 `styles.tools` 안, 답글 앞에 `LikeButton` 을 둔다. 보이는 조건은 답글과 같다(`!comment.deleted && !blocked`). 누르면 `signedIn` 이 아니면 `onRequireLogin`, 맞으면 `toggle(comment).catch(e => Alert.alert('좋아요를 남기지 못했습니다', …))`. `onReply` 가 없어도(나만 보기 글 등) 하트는 뜬다 — `tools` 줄의 조건을 `!comment.deleted && !blocked` 로 바꾸고 답글만 `onReply &&` 로 감싼다.

Run: `npx jest __tests__/comment-like.test.tsx && npx tsc --noEmit && npx jest --silent 2>&1 | tail -4`
Expected: 모두 통과. 기존 댓글 테스트의 `Comment` 조각에 `likeCount: 0, likedByMe: false` 를 채워야 할 수 있다

- [ ] **Step 3: 커밋**

```bash
git add src/repositories/comment/remote.ts src/hooks/comment/useComments.ts src/components/comment/CommentList.tsx __tests__
git commit -m "댓글과 답글에 좋아요를 누른다"
```

---

### Task 4: 남의 게시글 신고·차단, 관리자 삭제

**Files:**

- Create: `src/components/community/PostMenu.tsx` (PostOwnerMenu 를 대체 — 옛 파일은 지운다)
- Modify: `src/repositories/community/remote.ts`, `src/hooks/community/useCommunity.ts`
- Modify: `src/components/community/PostCard.tsx`, `src/screens/CommunityScreen.tsx`, `src/screens/PostDetailScreen.tsx`
- Test: `__tests__/post-menu.test.tsx` (새), `__tests__/post-card.test.tsx`, `__tests__/community-screens.test.tsx`

**Interfaces:**

- Consumes: Task 1 의 `post_reports`, 0023 `admin_delete_post(p_id)`, `blockUser`·`amIAdmin`·`commentKeys`(comment/remote·useComments), `ReportSheet({ open, onClose, onSubmit })`
- Produces:
  - `reportPost(postId: string, reporter: string, reason: string): Promise<void>` (중복은 조용히 — `reportComment` 와 같은 upsert ignoreDuplicates)
  - `adminDeletePost(postId: string): Promise<void>` (rpc `admin_delete_post`)
  - `usePostModeration(): { signedIn: boolean; isAdmin: boolean; report(post: Post, reason: string): Promise<void>; block(post: Post): Promise<void>; adminDelete(post: Post): Promise<void> }` — 차단·삭제 뒤 `communityKeys.all` 과 `commentKeys.blocked(me)` 를 새로 받는다
  - `PostMenu({ post, mine, isAdmin, signedIn, onEdit, onDelete, onReport, onBlock, onAdminDelete, onRequireLogin })`
  - `PostCardProps` 의 `mine`·`onEdit`·`onDelete` 를 `menu?: Omit<PostMenuProps, 'post'>` 하나로 바꾼다

- [ ] **Step 1: 실패하는 테스트** — `__tests__/post-menu.test.tsx` (MoreDots 는 `post-card.test.tsx` 처럼 누르면 바로 알리는 흉내)

```tsx
it('내 글이면 수정·삭제', async () => {
  /* mine → '수정','삭제' 가 뜨고 '신고' 는 없다 */
})
it('남의 글이면 신고·이 사용자 차단', async () => {
  /* mine=false → '신고','이 사용자 차단', '수정' 없음 */
})
it('관리자면 남의 글에 삭제가 더 있다', async () => {
  /* isAdmin → '삭제' 누르면 한 번 묻고 onAdminDelete */
})
it('로그인 전이면 신고·차단을 누를 때 로그인부터', async () => {
  /* signedIn=false → onRequireLogin, onReport 안 불림 */
})
it('차단은 한 번 묻는다', async () => {
  /* Alert '이 사용자를 차단할까요?' → 확인 → onBlock */
})
```

그리고 `community-screens.test.tsx` 에:

```tsx
it('남의 글 ⋮ → 신고 → 사유를 고르면 신고를 보낸다', async () => {
  /* ReportSheet 흉내 onSubmit('욕설') → mockModeration.report(post,'욕설'), Alert '신고했습니다' */
})
```

Run: `npx jest __tests__/post-menu.test.tsx __tests__/community-screens.test.tsx`
Expected: FAIL — `PostMenu` 가 없다

- [ ] **Step 2: 구현**

`PostMenu.tsx` — `PostOwnerMenu` 의 틀(`MoreDots` + `DropdownMenu`)에 항목만 넓힌다:

```tsx
export interface PostMenuProps {
  post: Post
  mine: boolean
  isAdmin: boolean
  signedIn: boolean
  onEdit: (post: Post) => void
  onDelete: (post: Post) => void
  onReport: (post: Post) => void
  onBlock: (post: Post) => void
  onAdminDelete: (post: Post) => void
  onRequireLogin?: () => void
}

/**
 * 게시글 ⋮. 내 글은 수정·삭제, 남의 글은 신고·차단(심사 지침 1.2), 관리자는 남의 글도 내린다.
 * 로그인 전이면 신고·차단이 누가 했는지 남길 수 없으므로 로그인부터 청한다(댓글 차림표와 같다).
 */
export function PostMenu(props: PostMenuProps) {
  const { post, mine, isAdmin, signedIn } = props
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)
  const items = useMemo<MenuItem[]>(() => {
    if (mine) {
      return [
        { label: '수정', onPress: () => props.onEdit(post) },
        {
          label: '삭제',
          destructive: true,
          onPress: () =>
            confirm('글을 지울까요?', '지운 글은 되살릴 수 없습니다.', '지우기', () => props.onDelete(post)),
        },
      ]
    }
    const gate = (run: () => void) => (signedIn ? run : () => props.onRequireLogin?.())
    const list: MenuItem[] = [
      { label: '신고', onPress: gate(() => props.onReport(post)) },
      {
        label: '이 사용자 차단',
        onPress: gate(() =>
          confirm(
            '이 사용자를 차단할까요?',
            '이 사람의 글과 댓글이 나에게 안 보입니다. 마이에서 풀 수 있습니다.',
            '차단',
            () => props.onBlock(post),
          ),
        ),
      },
    ]
    if (isAdmin) {
      list.push({
        label: '삭제',
        destructive: true,
        onPress: () =>
          confirm('이 글을 내릴까요?', '관리자 삭제입니다. 되살릴 수 없습니다.', '내리기', () =>
            props.onAdminDelete(post),
          ),
      })
    }
    return list
  }, [isAdmin, mine, post, props, signedIn])
  return (
    <>
      <MoreDots onPress={setAnchor} accessibilityLabel="글 더보기" />
      <DropdownMenu anchor={anchor} items={items} onClose={() => setAnchor(null)} />
    </>
  )
}

function confirm(title: string, message: string, ok: string, run: () => void) {
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: run },
  ])
}
```

차단 문구의 "마이에서 풀 수 있습니다" 는 지금 마이에 차단 목록이 없으면 **"댓글 ⋮ 에서 풀 수 있습니다"** 로 쓴다(`grep -rn "차단 풀기" src` 로 확인 — 댓글 차림표에 있다). 없는 길을 적지 않는다.

`remote.ts` 에 `reportPost`·`adminDeletePost`, `useCommunity.ts` 에 `usePostModeration`(`amIAdmin` 은 `commentKeys.admin(me)` 캐시를 같이 쓴다). `PostCard` 는 `menu` 가 있으면 `PostMenu` 를 그린다(모든 글에 ⋮ — 남의 글에도). `CommunityScreen`·`PostDetailScreen` 은 `ReportSheet` 상태(`reporting: Post | null`)를 들고, 제출하면 `report` → `Alert.alert('신고했습니다', '확인 후 조치하겠습니다.')`(댓글과 같은 문구), 실패하면 `'신고하지 못했습니다'`. 상세에서 차단·관리자 삭제가 끝나면 `onDeleted()`(뒤로).

`PostOwnerMenu.tsx` 는 지우고 쓰던 곳을 `PostMenu` 로 바꾼다. 기존 `post-card.test.tsx` 의 "내 글 차림표" 테스트는 `menu` prop 으로 옮긴다.

Run: `npx jest __tests__/post-menu.test.tsx __tests__/post-card.test.tsx __tests__/community-screens.test.tsx && npx tsc --noEmit && npm run lint && npx jest --silent 2>&1 | tail -4`
Expected: 모두 통과

- [ ] **Step 3: 커밋**

```bash
git add src __tests__
git commit -m "남의 게시글을 신고·차단하고 관리자는 내린다"
```

---

### Task 5: 신고함이 게시글 신고도 다룬다

**Files:**

- Modify: `src/repositories/comment/reports.ts`, `src/hooks/comment/useReports.ts`, `src/screens/ReportInboxScreen.tsx`
- Test: `__tests__/report-inbox.test.tsx` (있으면 넓히고, 없으면 새로)

**Interfaces:**

- Consumes: Task 1 의 `report_inbox_page(p_only_open, p_offset, p_limit)`, `resolve_report(p_comment_id)`, `resolve_post_report(p_post_id)`, Task 4 의 `adminDeletePost`
- Produces:
  - `Report` 에 `kind: 'comment' | 'post'`, `targetId: string` (옛 `commentId` 는 `targetId` 로 바꾼다)
  - `listReports(page, onlyOpen)` 는 rpc 를 부른다
  - `resolveReport(report: Pick<Report, 'kind' | 'targetId'>)`
  - `useReports().removeAndResolve.mutate(report)` — 댓글은 `removeComment`, 게시글은 `adminDeletePost`

- [ ] **Step 1: 실패하는 테스트**

```tsx
it('신고함 함수를 부르고 댓글·게시글 두 갈래를 옮긴다', async () => {
  // supabase.rpc('report_inbox_page', { p_only_open: true, p_offset: 0, p_limit: 30 }) 가
  // [{ kind: 'post', target_id: 'p1', subject_type: 'post', subject_id: 'p1', … }, { kind: 'comment', … }] 를 준다
  const reports = await listReports(0, true)
  expect(reports.map(r => [r.kind, r.targetId, r.subject.type])).toEqual([
    ['post', 'p1', 'post'],
    ['comment', 'c1', 'match'],
  ])
})
it('게시글 신고 처리는 게시글 처리 함수를 부른다', async () => {
  await resolveReport({ kind: 'post', targetId: 'p1' })
  expect(mockRpc).toHaveBeenCalledWith('resolve_post_report', { p_post_id: 'p1' })
})
it('신고함 화면에 게시글 신고가 게시글로 적힌다', () => {
  // useReports 흉내가 kind 'post' 한 건 → '게시글 · @a' 와 '신고된 게시글 보기' 이름표
})
it('게시글 신고를 지우면 관리자 삭제를 부른다', () => {
  /* 확인 창 → removeAndResolve.mutate(report) */
})
```

Run: `npx jest __tests__/report-inbox.test.tsx`
Expected: FAIL

- [ ] **Step 2: 구현**

`reports.ts` — `Row` 를 함수 반환 칸에 맞추고(`kind, target_id, report_count, last_reported_at, resolved, reasons, subject_type, subject_id, body, author, deleted`), `supabase.rpc('report_inbox_page', { p_only_open: onlyOpen, p_offset: page * REPORT_PAGE, p_limit: REPORT_PAGE })`. 사람 이름 읽기는 그대로. `resolveReport` 는 `kind` 로 `resolve_report`(`p_comment_id`) / `resolve_post_report`(`p_post_id`) 를 가른다.

`useReports.ts` — `removeAndResolve` 가 `Report` 를 받아 갈래를 나눈다. 끝나면 `['reports']`, `['comments']`, `['community']` 를 새로 받는다.

`ReportInboxScreen.tsx` — 줄 머리를 `SUBJECT_LABEL` 대신 `kind` 로: 게시글이면 `게시글 · @아이디`, 댓글이면 지금처럼 달린 곳 이름. 접근성 이름 `신고된 게시글 보기` / `…에 달린 신고된 댓글 보기`. 지워진 대상 문구 `이미 지워진 글입니다`(게시글) / `이미 지워진 댓글입니다`(댓글). `key` 는 `${kind}-${targetId}`.

Run: `npx jest __tests__/report-inbox.test.tsx && npx tsc --noEmit && npm run lint && npx jest --silent 2>&1 | tail -4`
Expected: 모두 통과

- [ ] **Step 3: 커밋**

```bash
git add src/repositories/comment/reports.ts src/hooks/comment/useReports.ts src/screens/ReportInboxScreen.tsx __tests__
git commit -m "신고함에 게시글 신고를 함께 싣는다"
```

---

### Task 6: 개인정보 방침

**Files:** Modify `docs/privacy.md`

- [ ] **Step 1**: 1-2 표의 신고 기록 줄 `신고 기록(신고한 글, 사유, 시각)` 은 그대로(글에 게시글이 포함된다)지만, 3절 Resend 줄의 넘어가는 정보 `신고된 댓글의 내용과 신고 사유` 를 `신고된 댓글·게시글의 내용과 신고 사유` 로. 5절 표에 `| 특정 이용자의 글 안 보기 | 글·댓글 오른쪽 ⋮ → 이 사용자 차단 |` 로 기존 댓글 차단 줄을 넓히고, `| 글·댓글 신고 | 글·댓글 오른쪽 ⋮ → 신고 |` 가 없으면 더한다. 7절(신고와 차단) 문단에 게시글을 넣는다.
- [ ] **Step 2**: `npx prettier --write docs/privacy.md && npm run lint`, 커밋 `개인정보 방침의 신고·차단에 게시글을 넣는다`

---

### Task 7: 적용과 실측 (사용자와 함께)

- [ ] **Step 1**: `npx tsc --noEmit && npm run lint && npx jest --silent` 통과, `deno test --allow-read --no-lock supabase/functions` 통과, 0023+0024+0025 에 0023·0024·0025 검증 모두 통과(`git checkout -- deno.lock`)
- [ ] **Step 2**: 0025 를 SQL Editor 에서 돌려 달라고 청한다(`pbcopy < supabase/migrations/0025_reports_and_reactions.sql`). 답을 받기 전에는 넘어가지 않는다
- [ ] **Step 3**: 검증 스크립트를 **7번 블록을 지운 판**으로 복사해 청한다 — `python3` 로 `-- ── 7.` 부터 `select 'OK` 앞까지 잘라 scratchpad 에 쓰고 `pbcopy`. 마지막 줄 `OK: 0025 검증 통과`
- [ ] **Step 4**: `notify-report` 를 배포한다 — 관리 API multipart(메모리 `supabase-cli-deploy-hangs`), `verify_jwt` false 유지. 배포 전 사용자에게 알린다
- [ ] **Step 5**: 로그인 없이 막히는지

```bash
set -a && . ./.env && set +a
curl -s -X POST -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" -H "Content-Type: application/json" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/rpc/report_inbox_page" -d '{"p_only_open":true,"p_offset":0,"p_limit":5}'
curl -s -X POST -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" -H "Content-Type: application/json" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/post_reports" -d '{"post_id":"5da13969-8f84-4841-a5bc-b1ccf7182eb6","reporter":"00000000-0000-0000-0000-000000000000","reason":"x"}'
curl -s -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/comment_like_stats?select=*&limit=1"
```

Expected: 첫째 `permission denied for function`(42501), 둘째 42501(RLS), 셋째 `[]` 또는 숫자 행

- [ ] **Step 6**: 폰 설치 — 무료 팀 프로필 우회(메모리 `steelers-ios-node-env`): `xcodebuild … -allowProvisioningUpdates build` 뒤 `xcrun devicectl device install app`
- [ ] **Step 7**: 사용자 확인
  1. 경기·게시글 댓글과 답글에 하트 — 누르면 채워지고 수가 오른다, 다시 누르면 푼다
  2. 테스트 계정(`@test_fan`)으로 본인 글을 ⋮ → 신고 → 사유 → "신고했습니다", **메일 도착**(제목 `게시글 신고 1건`, 앱에서 열기 링크)
  3. 마이 → 신고함에 `게시글 · @아이디` 로 뜨고, 누르면 그 글, 처리 완료·삭제가 된다
  4. ⋮ → 이 사용자 차단 → 피드에서 그 사람 글이 빠진다(되돌리기는 댓글 ⋮ 차단 풀기)
  5. 관리자 계정으로 남의 글 ⋮ 에 삭제가 있다

폰에서 넣은 신고·좋아요는 시험 데이터 — 메모리 `ask-before-app-review-cleanup` 에 적는다.

---

## 스펙 대비 메모

- 신고 표 모양은 스펙의 `detail` 칸을 두지 않는다 — `comment_reports` 와 같게 사유 하나(시트가 고른 것 또는 직접 쓴 것)만. 스펙이 "comment_reports 와 같은 모양" 이라고 한 쪽을 따른다
- 신고함 뷰를 넓히는 대신 관리자 함수로 바꾼다 — 뷰(security_invoker)로는 나만 보기 글의 신고가 사라진다(1단계 I4). 스펙의 "대상 종류를 칸으로" 는 `kind` 칸이다
- 차단한 사람 목록을 마이에서 관리하는 화면은 없다(스펙에도 없다). 푸는 길은 댓글 ⋮ 의 "차단 풀기" 뿐 — 그 사람 글이 피드에서 다 빠지면 풀 길이 멀어진다. 필요하면 따로

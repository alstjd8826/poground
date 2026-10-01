# 커뮤니티 2단계 — 쓰기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 사람이 사진 4장까지와 본문으로 글을 올리고, 제 글을 고치고(사진·본문·직관 경기·공개 설정) 지운다.

**Architecture:** 사진을 먼저 비공개 버킷에 올리고, 글과 사진 행은 RPC `save_post` 한 번(한 트랜잭션)으로 만든다·고친다 — 반쪽 글이 피드에 보이지 않는다. 사진 파일 이름은 자리 번호가 아니라 사진마다 새 uuid 라서, 순서를 바꿀 때 파일을 옮기지 않고 행만 바꾼다. 화면은 초안 리듀서(순수 함수) + 저장 훅 + 글쓰기 화면 하나(새 글·고치기 겸용)로 나눈다.

**Tech Stack:** Expo 57 / React Native, Supabase(Postgres RLS, Storage), @tanstack/react-query, expo-image-picker, expo-crypto, jest + @testing-library/react-native, PGlite(deno) 로 SQL 검증.

**Spec:** `docs/superpowers/specs/2026-09-28-community-design.md` (이 계획은 "나눠서 만들기" 의 2단계만)

## Global Constraints

- 글당 사진 최대 4장. 자르지 않는다. 찍기, 앨범(여러 장), 순서 바꾸기, 빼기
- 본문 `char_length(btrim(body)) between 1 and 1000`, 화면에 남은 글자 수
- 공개 설정은 게시글의 칸 하나. 전체 공개 / 나만 보기, 기본 전체 공개. 수정으로 언제든 바꾼다
- 헤더 `[올리기]`. 사진을 먼저 올리고 글을 마지막에 만든다. 실패하면 올라간 사진을 지우고 초안을 그대로 둔다
- 사진 버킷 `post-photos` 비공개, 5MB, `image/jpeg`·`image/png`. 경로 첫 칸은 사용자 id, 둘째 칸은 글 id
- 지우기는 소프트 삭제(`deleted_at`). 되살리기 없음(0023 `posts_guard`)
- 쓰기는 로그인. 비로그인이면 로그인 화면부터
- 커밋·PR·주석은 사무적 한국어. prettier `printWidth 110`, `arrowParens avoid`
- 새 SQL 은 먼저 PGlite(`deno task sql-check`)로, 적용 뒤 SQL Editor 에서 같은 검증 스크립트로 다시 본다

## Review Focus

1. 새 글 사진 올리기에서 스토리지가 select 정책을 요구하는 경우 — 글이 아직 없어 `can_read_post_photo` 가 거짓이다. `upsert: false` 로 올려 insert 정책만 타게 한다(Task 2 테스트가 `upsert: false` 를 못 박는다). 폰에서 새 글 사진 올리기를 꼭 본다(Task 8)
2. 저장 RPC 가 성공한 뒤 옛 사진 지우기가 실패하는 경우 — 새로 올린 사진까지 지우면 방금 저장한 글의 사진이 깨진다. 정리 실패는 삼킨다(Task 2 테스트 "옛 사진 정리가 실패해도 새 사진은 지우지 않는다")
3. 남의 글 id 로 `save_post` 를 부르는 경우 — 남의 글을 덮거나 사진을 바꿔 달면 안 된다(Task 1 검증)
4. 고치기 화면에서 남의 글·지워진 글·나만 보기로 가려진 글을 여는 경우 — 저장 단추가 살아 있으면 안 된다(Task 5 테스트 "내 글이 아니면 고칠 수 없다")
5. 같은 사진을 앨범에서 두 번 고르거나 남은 자리보다 많이 고른 경우 — 4장을 넘지 않는다(Task 3 리듀서 테스트)

---

## 스펙과 다르게 정한 것

- **사진 경로** — 스펙은 `{uid}/{postId}/{position}` 이다. 그대로면 고치기에서 순서를 바꿀 때 파일을 서로 덮어써야 하고, 중간에 실패하면 행과 파일이 어긋난다. 2단계에서 `{uid}/{postId}/{photoId}`(사진마다 새 uuid)로 바꾼다. 읽기 정책은 첫째·둘째 칸만 보므로 그대로다. 0023 의 사진 행 정책만 0024 에서 고친다. 1단계 시험 글에는 사진이 없어 옮길 파일이 없다
- **사진 캐시 버전** — 1단계는 `posts.updated_at` 을 썼다. 파일 이름이 한 번 쓰고 안 바뀌므로 고정 버전으로 바꾼다. 안 그러면 본문만 고쳐도 모든 사진을 다시 받는다

---

## 파일 구조

| 파일                                                                                                         | 할 일                                            |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `supabase/migrations/0024_post_writes.sql` (새)                                                              | 사진 행 경로 정책 교체, `save_post` RPC          |
| `supabase/tests/0024_post_writes_check.sql` (새)                                                             | SQL Editor·PGlite 겸용 검증                      |
| `supabase/tests/run.ts`                                                                                      | migration 여러 개를 차례로 적용                  |
| `src/repositories/remote/imageUpload.ts`                                                                     | `upsert` 선택지                                  |
| `src/models/community.ts`                                                                                    | `POST_PHOTO_VERSION`, 경로 주석                  |
| `src/repositories/community/remote.ts`                                                                       | `postPhotoPath`, `savePost`, `deletePost`        |
| `src/models/postDraft.ts` (새)                                                                               | 초안 모양과 리듀서, `canSubmit`, `draftFromPost` |
| `src/utils/pickPhoto.ts`                                                                                     | `pickManyFromLibrary`                            |
| `src/hooks/community/useCommunity.ts`                                                                        | `usePhotoAt`, `useSavePost`, `useDeletePost`     |
| `src/components/foundation/MoreDots.tsx` (새)                                                                | 세로 점 셋 단추(재는 자리까지)                   |
| `src/components/community/PostOwnerMenu.tsx` (새)                                                            | 내 글 ⋮ → 수정·삭제                              |
| `src/components/community/PostCard.tsx`                                                                      | 내 글 차림표, `matchLine` 내보내기               |
| `src/screens/PostComposerScreen.tsx` (새)                                                                    | 글쓰기·고치기 한 화면                            |
| `src/screens/CommunityScreen.tsx`                                                                            | `[글쓰기]` 떠 있는 단추, 내 글 차림표            |
| `src/screens/PostDetailScreen.tsx`                                                                           | 내 글 차림표                                     |
| `src/navigation/types.ts`, `detailScreens.tsx`, `routes/community.tsx` (새), `routes/detail.tsx`, `tabs.tsx` | `PostComposer` 라우트, 연결                      |
| `docs/privacy.md`                                                                                            | 게시글 항목                                      |

---

### Task 1: 0024 — 사진 경로와 저장 RPC

**Files:**

- Create: `supabase/migrations/0024_post_writes.sql`
- Create: `supabase/tests/0024_post_writes_check.sql`
- Modify: `supabase/tests/run.ts`

**Interfaces:**

- Consumes: 0023 의 `posts`, `post_photos`, `posts_guard`, "own insert"/"own update" 정책
- Produces: `public.save_post(p_id uuid, p_body text, p_visibility text, p_match_year int, p_match_league_id int, p_match_game_id int, p_paths text[]) returns timestamptz` (저장된 `updated_at`). 사진 경로 모양 `{uid}/{postId}/{uuid}`

- [ ] **Step 1: 검증기가 migration 여러 개를 받게 한다**

`supabase/tests/run.ts` 의 인자 처리와 적용 부분을 바꾼다. 마지막 인자가 검증 스크립트, 앞은 차례로 적용할 migration 이다.

```ts
const args = [...Deno.args]
const checkPath = args.pop()
const migrationPaths = args
if (!checkPath || migrationPaths.length === 0) {
  console.error('사용: deno task sql-check <migration.sql>... <check.sql>')
  Deno.exit(2)
}
const prelude = Deno.readTextFileSync(new URL('./prelude.sql', import.meta.url))
const db = new PGlite()
await db.exec(prelude)

for (const path of migrationPaths) {
  try {
    await db.exec(Deno.readTextFileSync(path))
  } catch (e) {
    console.error(`migration 실패 (${path}):`, (e as Error).message)
    Deno.exit(1)
  }
}
```

파일 머리 주석의 사용 예도 `deno task sql-check supabase/migrations/0023_community.sql supabase/migrations/0024_post_writes.sql supabase/tests/0024_post_writes_check.sql` 로 고친다.

Run: `deno task sql-check ./supabase/migrations/0023_community.sql ./supabase/tests/0023_community_check.sql; git checkout -- deno.lock`
Expected: `[{"result":"OK: 0023 검증 통과"}]` (고친 검증기가 옛 사용법 그대로 돈다)

- [ ] **Step 2: 실패하는 검증 스크립트를 쓴다**

`supabase/tests/0024_post_writes_check.sql` — 0023 검증과 같은 규칙(임시 표·임시 함수 없이, 고정 id, `set local role`, 끝에서 `rollback`). 사진 이름 uuid 는 고정값을 쓴다.

```sql
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

select 'OK: 0024 검증 통과' as result;

rollback;
```

- [ ] **Step 3: 실패를 본다**

0024 가 아직 없으므로 0023 만 적용하고 돌린다.

Run: `deno task sql-check ./supabase/migrations/0023_community.sql ./supabase/tests/0024_post_writes_check.sql; git checkout -- deno.lock`
Expected: `function public.save_post(...) does not exist` 류의 오류로 실패

- [ ] **Step 4: migration 을 쓴다**

`supabase/migrations/0024_post_writes.sql`:

```sql
-- ─────────────────────────────────────────── 커뮤니티 글 쓰기
--
-- 사진은 앱이 먼저 버킷에 올리고, 글과 사진 행은 save_post() 한 번으로 만든다·고친다.
-- 한 트랜잭션이라 사진 행 없이 글만 생기는 반쪽이 피드에 보이지 않는다.
--
-- 사진 파일 이름은 자리 번호가 아니라 사진마다 새 uuid 다({uid}/{postId}/{uuid}). 자리 번호로
-- 두면 순서를 바꿀 때 파일끼리 덮어써야 하고, 중간에 실패하면 행과 파일이 어긋난다. 이름이
-- 안 바뀌므로 순서는 행만 바꾸면 된다. 읽기 정책(0023)은 첫째·둘째 칸만 보므로 그대로다.
--
-- 다시 돌려도 깨지지 않게 쓴다.

drop policy if exists "own post write" on public.post_photos;
create policy "own post write" on public.post_photos
  for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid()))
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author = auth.uid())
    and path ~ (
      '^' || auth.uid()::text || '/' || post_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  );

/*
  글 하나를 만들거나 고친다. 사진 경로는 보여 줄 순서대로 받는다.

  security invoker 다 — 부른 사람의 RLS 를 그대로 탄다. 남의 글 id 를 주면 update 는 RLS 에
  걸려 0 행이고, 이어지는 insert 는 기본 키가 겹쳐 실패한다. 지운 내 글도 같다(되살리기 없음).
*/
create or replace function public.save_post(
  p_id uuid,
  p_body text,
  p_visibility text,
  p_match_year int,
  p_match_league_id int,
  p_match_game_id int,
  p_paths text[]
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated timestamptz;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  if coalesce(array_length(p_paths, 1), 0) > 4 then
    raise exception '사진은 4장까지입니다';
  end if;

  update public.posts
     set body = p_body,
         visibility = p_visibility,
         match_year = p_match_year,
         match_league_id = p_match_league_id,
         match_game_id = p_match_game_id
   where id = p_id and author = auth.uid() and deleted_at is null
  returning updated_at into v_updated;

  if not found then
    insert into public.posts (id, author, body, visibility, match_year, match_league_id, match_game_id)
    values (p_id, auth.uid(), p_body, p_visibility, p_match_year, p_match_league_id, p_match_game_id)
    returning updated_at into v_updated;
  end if;

  delete from public.post_photos where post_id = p_id;
  insert into public.post_photos (post_id, position, path)
  select p_id, t.ord - 1, t.path
    from unnest(coalesce(p_paths, array[]::text[])) with ordinality as t(path, ord);

  return v_updated;
end
$$;

revoke all on function public.save_post(uuid, text, text, int, int, int, text[]) from public, anon;
grant execute on function public.save_post(uuid, text, text, int, int, int, text[]) to authenticated;
```

- [ ] **Step 5: 통과를 본다**

Run: `deno task sql-check ./supabase/migrations/0023_community.sql ./supabase/migrations/0024_post_writes.sql ./supabase/tests/0024_post_writes_check.sql; git checkout -- deno.lock`
Expected: `[{"result":"OK: 0024 검증 통과"}]`

- [ ] **Step 6: 검증이 구멍을 잡는지 한 번 되돌려 본다**

`0024_post_writes.sql` 을 scratchpad 에 복사해 `where id = p_id and author = auth.uid() and deleted_at is null` 에서 `and deleted_at is null` 을 뺀 판, 경로 정규식을 `path like auth.uid()::text || '/%'` 로 느슨하게 한 판을 만들어 각각 돌린다.

Expected: 각각 `FAIL: 지운 글이 저장으로 되살아난다`(또는 지운 글 update 가 `posts_guard` 에 걸리지 않고 통과해 되살림 FAIL), `FAIL: 다른 글 폴더의 파일을 단다`. 0023 검증도 0024 를 얹어 다시 돈다:

Run: `deno task sql-check ./supabase/migrations/0023_community.sql ./supabase/migrations/0024_post_writes.sql ./supabase/tests/0023_community_check.sql; git checkout -- deno.lock`
Expected: `[{"result":"OK: 0023 검증 통과"}]`

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/0024_post_writes.sql supabase/tests/0024_post_writes_check.sql supabase/tests/run.ts
git commit -m "게시글 저장 RPC 를 두고 사진 이름을 사진마다 uuid 로 바꾼다"
```

---

### Task 2: 저장소 — 올리기·저장·지우기

**Files:**

- Modify: `src/repositories/remote/imageUpload.ts`
- Modify: `src/models/community.ts`
- Modify: `src/repositories/community/remote.ts`
- Test: `__tests__/post-save.test.ts` (새)

**Interfaces:**

- Consumes: Task 1 의 `save_post` RPC(인자 이름 `p_id`, `p_body`, `p_visibility`, `p_match_year`, `p_match_league_id`, `p_match_game_id`, `p_paths`). Task 3 의 `PostDraft`, `DraftPhoto` 타입 — **이 태스크가 먼저 도므로 타입은 Task 3 의 정의를 여기서 먼저 만든다**(아래 Step 1 에 `src/models/postDraft.ts` 의 타입 부분만 둔다. 리듀서는 Task 3)
- Produces:
  - `uploadPrivateImage(bucket, path, localUri, maxWidth, options?: { upsert?: boolean }): Promise<void>` (기본 `upsert: true` — 기존 호출은 그대로)
  - `POST_PHOTO_VERSION: string` (models/community)
  - `postPhotoPath(userId: string, postId: string, photoId: string): string`
  - `savePost(input: SavePostInput, newId?: () => string): Promise<SavedPost>`
  - `deletePost(post: Pick<Post, 'id' | 'photos'>): Promise<void>`
  - `interface SavePostInput { postId: string; userId: string; draft: PostDraft; previousPaths: string[] }`
  - `interface SavedPost { id: string; updatedAt: string; uploaded: { path: string; localUri: string }[] }`

- [ ] **Step 1: 초안 타입을 둔다**

`src/models/postDraft.ts` (Task 3 에서 리듀서를 더한다):

```ts
import type { PostMatchKey, Visibility } from '@/models/community'

/**
 * 글쓰기 초안. 새 글과 고치기가 같은 모양을 쓴다.
 *
 * 사진은 두 가지다. 막 고른 것(기기 파일)과 이미 올라가 있는 것(버킷 경로). 저장할 때 앞엣것만
 * 올린다 — 고치기에서 손대지 않은 사진을 다시 올리지 않는다.
 */

export const MAX_PHOTOS = 4
export const BODY_MAX = 1000

export type DraftPhoto =
  { kind: 'local'; key: string; uri: string } | { kind: 'remote'; key: string; path: string }

export interface PostDraft {
  photos: DraftPhoto[]
  body: string
  /** "직관 글로 쓰기" 가 켜져 있는지. 켜고 경기를 안 골랐으면 올릴 수 없다 */
  attendance: boolean
  match: PostMatchKey | null
  visibility: Visibility
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`__tests__/post-save.test.ts`:

```ts
import { deletePost, postPhotoPath, savePost } from '@/repositories/community/remote'
import type { PostDraft } from '@/models/postDraft'

const mockUpload = jest.fn()
jest.mock('@/repositories/remote/imageUpload', () => ({
  uploadPrivateImage: (...args: unknown[]) => mockUpload(...args),
}))

const mockRpc = jest.fn()
const mockRemove = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/repositories/remote/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: { from: () => ({ remove: (...args: unknown[]) => mockRemove(...args) }) },
    from: () => ({
      update: (patch: unknown) => {
        mockUpdate(patch)
        return { eq: async () => ({ error: null }) }
      },
    }),
  },
}))

const ME = 'me-uid'
const POST = 'post-id'
const draft = (over: Partial<PostDraft> = {}): PostDraft => ({
  photos: [],
  body: '  직관 다녀왔다  ',
  attendance: false,
  match: null,
  visibility: 'public',
  ...over,
})

let ids: string[]
const newId = () => ids.shift()!

beforeEach(() => {
  ids = ['n1', 'n2', 'n3']
  mockUpload.mockReset().mockResolvedValue(undefined)
  mockRpc.mockReset().mockResolvedValue({ data: '2026-09-29T00:00:00Z', error: null })
  mockRemove.mockReset().mockResolvedValue({ error: null })
  mockUpdate.mockReset()
})

describe('사진 경로', () => {
  it('사용자 폴더, 글 폴더, 사진 이름 순이다', () => {
    expect(postPhotoPath('u', 'p', 'x')).toBe('u/p/x')
  })
})

describe('글 저장', () => {
  it('새 사진만 올리고 보여 줄 순서대로 경로를 넘긴다', async () => {
    await savePost(
      {
        postId: POST,
        userId: ME,
        previousPaths: [`${ME}/${POST}/old`],
        draft: draft({
          photos: [
            { kind: 'local', key: 'a', uri: 'file:///a.jpg' },
            { kind: 'remote', key: 'old', path: `${ME}/${POST}/old` },
          ],
        }),
      },
      newId,
    )
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpload.mock.calls[0]!.slice(0, 3)).toEqual([
      'post-photos',
      `${ME}/${POST}/n1`,
      'file:///a.jpg',
    ])
    expect(mockRpc).toHaveBeenCalledWith('save_post', {
      p_id: POST,
      p_body: '직관 다녀왔다',
      p_visibility: 'public',
      p_match_year: null,
      p_match_league_id: null,
      p_match_game_id: null,
      p_paths: [`${ME}/${POST}/n1`, `${ME}/${POST}/old`],
    })
  })

  /** 새 글은 아직 글이 없어 읽기 정책을 못 넘는다. 덮어쓰기(upsert)는 읽기 정책도 요구한다 */
  it('덮어쓰기 없이 올린다', async () => {
    await savePost(
      {
        postId: POST,
        userId: ME,
        previousPaths: [],
        draft: draft({ photos: [{ kind: 'local', key: 'a', uri: 'a' }] }),
      },
      newId,
    )
    expect(mockUpload.mock.calls[0]![4]).toEqual({ upsert: false })
  })

  it('직관 글로 쓰기를 껐으면 골라 둔 경기를 보내지 않는다', async () => {
    await savePost(
      {
        postId: POST,
        userId: ME,
        previousPaths: [],
        draft: draft({ attendance: false, match: { year: 2026, leagueId: 1, gameId: 180 } }),
      },
      newId,
    )
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({ p_match_game_id: null })
  })

  it('직관 글이면 경기 키를 보낸다', async () => {
    await savePost(
      {
        postId: POST,
        userId: ME,
        previousPaths: [],
        draft: draft({ attendance: true, match: { year: 2026, leagueId: 1, gameId: 180 } }),
      },
      newId,
    )
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({
      p_match_year: 2026,
      p_match_league_id: 1,
      p_match_game_id: 180,
    })
  })

  it('저장 뒤 뺀 사진 파일을 지운다', async () => {
    await savePost({ postId: POST, userId: ME, previousPaths: [`${ME}/${POST}/gone`], draft: draft() }, newId)
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/gone`])
  })

  it('사진 하나가 실패하면 글을 만들지 않고 올라간 사진을 지운다', async () => {
    mockUpload.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('network'))
    await expect(
      savePost(
        {
          postId: POST,
          userId: ME,
          previousPaths: [],
          draft: draft({
            photos: [
              { kind: 'local', key: 'a', uri: 'a' },
              { kind: 'local', key: 'b', uri: 'b' },
            ],
          }),
        },
        newId,
      ),
    ).rejects.toThrow('network')
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/n1`])
  })

  it('글 저장이 실패하면 올라간 사진을 지운다', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('rls') })
    await expect(
      savePost(
        {
          postId: POST,
          userId: ME,
          previousPaths: [],
          draft: draft({ photos: [{ kind: 'local', key: 'a', uri: 'a' }] }),
        },
        newId,
      ),
    ).rejects.toThrow('rls')
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/n1`])
  })

  /** 글은 이미 새 사진을 가리킨다. 여기서 새 사진까지 지우면 방금 저장한 글이 깨진다 */
  it('옛 사진 정리가 실패해도 새 사진은 지우지 않는다', async () => {
    mockRemove.mockRejectedValue(new Error('storage'))
    const saved = await savePost(
      {
        postId: POST,
        userId: ME,
        previousPaths: [`${ME}/${POST}/gone`],
        draft: draft({ photos: [{ kind: 'local', key: 'a', uri: 'a' }] }),
      },
      newId,
    )
    expect(mockRemove).toHaveBeenCalledTimes(1)
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/gone`])
    expect(saved).toEqual({
      id: POST,
      updatedAt: '2026-09-29T00:00:00Z',
      uploaded: [{ path: `${ME}/${POST}/n1`, localUri: 'a' }],
    })
  })
})

describe('글 지우기', () => {
  it('지운 표시를 하고 사진 파일을 치운다', async () => {
    await deletePost({ id: POST, photos: [{ position: 0, path: `${ME}/${POST}/x` }] })
    expect(mockUpdate).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/x`])
  })

  it('사진 정리가 실패해도 지우기는 끝난다', async () => {
    mockRemove.mockRejectedValue(new Error('storage'))
    await expect(deletePost({ id: POST, photos: [{ position: 0, path: 'x' }] })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: 실패를 본다**

Run: `npx jest __tests__/post-save.test.ts`
Expected: FAIL — `savePost`, `deletePost`, `postPhotoPath` 가 없다(`is not a function`)

- [ ] **Step 4: 구현한다**

`src/repositories/remote/imageUpload.ts` 의 `uploadPrivateImage` 를 바꾼다:

```ts
/**
 * 올린다. 기본은 같은 경로를 덮어쓴다 — 원본과 누끼를 오가도 서버에는 늘 한 장이다.
 *
 * 게시글 사진은 upsert 를 끈다. 덮어쓰기는 스토리지가 읽기 정책까지 요구하는데, 새 글은 아직
 * 글이 없어 읽기 정책을 넘지 못한다. 이름이 사진마다 새 uuid 라 덮을 일도 없다.
 */
export async function uploadPrivateImage(
  bucket: string,
  path: string,
  localUri: string,
  maxWidth: number,
  options: { upsert?: boolean } = {},
): Promise<void> {
  const { bytes, contentType } = await prepare(localUri, maxWidth)
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert: options.upsert ?? true })
  if (error) throw error
}
```

`src/models/community.ts` — `PostPhoto.path` 주석을 `/** 버킷 안 경로 {uid}/{postId}/{photoId} */` 로 고치고, `POST_PHOTO_BUCKET` 아래에 더한다:

```ts
/**
 * 사진 캐시 버전. 사진 파일은 이름이 사진마다 새 uuid 이고 한 번 올리면 안 바뀐다(0024). 그래서
 * 글의 updated_at 을 버전으로 쓰지 않는다 — 그러면 본문만 고쳐도 사진을 전부 다시 받는다.
 */
export const POST_PHOTO_VERSION = 'once'
```

`src/repositories/community/remote.ts` 맨 위 import 를 바꾸고 파일 끝에 더한다:

```ts
import { randomUUID } from 'expo-crypto'

import { supabase } from '@/repositories/remote/supabase'
import { uploadPrivateImage } from '@/repositories/remote/imageUpload'
import {
  FEED_PAGE,
  type FeedCursor,
  type FeedFilter,
  type Post,
  POST_PHOTO_BUCKET,
  type Visibility,
} from '@/models/community'
import type { PostDraft } from '@/models/postDraft'
```

```ts
/** 사진 폭. 직관 사진과 같다 — 폰 화면 두 배 남짓이면 넘길 때도 뭉개지지 않는다 */
const PHOTO_WIDTH = 1600

/** 버킷 안 경로. 첫 칸은 사용자, 둘째는 글. 스토리지 정책이 이 두 칸을 본다(0023) */
export function postPhotoPath(userId: string, postId: string, photoId: string): string {
  return `${userId}/${postId}/${photoId}`
}

export interface SavePostInput {
  /** 새 글이면 화면이 미리 만든 uuid. 사진 경로에 들어가므로 글보다 먼저 정한다 */
  postId: string
  userId: string
  draft: PostDraft
  /** 고치기 전 사진 경로. 새 글이면 [] */
  previousPaths: string[]
}

export interface SavedPost {
  id: string
  updatedAt: string
  /** 이번에 올린 사진. 부르는 쪽이 기기 파일을 캐시에 넣어 다시 받지 않게 한다 */
  uploaded: { path: string; localUri: string }[]
}

/** 못 지운 파일은 남겨 둔다. 글이 가리키지 않는 파일이라 화면에 틀린 것이 나오지는 않는다 */
async function removeQuietly(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await supabase.storage.from(POST_PHOTO_BUCKET).remove(paths)
  } catch {
    // 위와 같다
  }
}

/**
 * 글을 만들거나 고친다.
 *
 * 새 사진을 먼저 올리고, 글과 사진 행은 save_post() 한 번으로 쓴다 — 반쪽 글이 피드에 보이지
 * 않는다. 사진이든 글이든 실패하면 이번에 올린 사진을 지우고 던진다. 초안은 화면이 들고 있다.
 *
 * 뺀 사진 파일은 글을 저장한 **뒤에** 지운다. 그 정리는 실패해도 던지지 않는다 — 여기서
 * 던지면 부르는 쪽이 실패로 알고, 새 사진까지 지우는 길로 빠지면 방금 저장한 글이 깨진다.
 */
export async function savePost(input: SavePostInput, newId: () => string = randomUUID): Promise<SavedPost> {
  const { postId, userId, draft, previousPaths } = input
  const uploaded: SavedPost['uploaded'] = []
  const paths: string[] = []
  let updatedAt: string

  try {
    for (const photo of draft.photos) {
      if (photo.kind === 'remote') {
        paths.push(photo.path)
        continue
      }
      const path = postPhotoPath(userId, postId, newId())
      await uploadPrivateImage(POST_PHOTO_BUCKET, path, photo.uri, PHOTO_WIDTH, { upsert: false })
      uploaded.push({ path, localUri: photo.uri })
      paths.push(path)
    }

    const match = draft.attendance ? draft.match : null
    const { data, error } = await supabase.rpc('save_post', {
      p_id: postId,
      p_body: draft.body.trim(),
      p_visibility: draft.visibility,
      p_match_year: match?.year ?? null,
      p_match_league_id: match?.leagueId ?? null,
      p_match_game_id: match?.gameId ?? null,
      p_paths: paths,
    })
    if (error) throw error
    updatedAt = data as string
  } catch (e) {
    await removeQuietly(uploaded.map(u => u.path))
    throw e
  }

  await removeQuietly(previousPaths.filter(p => !paths.includes(p)))
  return { id: postId, updatedAt, uploaded }
}

/**
 * 내 글을 지운다. 소프트 삭제다 — 지운 사람과 시각은 서버가 적는다(posts_guard).
 *
 * 사진 파일은 치운다. 지운 글의 사진은 이미 아무도 못 열지만(읽기 정책) 남겨 둘 이유가 없다.
 */
export async function deletePost(post: Pick<Post, 'id' | 'photos'>): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', post.id)
  if (error) throw error
  await removeQuietly(post.photos.map(p => p.path))
}
```

`Visibility` import 를 이미 쓰고 있으면 그대로 둔다(중복 import 금지).

- [ ] **Step 5: 통과를 본다**

Run: `npx jest __tests__/post-save.test.ts`
Expected: PASS (11개)

- [ ] **Step 6: 전체와 타입**

Run: `npx tsc --noEmit && npx jest --silent 2>&1 | tail -4`
Expected: 타입 오류 없음, 전부 통과. `community-model.test.ts` 가 `toPost` 를 import 하며 expo-crypto 를 끌어와도 jest-expo 가 받아 준다 — 깨지면 그 테스트 머리에 `jest.mock('expo-crypto', () => ({ randomUUID: () => 'id' }))` 를 둔다(Ruling 으로 적는다)

- [ ] **Step 7: 커밋**

```bash
git add src/repositories/remote/imageUpload.ts src/models/community.ts src/models/postDraft.ts src/repositories/community/remote.ts __tests__/post-save.test.ts
git commit -m "게시글을 사진 먼저 올리고 한 번에 저장한다"
```

---

### Task 3: 초안 리듀서와 여러 장 고르기

**Files:**

- Modify: `src/models/postDraft.ts`
- Modify: `src/utils/pickPhoto.ts`
- Test: `__tests__/post-draft.test.ts` (새)

**Interfaces:**

- Consumes: Task 2 가 둔 `PostDraft`, `DraftPhoto`, `MAX_PHOTOS`, `BODY_MAX`. `Post`(models/community)
- Produces:
  - `emptyDraft(match?: PostMatchKey | null): PostDraft` — match 를 주면 `attendance: true`
  - `type DraftAction` (아래)
  - `draftReducer(draft: PostDraft, action: DraftAction): PostDraft`
  - `roomForPhotos(draft: PostDraft): number`
  - `canSubmit(draft: PostDraft): boolean`
  - `draftFromPost(post: Post): PostDraft`
  - `pickManyFromLibrary(limit: number): Promise<string[] | 'denied'>` (취소하면 `[]`)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`__tests__/post-draft.test.ts`:

```ts
import * as ImagePicker from 'expo-image-picker'

import {
  BODY_MAX,
  canSubmit,
  draftFromPost,
  draftReducer,
  emptyDraft,
  type PostDraft,
  roomForPhotos,
} from '@/models/postDraft'
import type { Post } from '@/models/community'
import { pickManyFromLibrary } from '@/utils/pickPhoto'

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))
jest.mock('@six33/react-native-bg-removal', () => ({ removeBackground: jest.fn() }))

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>
const add = (d: PostDraft, ...uris: string[]) => draftReducer(d, { type: 'addPhotos', uris })
const keys = (d: PostDraft) => d.photos.map(p => p.key)

describe('사진', () => {
  it('4장을 넘기면 앞의 것만 받는다', () => {
    const d = add(emptyDraft(), 'a', 'b', 'c', 'd', 'e')
    expect(keys(d)).toEqual(['a', 'b', 'c', 'd'])
    expect(roomForPhotos(d)).toBe(0)
  })

  it('이미 있는 사진은 다시 넣지 않는다', () => {
    expect(keys(add(add(emptyDraft(), 'a'), 'a', 'b'))).toEqual(['a', 'b'])
  })

  it('빼면 자리가 난다', () => {
    const d = draftReducer(add(emptyDraft(), 'a', 'b'), { type: 'removePhoto', key: 'a' })
    expect(keys(d)).toEqual(['b'])
    expect(roomForPhotos(d)).toBe(3)
  })

  it('앞뒤로 옮긴다. 끝에서는 그대로다', () => {
    const d = add(emptyDraft(), 'a', 'b', 'c')
    expect(keys(draftReducer(d, { type: 'movePhoto', key: 'b', by: -1 }))).toEqual(['b', 'a', 'c'])
    expect(keys(draftReducer(d, { type: 'movePhoto', key: 'c', by: 1 }))).toEqual(['a', 'b', 'c'])
  })
})

describe('본문', () => {
  it('1,000자에서 자른다', () => {
    const d = draftReducer(emptyDraft(), { type: 'setBody', body: 'x'.repeat(BODY_MAX + 5) })
    expect(d.body).toHaveLength(BODY_MAX)
  })
})

describe('올릴 수 있는지', () => {
  it('공백뿐이면 안 된다', () => {
    expect(canSubmit(draftReducer(emptyDraft(), { type: 'setBody', body: '   ' }))).toBe(false)
  })

  it('직관 글인데 경기를 안 골랐으면 안 된다', () => {
    let d = draftReducer(emptyDraft(), { type: 'setBody', body: '직관' })
    d = draftReducer(d, { type: 'setAttendance', on: true })
    expect(canSubmit(d)).toBe(false)
    d = draftReducer(d, { type: 'setMatch', match: { year: 2026, leagueId: 1, gameId: 180 } })
    expect(canSubmit(d)).toBe(true)
  })

  it('경기 상세에서 들어오면 직관 글로 켜지고 경기가 골라져 있다', () => {
    expect(emptyDraft({ year: 2026, leagueId: 1, gameId: 180 })).toMatchObject({
      attendance: true,
      match: { gameId: 180 },
      visibility: 'public',
    })
  })
})

describe('고칠 글에서 초안 만들기', () => {
  it('사진·본문·경기·공개 설정을 옮긴다', () => {
    const post = {
      body: '본문',
      visibility: 'private',
      match: { year: 2026, leagueId: 1, gameId: 180 },
      photos: [
        { position: 0, path: 'u/p/a' },
        { position: 1, path: 'u/p/b' },
      ],
    } as Post
    expect(draftFromPost(post)).toEqual({
      body: '본문',
      visibility: 'private',
      attendance: true,
      match: { year: 2026, leagueId: 1, gameId: 180 },
      photos: [
        { kind: 'remote', key: 'u/p/a', path: 'u/p/a' },
        { kind: 'remote', key: 'u/p/b', path: 'u/p/b' },
      ],
    })
  })
})

describe('앨범에서 여러 장', () => {
  it('남은 자리만큼만 고르게 하고 자르지 않는다', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never)
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'a' }, { uri: 'b' }],
    } as never)
    await expect(pickManyFromLibrary(2)).resolves.toEqual(['a', 'b'])
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 2, allowsEditing: false }),
    )
  })

  it('권한이 없으면 알린다', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never)
    await expect(pickManyFromLibrary(4)).resolves.toBe('denied')
  })

  it('취소하면 빈 목록', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never)
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never)
    await expect(pickManyFromLibrary(4)).resolves.toEqual([])
  })
})
```

- [ ] **Step 2: 실패를 본다**

Run: `npx jest __tests__/post-draft.test.ts`
Expected: FAIL — `draftReducer`, `pickManyFromLibrary` 등이 없다

- [ ] **Step 3: 구현한다**

`src/models/postDraft.ts` 끝에 더한다(맨 위 import 에 `Post` 를 더한다: `import type { Post, PostMatchKey, Visibility } from '@/models/community'`):

```ts
export type DraftAction =
  | { type: 'addPhotos'; uris: string[] }
  | { type: 'removePhoto'; key: string }
  | { type: 'movePhoto'; key: string; by: -1 | 1 }
  | { type: 'setBody'; body: string }
  | { type: 'setAttendance'; on: boolean }
  | { type: 'setMatch'; match: PostMatchKey | null }
  | { type: 'setVisibility'; visibility: Visibility }
  | { type: 'reset'; draft: PostDraft }

/** 경기 상세에서 들어오면 그 경기로 직관 글이 켜져 있다 */
export function emptyDraft(match: PostMatchKey | null = null): PostDraft {
  return { photos: [], body: '', attendance: match !== null, match, visibility: 'public' }
}

export function roomForPhotos(draft: PostDraft): number {
  return MAX_PHOTOS - draft.photos.length
}

export function draftReducer(draft: PostDraft, action: DraftAction): PostDraft {
  switch (action.type) {
    case 'addPhotos': {
      // 막 고른 기기 파일은 주소가 곧 열쇠다. 같은 것을 두 번 고르면 한 장만 둔다
      const have = new Set(draft.photos.map(p => p.key))
      const fresh = action.uris
        .filter((uri, i, all) => !have.has(uri) && all.indexOf(uri) === i)
        .slice(0, roomForPhotos(draft))
        .map(uri => ({ kind: 'local' as const, key: uri, uri }))
      return { ...draft, photos: [...draft.photos, ...fresh] }
    }
    case 'removePhoto':
      return { ...draft, photos: draft.photos.filter(p => p.key !== action.key) }
    case 'movePhoto': {
      const from = draft.photos.findIndex(p => p.key === action.key)
      const to = from + action.by
      if (from < 0 || to < 0 || to >= draft.photos.length) return draft
      const photos = [...draft.photos]
      const [moved] = photos.splice(from, 1)
      photos.splice(to, 0, moved!)
      return { ...draft, photos }
    }
    case 'setBody':
      return { ...draft, body: action.body.slice(0, BODY_MAX) }
    case 'setAttendance':
      return { ...draft, attendance: action.on }
    case 'setMatch':
      return { ...draft, match: action.match }
    case 'setVisibility':
      return { ...draft, visibility: action.visibility }
    case 'reset':
      return action.draft
  }
}

/** 올릴 수 있는지. 서버의 check 와 같은 선(앞뒤 공백을 뺀 1~1,000자) */
export function canSubmit(draft: PostDraft): boolean {
  const length = draft.body.trim().length
  if (length < 1 || length > BODY_MAX) return false
  return !draft.attendance || draft.match !== null
}

/** 고칠 글을 초안으로. 이미 올라간 사진은 경로로 둔다 — 손대지 않으면 다시 올리지 않는다 */
export function draftFromPost(post: Post): PostDraft {
  return {
    photos: post.photos.map(p => ({ kind: 'remote' as const, key: p.path, path: p.path })),
    body: post.body,
    attendance: post.match !== null,
    match: post.match,
    visibility: post.visibility,
  }
}
```

`src/utils/pickPhoto.ts` 의 `takePhoto` 앞에 더한다:

```ts
/**
 * 앨범에서 여러 장 고른다. 게시글이 쓴다. 자르지 않는다 — 경기장 사진은 가로가 많다.
 *
 * 남은 자리만큼만 고르게 한다. 더 고르게 두고 뒤에서 버리면 무엇이 빠졌는지 알 수 없다.
 */
export async function pickManyFromLibrary(limit: number): Promise<string[] | 'denied'> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'denied'
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 0.9,
  })
  if (picked.canceled || !picked.assets) return []
  return picked.assets.map(a => a.uri)
}
```

- [ ] **Step 4: 통과를 본다**

Run: `npx jest __tests__/post-draft.test.ts __tests__/pick-photo.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/models/postDraft.ts src/utils/pickPhoto.ts __tests__/post-draft.test.ts
git commit -m "글쓰기 초안을 리듀서로 다루고 앨범에서 여러 장 고른다"
```

---

### Task 4: 저장·지우기 훅과 사진 한 장 훅

**Files:**

- Modify: `src/hooks/community/useCommunity.ts`
- Test: `__tests__/community-hooks.test.tsx`

**Interfaces:**

- Consumes: Task 2 의 `savePost`, `deletePost`, `SavedPost`, `POST_PHOTO_VERSION`. `adoptPrivateImage`, `dropPrivateImage`, `resolvePrivateImage`(privateImage)
- Produces:
  - `usePhotoAt(path: string | null): string | null` — 버킷 경로 하나를 캐시 파일 uri 로
  - `usePostPhoto(post, position)` 는 그대로 두되 안에서 `usePhotoAt` 을 쓴다
  - `useSavePost()` — react-query mutation. `mutateAsync({ postId, draft, previousPaths }): Promise<SavedPost>`
  - `useDeletePost()` — mutation. `mutate(post: Post)`

- [ ] **Step 1: 실패하는 테스트를 더한다**

`__tests__/community-hooks.test.tsx` 의 mock 을 넓힌다:

```ts
jest.mock('@/repositories/community/remote', () => ({
  listFeed: jest.fn(),
  getPost: jest.fn(),
  savePost: jest.fn(),
  deletePost: jest.fn(),
}))
jest.mock('@/repositories/remote/privateImage', () => ({
  resolvePrivateImage: jest.fn(async () => null),
  adoptPrivateImage: jest.fn(),
  dropPrivateImage: jest.fn(),
}))
```

`remote` 타입을 `{ listFeed: jest.Mock; savePost: jest.Mock; deletePost: jest.Mock }` 로, 그리고 `const images = jest.requireMock('@/repositories/remote/privateImage') as { resolvePrivateImage: jest.Mock; adoptPrivateImage: jest.Mock; dropPrivateImage: jest.Mock }` 를 둔다. import 에 `act` 와 `useDeletePost, usePhotoAt, useSavePost` 를 더한다. 파일 끝에:

```ts
describe('글 저장', () => {
  it('내 id 로 저장하고 올린 사진을 캐시에 넣는다', async () => {
    remote.savePost.mockResolvedValue({
      id: 'p',
      updatedAt: 't',
      uploaded: [{ path: 'me/p/n1', localUri: 'file:///a.jpg' }],
    })
    const { result } = renderHook(() => useSavePost(), { wrapper })
    const draft = { photos: [], body: 'x', attendance: false, match: null, visibility: 'public' as const }
    await act(() => result.current.mutateAsync({ postId: 'p', draft, previousPaths: [] }))
    expect(remote.savePost).toHaveBeenCalledWith({ postId: 'p', draft, previousPaths: [], userId: 'me' })
    expect(images.adoptPrivateImage).toHaveBeenCalledWith(
      { bucket: 'post-photos', path: 'me/p/n1', version: 'once' },
      'file:///a.jpg',
    )
  })

  it('로그인 전이면 저장하지 않는다', async () => {
    mockSession = null
    const { result } = renderHook(() => useSavePost(), { wrapper })
    const draft = { photos: [], body: 'x', attendance: false, match: null, visibility: 'public' as const }
    await expect(result.current.mutateAsync({ postId: 'p', draft, previousPaths: [] })).rejects.toThrow(
      '로그인이 필요합니다',
    )
    expect(remote.savePost).not.toHaveBeenCalled()
  })
})

describe('글 지우기', () => {
  it('지우고 사진 캐시를 비운다', async () => {
    remote.deletePost.mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeletePost(), { wrapper })
    const target = { ...post('p', 'me'), photos: [{ position: 0, path: 'me/p/x' }] }
    await act(() => result.current.mutateAsync(target))
    expect(remote.deletePost).toHaveBeenCalledWith(target)
    expect(images.dropPrivateImage).toHaveBeenCalledWith({ bucket: 'post-photos', path: 'me/p/x' })
  })
})

describe('사진 한 장', () => {
  /** 사진 이름은 한 번 쓰고 안 바뀐다. 글을 고칠 때마다 버전을 바꾸면 사진을 다시 받는다 */
  it('고정 버전으로 캐시를 찾는다', async () => {
    images.resolvePrivateImage.mockResolvedValue('file:///cache/x')
    const { result } = renderHook(() => usePhotoAt('me/p/x'), { wrapper })
    await waitFor(() => expect(result.current).toBe('file:///cache/x'))
    expect(images.resolvePrivateImage).toHaveBeenCalledWith({
      bucket: 'post-photos',
      path: 'me/p/x',
      version: 'once',
    })
  })
})
```

`beforeEach` 에 `remote.savePost.mockReset(); remote.deletePost.mockReset(); images.adoptPrivateImage.mockReset(); images.dropPrivateImage.mockReset()` 를 더한다.

- [ ] **Step 2: 실패를 본다**

Run: `npx jest __tests__/community-hooks.test.tsx`
Expected: FAIL — `useSavePost` 등이 없다

- [ ] **Step 3: 구현한다**

`src/hooks/community/useCommunity.ts` — import 를 넓힌다:

```ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
```

```ts
import {
  type FeedCursor,
  type FeedFilter,
  nextCursor,
  type Post,
  POST_PHOTO_BUCKET,
  POST_PHOTO_VERSION,
  withoutBlocked,
} from '@/models/community'
import type { PostDraft } from '@/models/postDraft'
import { deletePost, getPost, listFeed, savePost } from '@/repositories/community/remote'
import { adoptPrivateImage, dropPrivateImage, resolvePrivateImage } from '@/repositories/remote/privateImage'
```

`communityKeys` 에 `all: ['community'] as const,` 를 맨 앞에 더한다. `usePostPhoto` 를 바꾸고 새 훅을 더한다:

```ts
/** 버킷 경로 하나를 기기 캐시 파일로. 없거나 못 받았으면 null */
export function usePhotoAt(path: string | null): string | null {
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setUri(null)
      return
    }
    let alive = true
    void resolvePrivateImage({ bucket: POST_PHOTO_BUCKET, path, version: POST_PHOTO_VERSION }).then(next => {
      if (alive) setUri(next)
    })
    return () => {
      alive = false
    }
  }, [path])

  return uri
}

/** 글의 사진 한 장 */
export function usePostPhoto(post: Post, position: number): string | null {
  return usePhotoAt(post.photos.find(p => p.position === position)?.path ?? null)
}

/**
 * 글을 만들거나 고친다. 끝나면 커뮤니티 캐시를 통째로 새로 받는다 — 피드 세 갈래와 상세가
 * 같은 글을 들고 있어 하나만 고치면 어긋난다.
 *
 * 올린 사진은 기기 파일을 그대로 캐시에 넣는다. 방금 고른 사진을 다시 내려받지 않는다.
 */
export function useSavePost() {
  const client = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useMutation({
    mutationFn: async (input: { postId: string; draft: PostDraft; previousPaths: string[] }) => {
      if (!userId) throw new Error('로그인이 필요합니다')
      return savePost({ ...input, userId })
    },
    onSuccess: saved => {
      for (const u of saved.uploaded) {
        try {
          adoptPrivateImage(
            { bucket: POST_PHOTO_BUCKET, path: u.path, version: POST_PHOTO_VERSION },
            u.localUri,
          )
        } catch {
          // 못 넣으면 다음에 열 때 내려받는다
        }
      }
      void client.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}

/** 내 글을 지운다. 사진 캐시도 비운다 */
export function useDeletePost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (post: Post) => deletePost(post),
    onSuccess: (_, post) => {
      for (const p of post.photos) dropPrivateImage({ bucket: POST_PHOTO_BUCKET, path: p.path })
      void client.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}
```

- [ ] **Step 4: 통과를 본다**

Run: `npx jest __tests__/community-hooks.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/community/useCommunity.ts __tests__/community-hooks.test.tsx
git commit -m "게시글 저장·지우기 훅을 두고 사진 캐시를 고정 버전으로 찾는다"
```

---

### Task 5: 글쓰기·고치기 화면

**Files:**

- Create: `src/screens/PostComposerScreen.tsx`
- Modify: `src/components/community/PostCard.tsx` (`matchLine` 을 export 로)
- Modify: `src/screens/index.ts` (다른 화면처럼 내보내는 목록이 있으면 더한다)
- Test: `__tests__/post-composer.test.tsx` (새)

**Interfaces:**

- Consumes: Task 3 의 `draftReducer`, `emptyDraft`, `draftFromPost`, `canSubmit`, `roomForPhotos`, `BODY_MAX`, `MAX_PHOTOS`, `pickManyFromLibrary`. `takePhoto`(pickPhoto). Task 4 의 `useSavePost`, `usePost`, `usePhotoAt`. `useMatches`, `attendanceKeyOf`, `sameKey`. `SaveAction`(HeaderAction). `randomUUID`(expo-crypto)
- Produces:

```ts
export interface PostComposerScreenProps {
  /** 고칠 글. 없으면 새 글 */
  postId?: string
  /** 경기 상세에서 들어오면 그 경기로 직관 글이 켜져 있다 (4단계에서 쓴다) */
  match?: PostMatchKey
  /** 헤더의 [올리기]/[저장] 에 걸 것 */
  onSaveAction?: (action: SaveAction) => void
  /** 저장이 끝났다. created 는 새 글인지 */
  onDone?: (postId: string, created: boolean) => void
}
export function PostComposerScreen(props: PostComposerScreenProps): JSX.Element
export function matchLine(match: Match): string // PostCard.tsx 에서 내보낸다
```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`__tests__/post-composer.test.tsx`:

```tsx
import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { PostComposerScreen } from '@/screens/PostComposerScreen'
import type { SaveAction } from '@/components/foundation/HeaderAction'
import type { Post } from '@/models/community'

const mockSave = jest.fn()
let mockSession: { user: { id: string } } | null = { user: { id: 'me' } }
const mockPostState: { post: Post | null | undefined; blocked: boolean; query: { isPending: boolean } } = {
  post: undefined,
  blocked: false,
  query: { isPending: false },
}
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: mockSession }) }))
jest.mock('@/hooks/community/useCommunity', () => ({
  useSavePost: () => ({ mutateAsync: mockSave, isPending: false }),
  usePost: () => mockPostState,
  usePhotoAt: () => null,
}))
jest.mock('@/hooks/query/useKleague', () => ({
  useMatches: () => ({
    data: [
      {
        id: 180,
        status: 'finished',
        kickoffAtMs: Date.parse('2026-09-20T10:00:00Z'),
        home: { id: 'K03', name: '포항', goal: 2 },
        away: { id: 'K09', name: '서울', goal: 1 },
      },
      { id: 190, status: 'scheduled', kickoffAtMs: Date.parse('2099-01-01T00:00:00Z'), home: {}, away: {} },
    ],
  }),
}))
const mockPickMany = jest.fn()
jest.mock('@/utils/pickPhoto', () => ({
  pickManyFromLibrary: (n: number) => mockPickMany(n),
  takePhoto: jest.fn(async () => null),
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-id' }))

let action: SaveAction | null = null
const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
const compose = (props: Partial<React.ComponentProps<typeof PostComposerScreen>> = {}) =>
  wrap(<PostComposerScreen onSaveAction={a => (action = a)} {...props} />)

beforeEach(() => {
  action = null
  mockSession = { user: { id: 'me' } }
  mockSave.mockReset().mockResolvedValue({ id: 'new-id', updatedAt: 't', uploaded: [] })
  mockPickMany.mockReset()
  mockPostState.post = undefined
  jest.restoreAllMocks()
})

describe('새 글', () => {
  it('본문이 비면 올리기가 잠기고 쓰면 풀린다', () => {
    compose()
    expect(action?.disabled).toBe(true)
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '직관 다녀왔다')
    expect(action?.disabled).toBe(false)
  })

  it('남은 글자 수를 보여 주고 1,000자에서 막는다', () => {
    compose()
    const input = screen.getByPlaceholderText('경기장 이야기를 남겨 보세요')
    expect(input.props.maxLength).toBe(1000)
    fireEvent.changeText(input, '안녕')
    expect(screen.getByText('2/1000')).toBeTruthy()
  })

  it('앨범은 남은 자리만큼만 묻고, 4장이 차면 더 넣는 단추가 없다', async () => {
    mockPickMany.mockResolvedValueOnce(['a', 'b', 'c'])
    compose()
    await act(async () => fireEvent.press(screen.getByLabelText('앨범에서 고르기')))
    expect(mockPickMany).toHaveBeenLastCalledWith(4)
    mockPickMany.mockResolvedValueOnce(['d'])
    await act(async () => fireEvent.press(screen.getByLabelText('앨범에서 고르기')))
    expect(mockPickMany).toHaveBeenLastCalledWith(1)
    expect(screen.queryByLabelText('앨범에서 고르기')).toBeNull()
    expect(screen.queryByLabelText('사진 찍기')).toBeNull()
  })

  it('사진 권한이 없으면 안내한다', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPickMany.mockResolvedValueOnce('denied')
    compose()
    await act(async () => fireEvent.press(screen.getByLabelText('앨범에서 고르기')))
    expect(alert).toHaveBeenCalledWith('사진 접근이 필요합니다', expect.any(String))
  })

  it('직관 글을 켜면 끝난 경기만 보이고, 고르기 전에는 잠긴다', () => {
    compose()
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '직관')
    fireEvent(screen.getByLabelText('직관 글로 쓰기'), 'valueChange', true)
    expect(action?.disabled).toBe(true)
    expect(screen.queryByText(/2099|1\/1/)).toBeNull()
    fireEvent.press(screen.getByText('9/20 vs 서울 2:1 승'))
    expect(action?.disabled).toBe(false)
  })

  it('경기 상세에서 들어오면 그 경기가 골라져 있다', () => {
    compose({ match: { year: 2026, leagueId: 1, gameId: 180 } })
    expect(screen.getByLabelText('직관 글로 쓰기').props.value).toBe(true)
    expect(screen.getByLabelText('9/20 vs 서울 2:1 승, 고름')).toBeTruthy()
  })

  it('나만 보기를 켜고 올리면 그 설정으로 저장하고 끝을 알린다', async () => {
    const onDone = jest.fn()
    compose({ onDone })
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '혼자 볼 글')
    fireEvent(screen.getByLabelText('나만 보기'), 'valueChange', true)
    await act(async () => action!.onPress())
    expect(mockSave).toHaveBeenCalledWith({
      postId: 'new-id',
      previousPaths: [],
      draft: expect.objectContaining({ body: '혼자 볼 글', visibility: 'private' }),
    })
    expect(onDone).toHaveBeenCalledWith('new-id', true)
  })

  it('올리기가 실패하면 알리고 초안을 그대로 둔다', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockSave.mockRejectedValue(new Error('network'))
    const onDone = jest.fn()
    compose({ onDone })
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '남아야 할 글')
    await act(async () => action!.onPress())
    expect(alert).toHaveBeenCalledWith('올리지 못했습니다', expect.stringContaining('다시 올려'))
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('남아야 할 글')).toBeTruthy()
  })
})

describe('고치기', () => {
  const mine = {
    id: 'p1',
    authorId: 'me',
    body: '예전 글',
    visibility: 'public',
    match: null,
    photos: [{ position: 0, path: 'me/p1/a' }],
  } as unknown as Post

  it('글을 불러와 채우고, 저장하면 옛 사진 경로를 함께 넘긴다', async () => {
    mockPostState.post = mine
    const onDone = jest.fn()
    compose({ postId: 'p1', onDone })
    await waitFor(() => expect(screen.getByDisplayValue('예전 글')).toBeTruthy())
    await act(async () => action!.onPress())
    expect(mockSave).toHaveBeenCalledWith({
      postId: 'p1',
      previousPaths: ['me/p1/a'],
      draft: expect.objectContaining({ photos: [{ kind: 'remote', key: 'me/p1/a', path: 'me/p1/a' }] }),
    })
    expect(onDone).toHaveBeenCalledWith('p1', false)
  })

  it('내 글이 아니면 고칠 수 없다', () => {
    mockPostState.post = { ...mine, authorId: 'someone' } as Post
    compose({ postId: 'p1' })
    expect(screen.getByText('내 글만 고칠 수 있습니다')).toBeTruthy()
    expect(action?.disabled ?? true).toBe(true)
  })

  it('볼 수 없는 글이면 안내한다', () => {
    mockPostState.post = null
    compose({ postId: 'p1' })
    expect(screen.getByText('볼 수 없는 글입니다')).toBeTruthy()
  })
})
```

`useMatches` mock 의 경기 모양은 `src/models/kleague/index.ts` 의 `Match` 를 읽고 `opponentOf`·`outcomeOf`·`ourTeam` 이 요구하는 칸(팀 id 가 포항 id 와 맞는지 등)을 맞춘다 — 기존 `__tests__/post-card.test.tsx` 가 만든 경기 조각을 그대로 옮겨 쓰는 것이 가장 안전하다. 그러면 `'9/20 vs 서울 2:1 승'` 문구도 그 조각의 날짜·점수에 맞춰 고친다(Ruling 불필요, 테스트 조각 맞추기).

- [ ] **Step 2: 실패를 본다**

Run: `npx jest __tests__/post-composer.test.tsx`
Expected: FAIL — `Cannot find module '@/screens/PostComposerScreen'`

- [ ] **Step 3: `matchLine` 을 내보낸다**

`src/components/community/PostCard.tsx` 의 `function matchLine(match: Match): string` 앞에 `export` 를 붙이고 위에 한 줄 주석 `/** 경기 한 줄. 카드와 글쓰기의 경기 고르기가 같이 쓴다 */` 를 단다.

- [ ] **Step 4: 화면을 쓴다**

`src/screens/PostComposerScreen.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { randomUUID } from 'expo-crypto'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useAuth } from '@/hooks/auth/useAuth'
import { PressableScale } from '@/components/foundation/PressableScale'
import type { SaveAction } from '@/components/foundation/HeaderAction'
import { InlineState } from '@/components/feedback/States'
import { matchLine } from '@/components/community/PostCard'
import { usePhotoAt, usePost, useSavePost } from '@/hooks/community/useCommunity'
import { useMatches } from '@/hooks/query/useKleague'
import type { PostMatchKey } from '@/models/community'
import { attendanceKeyOf, sameKey } from '@/models/attendance'
import {
  BODY_MAX,
  canSubmit,
  type DraftPhoto,
  draftFromPost,
  draftReducer,
  emptyDraft,
  roomForPhotos,
} from '@/models/postDraft'
import { pickManyFromLibrary, takePhoto } from '@/utils/pickPhoto'

export interface PostComposerScreenProps {
  /** 고칠 글. 없으면 새 글 */
  postId?: string
  /** 경기 상세에서 들어오면 그 경기로 직관 글이 켜져 있다 */
  match?: PostMatchKey
  /** 헤더의 [올리기]/[저장] 에 걸 것 */
  onSaveAction?: (action: SaveAction) => void
  /** 저장이 끝났다. created 는 새 글인지 */
  onDone?: (postId: string, created: boolean) => void
}

const THUMB = 76

/**
 * 글쓰기와 고치기. 한 화면이다.
 *
 * 초안은 화면이 들고 있다. 올리기가 실패해도 지우지 않는다 — 사진을 다시 고르고 글을 다시
 * 쓰게 하면 안 된다. 새 글의 id 는 화면을 열 때 정한다. 사진 경로에 글 id 가 들어가서 글보다
 * 사진을 먼저 올리려면 그래야 한다.
 */
export function PostComposerScreen({ postId, match, onSaveAction, onDone }: PostComposerScreenProps) {
  const theme = useTheme()
  const { session } = useAuth()
  const me = session?.user.id ?? null
  const editing = postId !== undefined
  const [id] = useState(() => postId ?? randomUUID())
  const [draft, dispatch] = useReducer(draftReducer, match ?? null, emptyDraft)
  const save = useSavePost()

  // 고칠 글은 한 번만 채운다. 다시 불러올 때마다 채우면 쓰던 것이 날아간다
  const { post, query } = usePost(postId ?? '')
  const filled = useRef(false)
  useEffect(() => {
    if (!editing || filled.current || !post || post.authorId !== me) return
    filled.current = true
    dispatch({ type: 'reset', draft: draftFromPost(post) })
  }, [editing, me, post])

  const blockedReason = !editing
    ? null
    : query.isPending
      ? 'loading'
      : !post
        ? '볼 수 없는 글입니다'
        : post.authorId !== me
          ? '내 글만 고칠 수 있습니다'
          : null

  const submit = useCallback(async () => {
    try {
      const saved = await save.mutateAsync({
        postId: id,
        draft,
        previousPaths: editing && post ? post.photos.map(p => p.path) : [],
      })
      onDone?.(saved.id, !editing)
    } catch (e) {
      Alert.alert(
        editing ? '저장하지 못했습니다' : '올리지 못했습니다',
        `쓰던 글은 그대로 있습니다. 다시 올려 주세요.\n${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }, [draft, editing, id, onDone, post, save])

  const ready = blockedReason === null && canSubmit(draft)
  useEffect(() => {
    onSaveAction?.({ onPress: () => void submit(), busy: save.isPending, disabled: !ready })
  }, [onSaveAction, ready, save.isPending, submit])

  const addFromLibrary = useCallback(async () => {
    const picked = await pickManyFromLibrary(roomForPhotos(draft))
    if (picked === 'denied') {
      Alert.alert('사진 접근이 필요합니다', '설정에서 사진 접근을 켜면 글에 넣을 수 있습니다.')
      return
    }
    if (picked.length > 0) dispatch({ type: 'addPhotos', uris: picked })
  }, [draft])

  const addFromCamera = useCallback(async () => {
    const shot = await takePhoto()
    if (shot === 'denied') {
      Alert.alert('카메라 접근이 필요합니다', '설정에서 카메라 접근을 켜면 찍어서 넣을 수 있습니다.')
      return
    }
    if (shot) dispatch({ type: 'addPhotos', uris: [shot] })
  }, [])

  const { data: matches } = useMatches()
  // 고를 수 있는 것은 이미 시작한 경기만. 아직 안 한 경기의 직관 글은 없다
  const played = useMemo(
    () => (matches ?? []).filter(m => m.status !== 'scheduled').sort((a, b) => b.kickoffAtMs - a.kickoffAtMs),
    [matches],
  )

  if (blockedReason === 'loading') return <InlineState message="글을 불러오는 중입니다" />
  if (blockedReason) return <InlineState message={blockedReason} />

  const room = roomForPhotos(draft)

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.photos}>
        {draft.photos.map((photo, i) => (
          <DraftThumb
            key={photo.key}
            photo={photo}
            first={i === 0}
            last={i === draft.photos.length - 1}
            onRemove={() => dispatch({ type: 'removePhoto', key: photo.key })}
            onMove={by => dispatch({ type: 'movePhoto', key: photo.key, by })}
          />
        ))}
        {room > 0 && (
          <>
            <AddTile label="찍기" accessibilityLabel="사진 찍기" onPress={() => void addFromCamera()} />
            <AddTile
              label="앨범"
              accessibilityLabel="앨범에서 고르기"
              onPress={() => void addFromLibrary()}
            />
          </>
        )}
      </View>
      <Text style={[fonts.caption, { color: theme.textMuted }]}>{`사진 ${draft.photos.length}/4`}</Text>

      <TextInput
        value={draft.body}
        onChangeText={body => dispatch({ type: 'setBody', body })}
        placeholder="경기장 이야기를 남겨 보세요"
        placeholderTextColor={theme.textMuted}
        multiline
        maxLength={BODY_MAX}
        style={[
          fonts.body,
          styles.body,
          { color: theme.textPrimary, backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      />
      <Text style={[fonts.caption, styles.count, { color: theme.textMuted }]}>
        {`${draft.body.length}/${BODY_MAX}`}
      </Text>

      <Row label="직관 글로 쓰기">
        <Switch
          accessibilityLabel="직관 글로 쓰기"
          value={draft.attendance}
          onValueChange={on => dispatch({ type: 'setAttendance', on })}
        />
      </Row>
      {draft.attendance && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {played.map(m => {
            const key = attendanceKeyOf(m)
            const chosen = draft.match !== null && sameKey(draft.match, key)
            const label = matchLine(m)
            return (
              <PressableScale
                key={m.id}
                scaleTo={0.96}
                onPress={() => dispatch({ type: 'setMatch', match: key })}
                accessibilityLabel={chosen ? `${label}, 고름` : label}
                style={[
                  styles.chip,
                  { borderColor: chosen ? theme.accent : theme.border, backgroundColor: theme.surface },
                ]}
              >
                <Text style={[fonts.caption, { color: chosen ? theme.accent : theme.textSecondary }]}>
                  {label}
                </Text>
              </PressableScale>
            )
          })}
        </ScrollView>
      )}

      <Row label="나만 보기" hint="켜면 커뮤니티에 올라가지 않고 나만 봅니다">
        <Switch
          accessibilityLabel="나만 보기"
          value={draft.visibility === 'private'}
          onValueChange={on => dispatch({ type: 'setVisibility', visibility: on ? 'private' : 'public' })}
        />
      </Row>
    </ScrollView>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[fonts.label, { color: theme.textPrimary }]}>{label}</Text>
        {hint && <Text style={[fonts.caption, { color: theme.textMuted }]}>{hint}</Text>}
      </View>
      {children}
    </View>
  )
}

function AddTile({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <PressableScale
      scaleTo={0.95}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[styles.thumb, styles.add, { borderColor: theme.border }]}
    >
      <Text style={[fonts.caption, { color: theme.textSecondary }]}>{label}</Text>
    </PressableScale>
  )
}

/**
 * 초안 사진 한 장. 막 고른 것은 기기 파일을, 이미 올라간 것은 캐시 파일을 그린다.
 *
 * 순서는 끌어 옮기지 않고 앞뒤 단추로 바꾼다. 4장뿐이라 단추 두 번이면 어디든 간다.
 */
function DraftThumb({
  photo,
  first,
  last,
  onRemove,
  onMove,
}: {
  photo: DraftPhoto
  first: boolean
  last: boolean
  onRemove: () => void
  onMove: (by: -1 | 1) => void
}) {
  const theme = useTheme()
  const cached = usePhotoAt(photo.kind === 'remote' ? photo.path : null)
  const uri = photo.kind === 'local' ? photo.uri : cached
  return (
    <View style={styles.thumbWrap}>
      <View style={[styles.thumb, { backgroundColor: theme.skeleton }]}>
        {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        <PressableScale onPress={onRemove} accessibilityLabel="사진 빼기" style={styles.remove}>
          <Text style={[fonts.caption, styles.removeMark]}>✕</Text>
        </PressableScale>
      </View>
      <View style={styles.moves}>
        <PressableScale disabled={first} onPress={() => onMove(-1)} accessibilityLabel="앞으로">
          <Text style={[fonts.caption, { color: first ? theme.textDisabled : theme.textSecondary }]}>‹</Text>
        </PressableScale>
        <PressableScale disabled={last} onPress={() => onMove(1)} accessibilityLabel="뒤로">
          <Text style={[fonts.caption, { color: last ? theme.textDisabled : theme.textSecondary }]}>›</Text>
        </PressableScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['150'] },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['100'] },
  thumbWrap: { gap: spacing['050'] },
  thumb: { width: THUMB, height: THUMB, borderRadius: cornerRadius['150'], overflow: 'hidden' },
  add: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  removeMark: { color: '#fff' },
  moves: { flexDirection: 'row', justifyContent: 'space-around' },
  body: {
    minHeight: 160,
    padding: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
    textAlignVertical: 'top',
  },
  count: { alignSelf: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'] },
  rowText: { flex: 1, gap: spacing['025'] },
  chips: { gap: spacing['100'] },
  chip: {
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['100'],
    borderRadius: cornerRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
```

`cornerRadius['150']`, `spacing['025']`, `theme.textDisabled`, `theme.skeleton` 이 없으면 `src/styles` 에 있는 가장 가까운 값으로 바꾼다(`grep -n "'150'\|'025'" src/styles/radius src/styles/space`). `'#fff'` 는 `palette.white` 가 있으면 그것을 쓴다(PostCard 가 쓴다). `React.ReactNode` 는 `import type { ReactNode } from 'react'` 로 바꿔도 된다 — 파일 규칙(주변 코드)을 따른다.

`usePost('')` 는 새 글일 때 쓸모없는 질의를 한 번 한다. `usePost` 에 `enabled` 를 넘길 길이 없으면 `src/hooks/community/useCommunity.ts` 의 `usePost(id: string)` 에 `enabled: id !== ''` 를 더한다(새 글이면 묻지 않는다). 이때 `query.isPending` 은 새 글에서 true 로 남지만 `editing` 이 거짓이라 쓰지 않는다.

- [ ] **Step 5: 통과를 본다**

Run: `npx jest __tests__/post-composer.test.tsx`
Expected: PASS (11개)

- [ ] **Step 6: 전체**

Run: `npx tsc --noEmit && npm run lint && npx jest --silent 2>&1 | tail -4`
Expected: 모두 통과

- [ ] **Step 7: 커밋**

```bash
git add src/screens/PostComposerScreen.tsx src/components/community/PostCard.tsx src/hooks/community/useCommunity.ts src/screens/index.ts __tests__/post-composer.test.tsx
git commit -m "글쓰기·고치기 화면을 둔다"
```

---

### Task 6: 연결 — 글쓰기 단추, 라우트, 내 글 수정·삭제

**Files:**

- Create: `src/components/foundation/MoreDots.tsx`
- Create: `src/components/community/PostOwnerMenu.tsx`
- Create: `src/navigation/routes/community.tsx`
- Modify: `src/components/community/PostCard.tsx`
- Modify: `src/screens/CommunityScreen.tsx`
- Modify: `src/screens/PostDetailScreen.tsx`
- Modify: `src/navigation/types.ts`, `src/navigation/detailScreens.tsx`, `src/navigation/routes/detail.tsx`, `src/navigation/tabs.tsx`
- Test: `__tests__/community-screens.test.tsx`, `__tests__/post-card.test.tsx`, `__tests__/navigation.test.tsx`

**Interfaces:**

- Consumes: Task 4 의 `useDeletePost`. Task 5 의 `PostComposerScreen`. `DropdownMenu`, `MenuAnchor`, `HeaderAction`, `SaveAction`, `useRequireSession`, `useAuth`, `useTabBarHeight`
- Produces:
  - `DetailParamList.PostComposer: { postId?: string; match?: PostMatchKey }`
  - `MoreDots({ onPress: (anchor: MenuAnchor) => void, accessibilityLabel?: string })`
  - `PostOwnerMenu({ post, onEdit, onDelete }: { post: Post; onEdit: (post: Post) => void; onDelete: (post: Post) => void })` — 누르면 ⋮ 차림표 [수정, 삭제]. 삭제는 한 번 묻는다
  - `PostCardProps` 에 `mine?: boolean; onEdit?: (post: Post) => void; onDelete?: (post: Post) => void`
  - `CommunityScreenProps` 에 `onCompose?: () => void; onEditPost?: (post: Post) => void`
  - `PostDetailScreenProps` 에 `onEdit?: (post: Post) => void; onDeleted?: () => void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`__tests__/post-card.test.tsx` 끝에 더한다(파일의 기존 `post`·`wrap` 도우미 이름을 따른다):

```tsx
describe('내 글 차림표', () => {
  it('내 글이면 ⋮ 가 있고 수정을 누르면 알린다', async () => {
    const onEdit = jest.fn()
    wrap(<PostCard post={post} mine onEdit={onEdit} onDelete={jest.fn()} />)
    fireEvent.press(screen.getByLabelText('글 더보기'))
    fireEvent.press(await screen.findByText('수정'))
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(post))
  })

  it('삭제는 한 번 묻고 지운다', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.style === 'destructive')?.onPress?.()
    })
    const onDelete = jest.fn()
    wrap(<PostCard post={post} mine onEdit={jest.fn()} onDelete={onDelete} />)
    fireEvent.press(screen.getByLabelText('글 더보기'))
    fireEvent.press(await screen.findByText('삭제'))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(post))
    expect(alert).toHaveBeenCalledWith('글을 지울까요?', expect.any(String), expect.any(Array))
    alert.mockRestore()
  })

  it('남의 글에는 ⋮ 가 없다 (신고·차단은 3단계)', () => {
    wrap(<PostCard post={post} />)
    expect(screen.queryByLabelText('글 더보기')).toBeNull()
  })
})
```

`DropdownMenu` 가 고른 일을 `LEAVE_MS`(450ms) 뒤에 부르므로 `waitFor` 의 기본 1초 안에 들어온다. 안 들어오면 `jest.useFakeTimers()` 와 `act(() => jest.advanceTimersByTime(500))` 로 바꾼다.

`__tests__/community-screens.test.tsx` — mock 에 `useDeletePost: () => ({ mutate: mockDelete })` 와 `jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: { user: { id: 'u' } } }) }))` 를 더하고(`const mockDelete = jest.fn()`), 끝에:

```tsx
describe('글쓰기와 내 글', () => {
  it('글쓰기 단추를 누르면 알린다', () => {
    const onCompose = jest.fn()
    wrap(<CommunityScreen onCompose={onCompose} />)
    fireEvent.press(screen.getByLabelText('글쓰기'))
    expect(onCompose).toHaveBeenCalled()
  })

  /** 피드의 글쓴이가 나(u)면 차림표가 뜬다 */
  it('피드의 내 글에 ⋮ 가 있다', () => {
    wrap(<CommunityScreen />)
    expect(screen.getByLabelText('글 더보기')).toBeTruthy()
  })

  it('상세의 내 글에도 ⋮ 가 있다', () => {
    mockPostState.post = { ...p('9', '상세 본문'), authorId: 'u' }
    wrap(<PostDetailScreen postId="9" />)
    expect(screen.getByLabelText('글 더보기')).toBeTruthy()
  })
})
```

`__tests__/navigation.test.tsx` — 파일이 라우트 이름 목록이나 `detailScreens` 등록을 확인하는 곳이 있으면 거기에 `PostComposer` 를 더한다. 없으면 이 파일은 건드리지 않는다.

- [ ] **Step 2: 실패를 본다**

Run: `npx jest __tests__/post-card.test.tsx __tests__/community-screens.test.tsx`
Expected: FAIL — `글 더보기`, `글쓰기` 를 못 찾는다

- [ ] **Step 3: ⋮ 단추와 내 글 차림표**

`src/components/foundation/MoreDots.tsx`:

```tsx
import { useRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import type { MenuAnchor } from '@/components/foundation/DropdownMenu'

/**
 * 세로 점 셋 단추. 누르면 제 자리를 재서 알린다 — 차림표가 그 자리에 붙어 뜬다.
 *
 * 점은 글자(⋮)가 아니라 직접 그린다. K리그 서체 두 벌 모두 그 글자가 없다(댓글 목록과 같은 이유).
 */
export function MoreDots({
  onPress,
  accessibilityLabel = '더보기',
}: {
  onPress: (anchor: MenuAnchor) => void
  accessibilityLabel?: string
}) {
  const theme = useTheme()
  const slot = useRef<View>(null)
  const open = () => slot.current?.measureInWindow((x, y, width, height) => onPress({ x, y, width, height }))
  return (
    <View ref={slot} collapsable={false}>
      <PressableScale scaleTo={0.9} onPress={open} accessibilityLabel={accessibilityLabel} style={styles.hit}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, { backgroundColor: theme.textMuted }]} />
        ))}
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  /** 점이 작아 누를 자리가 좁다. 눌리는 넓이를 따로 준다 */
  hit: { alignItems: 'center', gap: 2, paddingHorizontal: spacing['150'], paddingVertical: spacing['100'] },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
})
```

jest 에서 `measureInWindow` 가 콜백을 안 부르면 차림표가 안 뜬다. 그렇다면 `open` 을 `slot.current?.measureInWindow ? … : onPress({ x: 0, y: 0, width: 0, height: 0 })` 로 두지 말고, 테스트 머리에서 `View.prototype.measureInWindow` 를 흉내 낸다(기존 댓글 테스트가 어떻게 했는지 `grep -rn measureInWindow __tests__` 로 보고 같은 방법을 쓴다).

`src/components/community/PostOwnerMenu.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Alert } from 'react-native'

import { DropdownMenu, type MenuAnchor, type MenuItem } from '@/components/foundation/DropdownMenu'
import { MoreDots } from '@/components/foundation/MoreDots'
import type { Post } from '@/models/community'

/**
 * 내 글 ⋮ → 수정·삭제. 남의 글 ⋮(신고·차단)는 3단계에서 붙인다.
 *
 * 삭제는 한 번 묻는다. 되살리기가 없다(0023 posts_guard).
 */
export function PostOwnerMenu({
  post,
  onEdit,
  onDelete,
}: {
  post: Post
  onEdit: (post: Post) => void
  onDelete: (post: Post) => void
}) {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)
  const items = useMemo<MenuItem[]>(
    () => [
      { label: '수정', onPress: () => onEdit(post) },
      {
        label: '삭제',
        destructive: true,
        onPress: () =>
          Alert.alert('글을 지울까요?', '지운 글은 되살릴 수 없습니다.', [
            { text: '취소', style: 'cancel' },
            { text: '지우기', style: 'destructive', onPress: () => onDelete(post) },
          ]),
      },
    ],
    [onDelete, onEdit, post],
  )
  return (
    <>
      <MoreDots onPress={setAnchor} accessibilityLabel="글 더보기" />
      <DropdownMenu anchor={anchor} items={items} onClose={() => setAnchor(null)} />
    </>
  )
}
```

- [ ] **Step 4: 카드와 두 화면에 붙인다**

`src/components/community/PostCard.tsx` — props 에 더한다:

```ts
  /** 내 글이면 ⋮ 로 수정·삭제 */
  mine?: boolean
  onEdit?: (post: Post) => void
  onDelete?: (post: Post) => void
```

함수 인자에 `mine = false, onEdit, onDelete` 를 더하고, 윗줄의 자물쇠 뒤에:

```tsx
{
  mine && onEdit && onDelete && <PostOwnerMenu post={post} onEdit={onEdit} onDelete={onDelete} />
}
```

`src/screens/CommunityScreen.tsx`:

- props 에 `onCompose?: () => void`, `onEditPost?: (post: Post) => void` 를 더한다
- `const { session } = useAuth()` 로 `me` 를 얻고, `const remove = useDeletePost()`
- `renderItem` 의 `PostCard` 에 `mine={item.authorId === me}`, `onEdit={onEditPost}`, `onDelete={p => remove.mutate(p, { onError: e => Alert.alert('지우지 못했습니다', e instanceof Error ? e.message : String(e)) })}`
- 목록 아래(같은 `View` 안, `FlatList` 뒤)에 떠 있는 단추. 탭바에 가리지 않게 `useTabBarHeight()` 만큼 띄운다:

```tsx
{
  onCompose && (
    <PressableScale
      scaleTo={0.94}
      onPress={onCompose}
      accessibilityRole="button"
      accessibilityLabel="글쓰기"
      style={[styles.fab, { backgroundColor: theme.main, bottom: tabBar + spacing['200'] }]}
    >
      <Text style={[fonts.headline, { color: theme.textOnMain }]}>글쓰기</Text>
    </PressableScale>
  )
}
```

styles 에 `fab: { position: 'absolute', right: spacing['200'], paddingHorizontal: spacing['250'], paddingVertical: spacing['150'], borderRadius: cornerRadius.full }` 를 더하고, `content` 의 아래 여백을 단추가 마지막 카드를 가리지 않도록 `paddingBottom: spacing['800']` 정도로 늘린다(없는 토큰이면 가장 가까운 것). `useTabBarHeight` 가 탭 밖(테스트)에서 0 을 주는지 확인한다 — Provider 없이 부르면 던지면 테스트 mock 에 `jest.mock('@/navigation/tabBarHeight', () => ({ useTabBarHeight: () => 0 }))` 를 더한다

`src/screens/PostDetailScreen.tsx`:

- props 에 `onEdit?: (post: Post) => void`, `onDeleted?: () => void`
- `me`, `remove = useDeletePost()` 를 두고, `meta` 줄 끝에 `{post.authorId === me && onEdit && (<View style={styles.menuSlot}><PostOwnerMenu post={post} onEdit={onEdit} onDelete={p => remove.mutate(p, { onSuccess: () => onDeleted?.(), onError: … })} /></View>)}` — `menuSlot: { marginLeft: 'auto' }`
- 테스트가 `onEdit` 없이 ⋮ 를 찾으므로, 조건은 `post.authorId === me` 만 보고 `onEdit` 이 없으면 빈 함수를 넘긴다: `onEdit={onEdit ?? (() => {})}`. PostCard 도 같은 이유로 테스트에서 `onEdit`·`onDelete` 를 준다

- [ ] **Step 5: 라우트**

`src/navigation/types.ts` — `import type { PostMatchKey } from '@/models/community'` 를 더하고 `Post` 아래에:

```ts
  /** 글쓰기·고치기. postId 가 있으면 고치기, match 가 있으면 그 경기의 직관 글 */
  PostComposer: { postId?: string; match?: PostMatchKey }
```

`src/navigation/routes/community.tsx`:

```tsx
import { useCallback, useLayoutEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'

import { HeaderAction, type SaveAction } from '@/components/foundation/HeaderAction'
import { useRequireSession } from '@/hooks/auth/useRequireSession'
import { PostComposerScreen } from '@/screens/PostComposerScreen'
import type { PostMatchKey } from '@/models/community'
import type { DetailNavigation } from '../types'

/**
 * 글쓰기·고치기. 올리기는 헤더 오른쪽에 건다 — 카드 만들기의 저장과 같은 자리다.
 *
 * 새 글을 올리면 그 글 상세로 바꿔 연다. 나만 보기 글은 피드에 안 나오므로 돌아가기만 하면
 * 방금 쓴 글이 어디 갔는지 알 수 없다. 고치기는 온 자리로 돌아간다.
 */
export function PostComposerRoute({ postId, match }: { postId?: string; match?: PostMatchKey }) {
  useRequireSession()
  const navigation = useNavigation<DetailNavigation>()
  const [action, setAction] = useState<SaveAction | null>(null)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (action ? <HeaderAction label={postId ? '저장' : '올리기'} {...action} /> : null),
    })
  }, [navigation, action, postId])
  const onDone = useCallback(
    (id: string, created: boolean) => {
      if (created) navigation.replace('Post', { postId: id })
      else navigation.goBack()
    },
    [navigation],
  )
  return <PostComposerScreen postId={postId} match={match} onSaveAction={setAction} onDone={onDone} />
}
```

`src/navigation/detailScreens.tsx` — import 에 `PostComposerRoute` 를 더하고 `Post` 등록 뒤에:

```tsx
<Stack.Screen
  name="PostComposer"
  options={({ route }: any) => ({ title: route.params?.postId ? '글 고치기' : '글쓰기' })}
  children={({ route }: any) => (
    <ScreenBoundary>
      <PostComposerRoute postId={route.params?.postId} match={route.params?.match} />
    </ScreenBoundary>
  )}
/>
```

`src/navigation/routes/detail.tsx` 의 `PostRoute`:

```tsx
export function PostRoute({ postId }: { postId: string }) {
  const navigation = useNavigation<DetailNavigation>()
  const requireLogin = useCallback(() => navigation.navigate('Login'), [navigation])
  const edit = useCallback(
    (post: Post) => navigation.navigate('PostComposer', { postId: post.id }),
    [navigation],
  )
  const deleted = useCallback(() => navigation.goBack(), [navigation])
  return <PostDetailScreen postId={postId} onRequireLogin={requireLogin} onEdit={edit} onDeleted={deleted} />
}
```

(`import type { Post } from '@/models/community'` 를 더한다.)

`src/navigation/tabs.tsx` 의 `MediaMain`:

```tsx
function MediaMain() {
  const navigation = useNavigation<DetailNavigation>()
  const { session } = useAuth()
  const openPost = useCallback((post: Post) => navigation.navigate('Post', { postId: post.id }), [navigation])
  // 비로그인이면 로그인부터. 로그인하고 돌아오면 다시 누르면 된다
  const compose = useCallback(
    () => (session ? navigation.navigate('PostComposer', {}) : navigation.navigate('Login')),
    [navigation, session],
  )
  const edit = useCallback(
    (post: Post) => navigation.navigate('PostComposer', { postId: post.id }),
    [navigation],
  )
  return (
    <CommunityScreen
      onOpenPost={openPost}
      onOpenMatch={useOpenMatch()}
      onCompose={compose}
      onEditPost={edit}
    />
  )
}
```

(`useAuth` import 가 없으면 더한다.)

- [ ] **Step 6: 통과를 본다**

Run: `npx jest __tests__/post-card.test.tsx __tests__/community-screens.test.tsx __tests__/navigation.test.tsx`
Expected: PASS

- [ ] **Step 7: 전체**

Run: `npx tsc --noEmit && npm run lint && npx jest --silent 2>&1 | tail -4`
Expected: 모두 통과

- [ ] **Step 8: 커밋**

```bash
git add src/components/foundation/MoreDots.tsx src/components/community/PostOwnerMenu.tsx src/components/community/PostCard.tsx src/screens/CommunityScreen.tsx src/screens/PostDetailScreen.tsx src/navigation __tests__/post-card.test.tsx __tests__/community-screens.test.tsx __tests__/navigation.test.tsx
git commit -m "커뮤니티에 글쓰기 단추와 내 글 수정·삭제를 붙인다"
```

---

### Task 7: 개인정보 방침

**Files:**

- Modify: `docs/privacy.md`

**Interfaces:** 없음

- [ ] **Step 1: 고친다** — 스펙의 "개인정보 방침" 절 그대로

1-2 표, "댓글 내용과 작성 시각" 줄 아래에:

```md
| 게시글(사진·본문·직관 경기)과 작성 시각 | 전체 공개면 다른 이용자에게 공개, 나만 보기면 **본인만** |
```

1-3 의 기기 사본 줄에 "게시글 사진" 을 더한다: `- 본인의 팬카드 사진, 직접 넣은 선수 사진, 직관 사진, 열어 본 게시글 사진의 사본(…)`.

2절 표: 모든 이용자 줄을 `닉네임, 아이디, 프로필 이미지, 댓글, 전체 공개 게시글` 로, 본인만 줄에 `나만 보기 게시글` 을 더한다. 이미지 안내 문단(2절 아래 "…본인만 열 수 있는 보관소에 두며…")에 한 문장을 더한다: `게시글 사진은 글이 전체 공개일 때만 다른 사람이 열 수 있고, 나만 보기로 바꾸면 곧바로 본인만 열 수 있습니다.`

5절 표에 `| 게시글 고치기·지우기, 공개 설정 바꾸기 | 글 오른쪽 ⋮ → 수정 / 삭제 |` 를 더한다. 표 칸 폭은 prettier 가 맞춘다.

- [ ] **Step 2: 확인과 커밋**

Run: `npx prettier --check docs/privacy.md || npx prettier --write docs/privacy.md`

```bash
git add docs/privacy.md
git commit -m "개인정보 방침에 게시글을 넣는다"
```

---

### Task 8: 적용과 실측 (사용자와 함께)

- [ ] **Step 1**: `npx tsc --noEmit && npm run lint && npx jest --silent` 전부 통과. `deno task sql-check ./supabase/migrations/0023_community.sql ./supabase/migrations/0024_post_writes.sql ./supabase/tests/0024_post_writes_check.sql` 통과 뒤 `git checkout -- deno.lock`
- [ ] **Step 2**: 사용자에게 0024 를 SQL Editor 에서 돌려 달라고 청한다 (`pbcopy < supabase/migrations/0024_post_writes.sql` 로 복사해 두고 알린다). 답을 받기 전에는 넘어가지 않는다
- [ ] **Step 3**: 이어서 검증 스크립트를 청한다 (`pbcopy < supabase/tests/0024_post_writes_check.sql`). 마지막 줄이 `OK: 0024 검증 통과` 여야 한다
- [ ] **Step 4**: 로그인 없이 막히는지 본다

```bash
cd steelers-app && set -a && . ./.env && set +a
curl -s -X POST -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" -H "Content-Type: application/json" \
  "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/rpc/save_post" \
  -d '{"p_id":"00000000-0000-4000-8000-000000000001","p_body":"x","p_visibility":"public","p_match_year":null,"p_match_league_id":null,"p_match_game_id":null,"p_paths":[]}'
```

Expected: `permission denied for function save_post` (42501)

- [ ] **Step 5**: 폰에 설치한다. 네이티브 설정은 바뀌지 않았으므로 prebuild 없이

Run: `cd steelers-app && cat ios/.xcode.env.local && npx expo run:ios --configuration Release --device 00008130-001225AC01F2001C`
Expected: 빌드 성공

- [ ] **Step 6**: 사용자에게 확인을 청한다
  1. 커뮤니티 오른쪽 아래 `[글쓰기]` → 사진 2장(앨범 여러 장 + 찍기 1장) 과 본문으로 올리면 그 글 상세가 열리고 사진이 보인다 (Review Focus 1)
  2. 뒤로 가면 피드 맨 위에 그 글, "+1"
  3. ⋮ → 수정 → 사진 순서 바꾸기·한 장 빼기·본문 고치기 → 저장. 상세와 피드에 반영
  4. ⋮ → 수정 → 나만 보기 켜고 저장 → 피드에서 빠지고 상세에 자물쇠
  5. 직관 글로 쓰기를 켜고 경기를 고르면 카드에 경기 줄. `직관` 거르개에 나온다
  6. ⋮ → 삭제 → 한 번 묻고 지우면 피드에서 빠진다
  7. 로그아웃 상태에서 `[글쓰기]` 를 누르면 로그인 화면

폰에서 만든 글은 시험 데이터다 — 메모리 `ask-before-app-review-cleanup` 목록에 적어 둔다(지우지 않는다).

---

## 스펙 대비 메모

- 좋아요 누르기, 남의 글 ⋮(신고·차단), 신고함·신고 메일 확장은 3단계다. 2단계의 ⋮ 는 내 글에만 뜬다
- 경기 상세의 `[직관 글 쓰기]` 와 직관 기록 피드는 4단계다. 그 입구가 쓸 `PostComposer` 의 `match` 파라미터와 `emptyDraft(match)` 는 여기서 만들어 둔다
- 쓰던 글을 두고 뒤로 가면 초안이 사라진다. 스펙에 없어 2단계에서는 막지 않는다(묻기 창을 띄우려면 `beforeRemove` 를 건다 — 필요하면 따로)
- 1단계에서 미룬 M6(내 나만 보기 글에 댓글 입력 없음)은 그대로다

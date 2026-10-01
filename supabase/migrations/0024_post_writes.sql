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

-- 내 폴더의 사진은 내가 읽는다. 스토리지의 remove 는 delete 와 함께 select 정책도 요구하는데,
-- 글을 만들기 전에는 글을 따르는 읽기 정책(0023)이 거짓이다. 이것이 없으면 올리기가 중간에
-- 실패했을 때 먼저 올라간 사진을 지우지 못해 버킷에 남는다. 내 파일을 내가 보는 것이라 새로
-- 열리는 것은 없다
drop policy if exists "post-photos own folder read" on storage.objects;
create policy "post-photos own folder read" on storage.objects
  for select to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

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

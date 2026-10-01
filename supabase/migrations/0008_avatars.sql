-- ─────────────────────────────────────────── 프로필 이미지 저장소
--
-- 공개 버킷이다. 프로필 이미지는 커뮤니티에서 로그인하지 않은 사람에게도 보여야
-- 하므로, 서명 URL 을 매번 발급하는 것보다 공개로 두고 주소를 그대로 쓰는 쪽이 낫다.
-- 대신 **올리고 지우는 것은 본인 폴더만** 으로 막는다.
--
-- 경로 규칙: avatars/<auth.uid()>/<시각>.jpg
--   맨 앞 칸이 사용자 id 라서, 정책이 그 칸만 보면 주인을 가릴 수 있다.
--   파일 이름에 시각을 넣는 이유는 CDN 이다 — 같은 이름으로 덮으면 예전 이미지가
--   한동안 그대로 보인다. 새 이름으로 올리고 옛 파일은 앱이 지운다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,                                  -- 2MB. 앱이 512px 로 줄여 올린다
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 읽기는 누구나. 공개 버킷이라 정책 없이도 CDN 으로 나가지만, storage.objects 를
-- 직접 조회하는 경로도 함께 열어 둔다
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

-- 올리고 바꾸고 지우는 것은 본인 폴더만.
-- storage.foldername(name) 의 첫 칸이 사용자 id 여야 한다
drop policy if exists "avatars self insert" on storage.objects;
create policy "avatars self insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars self update" on storage.objects;
create policy "avatars self update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars self delete" on storage.objects;
create policy "avatars self delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

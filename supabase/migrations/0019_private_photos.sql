-- ─────────────────────────────────────────── 사진을 본인만 연다
--
-- 선수 사진은 앱이 K리그에서 받아 공개 버킷(player-photos)으로 재배포하던 것을 그만두고
-- 사용자가 자기 앨범에서 채워 본인만 본다. 팬카드 사진도 표는 본인만 읽는데 파일은 공개
-- 버킷에 있어, 주소를 아는 사람은 로그인 없이 열 수 있었다. 얼굴이 들어가는 물건이다.
--
-- 앱은 서명 주소로 한 번 내려받아 기기 캐시에 둔다(privateImage.ts). 그래서 공개 주소가
-- 필요 없다.
--
-- 다시 돌려도 깨지지 않게 쓴다.

-- ── 선수 사진 ─────────────────────────────────
-- 경로는 {uid}/{playerId}. 표를 두지 않는다 — 내 폴더를 나열하면 누구 사진이 있는지와
-- 언제 바뀌었는지(updated_at)가 같이 온다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('my-player-photos', 'my-player-photos', false, 5 * 1024 * 1024, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "my-player-photos self read" on storage.objects;
create policy "my-player-photos self read" on storage.objects
  for select to authenticated
  using (bucket_id = 'my-player-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-player-photos self insert" on storage.objects;
create policy "my-player-photos self insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'my-player-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-player-photos self update" on storage.objects;
create policy "my-player-photos self update" on storage.objects
  for update to authenticated
  using (bucket_id = 'my-player-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-player-photos self delete" on storage.objects;
create policy "my-player-photos self delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'my-player-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 팬카드 ────────────────────────────────────
-- 쓰기·지우기 정책은 0009 의 본인 폴더 정책을 그대로 쓴다. 읽기만 바꾼다.

update storage.buckets
  set public = false,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'fan-cards';

drop policy if exists "fan-cards public read" on storage.objects;
drop policy if exists "fan-cards self read" on storage.objects;
create policy "fan-cards self read" on storage.objects
  for select to authenticated
  using (bucket_id = 'fan-cards' and (storage.foldername(name))[1] = auth.uid()::text);

-- 공개 주소를 담던 칸을 버킷 안 경로로 바꾼다. 주소는 이제 열리지 않는다
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fan_cards' and column_name = 'photo_url'
  ) then
    alter table public.fan_cards rename column photo_url to photo_path;
  end if;
end $$;

update public.fan_cards
  set photo_path = substring(photo_path from '/object/public/fan-cards/([^?]+)')
  where photo_path like 'http%';

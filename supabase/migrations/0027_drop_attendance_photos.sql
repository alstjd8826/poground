-- ─────────────────────────────────────────── 옛 직관 사진 걷어내기
--
-- 직관 사진은 커뮤니티 글로 옮겨 갔다(2026-09-29). 남은 사진은 0장이라 옮길 것 없이 칸과 스토리지 정책을
-- 지운다. 버킷(my-attendance-photos)은 대시보드에서 지운다 — 스토리지 표를 SQL 로 건드리지 않는다.
--
-- 새 앱(이 칸을 부르지 않는 빌드)을 깐 뒤에 돌린다. 옛 앱이 이 칸을 select 하면 직관 기록 질의가 통째로
-- 깨진다.
--
-- 다시 돌려도 깨지지 않게 쓴다.

alter table public.attendances drop column if exists photo_path;

drop policy if exists "my-attendance-photos self read" on storage.objects;
drop policy if exists "my-attendance-photos self insert" on storage.objects;
drop policy if exists "my-attendance-photos self update" on storage.objects;
drop policy if exists "my-attendance-photos self delete" on storage.objects;

-- ─────────────────────────────────────────── 운영자 이름 잠금
--
-- 운영자 계정은 아이디·닉네임을 앱에서 바꾸지 못한다(2026-09-29 결정). 신고 처리·관리자 삭제에 운영자
-- 이름이 걸리므로 그 이름이 흔들리면 안 된다. 앱도 막지만(내 계정 화면) 앱을 거치지 않은 요청도 막도록
-- DB 가 지킨다.
--
-- SQL Editor 처럼 로그인 없이 하는 운영 작업에서는 auth.uid() 가 비어 is_admin() 이 거짓이므로 바꿀
-- 수 있다 — 이름을 고칠 일이 생기면 거기서 한다. 프로필 사진은 막지 않는다.
--
-- 다시 돌려도 깨지지 않게 쓴다.

create or replace function public.profiles_admin_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin()
     and (new.handle is distinct from old.handle or new.nickname is distinct from old.nickname) then
    raise exception '운영자 계정은 아이디와 닉네임을 바꿀 수 없습니다';
  end if;
  return new;
end
$$;

drop trigger if exists profiles_admin_lock on public.profiles;
create trigger profiles_admin_lock
  before update on public.profiles
  for each row execute function public.profiles_admin_lock();

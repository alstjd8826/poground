-- ─────────────────────────────────────────── 아이디(handle)
--
-- 닉네임과 따로 둔다. 닉네임은 보여주는 이름이라 겹쳐도 되고 한글도 되지만,
-- handle 은 @로 가리키는 이름이라 유일해야 하고 글자도 좁혀야 한다.
--
-- 규칙은 인스타그램·X·깃허브에서 겹치는 관행을 따랐다.
--   소문자 + 숫자 + 밑줄, 3~20자, 글자로 시작, 밑줄로 끝나지 않고 연속되지 않음
--
-- 마침표는 **일부러 뺐다.** 인스타그램은 허용하지만 "@steelers. 안녕" 처럼 문장 끝
-- 마침표와 구분이 안 된다. 커뮤니티에서 @로 사람을 가리킬 계획이라 파싱이 흔들리는
-- 문자는 처음부터 넣지 않는다.
--
-- 대소문자는 저장 단계에서 소문자로 눕힌다. citext 를 쓰지 않는 이유는, 확장에
-- 기대지 않고도 "항상 소문자" 규칙 하나로 유일성이 정리되기 때문이다.
--
-- 규칙이 여기와 src/utils/handle.ts 두 군데에 있다. 한쪽만 고치면 조용히 어긋나서
-- 앱이 통과시킨 값이 저장될 때 거부당한다. 같이 고쳐야 한다.

-- 이미 가입한 사람이 있으므로 세 걸음으로 나눈다. 처음부터 not null 로 붙이면
-- 기존 행에 채울 값이 없어 거부된다 (23502)
alter table public.profiles add column if not exists handle text;

-- 기존 행은 uuid 앞자리로 채운다. 16진수라 전부 허용 문자이고, 우리 규모에서는
-- 앞 8자리만으로도 겹치지 않는다. 겹치면 아래 유일 인덱스가 잡는다
update public.profiles
set handle = 'fan_' || substr(replace(id::text, '-', ''), 1, 8)
where handle is null;

alter table public.profiles alter column handle set not null;

create unique index if not exists profiles_handle_key on public.profiles (handle);

alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles
  add constraint profiles_handle_format
  check (handle ~ '^[a-z][a-z0-9_]{1,18}[a-z0-9]$');

-- 밑줄이 연달아 붙으면 눈으로 개수를 셀 수 없다
alter table public.profiles drop constraint if exists profiles_handle_no_run;
alter table public.profiles
  add constraint profiles_handle_no_run
  check (handle !~ '__');

-- 남이 못 쓰게 막을 이름은 앱에서 목록으로 관리한다 (src/utils/handle.ts).
-- 여기에 IN 목록을 박으면 이름을 하나 더할 때마다 마이그레이션을 쓰게 된다.
-- 다만 사고가 나면 제일 곤란한 둘은 DB 에서도 막는다
alter table public.profiles drop constraint if exists profiles_handle_not_reserved;
alter table public.profiles
  add constraint profiles_handle_not_reserved
  check (handle not in ('admin', 'official'));

# 선수 사진을 사용자가 채운다 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱이 K리그 선수 사진을 배포하지 않게 하고, 사용자가 자기 앨범에서 채운 사진을 본인만 보게 한다. 팬카드 사진도 본인만 열게 한다.

**Architecture:** 비공개 버킷 두 개(`my-player-photos` 신규, `fan-cards` 전환)에 본인 폴더 정책을 건다. 앱은 서명 주소를 화면에 흘리지 않고, `privateImage` 해석기가 서명 주소로 한 번 내려받아 기기 캐시 파일 경로를 돌려준다. 선수 사진 목록은 스토리지 폴더 나열로 알고 표를 두지 않는다.

**Tech Stack:** Expo 57, React Native, `expo-file-system` 57(새 `File`/`Directory` API), `expo-image-manipulator` 57, `@supabase/supabase-js` 2.116, `@tanstack/react-query` 5, `@six33/react-native-bg-removal`, jest(jest-expo).

**Spec:** `docs/superpowers/specs/2026-09-28-user-player-photos-design.md`

## Global Constraints

- 선수 사진 버킷 `my-player-photos`: 비공개, 5MB 상한, `image/png`·`image/jpeg` 만
- 선수 사진 경로 `{uid}/{playerId}` — 확장자 없음, 시즌 없음
- 저장 폭 1000px (홀로 카드 실측값). 누끼는 PNG, 원본은 JPEG
- 서명 주소 유효 60초. 서명 주소를 질의 캐시나 화면 상태에 담지 않는다
- 캐시 파일 이름에 버전(`updated_at`)을 넣는다
- 사용자 사진은 선수 프로필과 홀로 카드에만. 스쿼드 목록은 전원 실루엣
- 비로그인 사용자의 사진 넣기는 로그인부터 청한다
- 사진 공유·남의 카드 보기·자동 채우기("K리그 사진 불러오기")는 만들지 않는다
- 질의 열쇠에 누구의 답인지(uid)를 넣는다
- 코드 형식: prettier `printWidth 110`, `arrowParens avoid`, 세미콜론 없음(앱), 한국어 주석은 둘레 코드와 같은 밀도
- 커밋 메시지는 한국어 한 줄 제목 + 이유를 적은 본문, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **커밋 전에 사용자에게 묻는다**
- migration 은 API 로 못 돌린다(`database/query` 403). SQL Editor 에 붙여 넣을 파일을 만든다

## Review Focus

- 사진을 올리는 도중 오버레이를 닫는다 → 닫힌 뒤 실패로 끝난 업로드가 미리보기를 건드리거나 알림을 띄우면 안 된다 (Task 5 테스트). 선수가 바뀌면 편집기를 `key` 로 새로 세운다
- 팬카드를 사진 그대로 다시 저장 → 이미 캐시에 있는 파일을 다시 입양해도 사라지면 안 된다 (Task 2 테스트)
- 로그아웃 뒤 같은 기기에 다른 계정으로 로그인 → 앞 사람의 선수 사진·팬카드 사진이 보이면 안 된다 (Task 2 테스트: 로그아웃 시 캐시 비움)
- OS 가 캐시 폴더를 비움 → 다음 표시 때 다시 내려받아야 하고, 깨진 그림이 뜨면 안 된다 (Task 2 테스트: 파일이 없으면 서명받아 다시 받음)
- migration 전의 옛 팬카드 행(`photo_url` 에 공개 주소)이 섞여 있음 → 앱이 경로로 읽어 그려야 한다 (Task 7 테스트)
- 누끼가 원본과 같은 주소로 돌아옴(시뮬레이터) 또는 예외 → 누끼 없음으로 보고 원본만 올린다 (Task 4 테스트)

---

## 파일 구조

| 파일                                                                     | 책임                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `supabase/migrations/0019_private_photos.sql` (신규)                     | 버킷 두 개의 공개 여부·정책, `fan_cards.photo_url → photo_path`   |
| `src/repositories/remote/privateImage.ts` (신규)                         | 비공개 이미지를 기기 캐시 파일로 해석·입양·삭제. 로그아웃 시 비움 |
| `src/repositories/remote/imageUpload.ts` (신규)                          | 형식 판별, 폭 줄이기, 비공개 버킷에 올리기                        |
| `src/repositories/playerPhoto/remote.ts` (신규)                          | 선수 사진 경로·나열·올리기·치우기                                 |
| `src/hooks/playerPhoto/usePlayerPhotos.ts` (신규)                        | 목록 질의, 선수 한 명의 사진 파일, 올리기·치우기 동작             |
| `src/utils/pickPhoto.ts` (신규)                                          | 앨범에서 고르기, 누끼 따기 (카드 만들기에서 떼어 냄)              |
| `src/components/club/OverlayAction.tsx` (신규)                           | 오버레이 아래 둥근 단추 (팬카드 오버레이에서 떼어 냄)             |
| `src/components/club/PlayerPhotoEditor.tsx` (신규)                       | 카드 오버레이의 사진 넣기·바꾸기·전환·치우기                      |
| `src/screens/CardMakerScreen.tsx`                                        | `pickPhoto.ts` 를 쓴다                                            |
| `src/components/club/FanCardOverlay.tsx`                                 | `OverlayAction` 을 쓴다                                           |
| `src/components/club/PlayerCardOverlay.tsx`                              | 미리보기 상태, 편집기 자리                                        |
| `src/screens/PlayerScreen.tsx`                                           | 내 사진으로 그리기, 카메라 배지, 로그인 청하기                    |
| `src/services/kleague/clubService.ts`, `src/services/kleague/mappers.ts` | K리그 사진 주소 제거                                              |
| `src/repositories/fanCard/remote.ts`, `src/hooks/fanCard/useFanCards.ts` | 경로 저장, 해석기 경유                                            |
| `docs/privacy.md`                                                        | 공개 범위 문구                                                    |

---

### Task 1: migration 파일

**Files:**

- Create: `supabase/migrations/0019_private_photos.sql`

**Interfaces:**

- Produces: 버킷 `my-player-photos`(비공개), `fan-cards`(비공개), 칸 `public.fan_cards.photo_path text` (옛 `photo_url`)

이 task 는 파일만 만든다. 적용은 Task 9 에서 새 빌드와 함께 한다.

- [ ] **Step 1: 파일을 쓴다**

```sql
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
```

- [ ] **Step 2: 형식 검사**

Run: `cd steelers-app && npx prettier --check supabase/migrations/0019_private_photos.sql`
Expected: 통과, 또는 "No parser could be inferred" (SQL 은 prettier 대상이 아니다 — 둘 다 괜찮다)

- [ ] **Step 3: 커밋 (사용자에게 묻고)**

```bash
git add supabase/migrations/0019_private_photos.sql
git commit -m "사진 버킷을 본인만 여는 migration 을 둔다"
```

---

### Task 2: 비공개 이미지 해석기

**Files:**

- Create: `src/repositories/remote/privateImage.ts`
- Test: `__tests__/private-image.test.ts`

**Interfaces:**

- Produces:
  - `interface PrivateImageRef { bucket: string; path: string; version: string }`
  - `versionTag(version: string): string`
  - `cacheParts(ref: PrivateImageRef): { folders: string[]; stem: string; name: string }`
  - `resolvePrivateImage(ref: PrivateImageRef): Promise<string | null>` — 캐시 파일 uri, 못 얻으면 null
  - `adoptPrivateImage(ref: PrivateImageRef, localUri: string): string` — 로컬 파일을 그 버전 이름으로 캐시에 복사하고 uri 를 돌려준다
  - `dropPrivateImage(ref: { bucket: string; path: string }): void` — 모든 버전 삭제
  - `isPrivateCacheUri(uri: string): boolean`
  - `clearPrivateImages(): void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import {
  adoptPrivateImage,
  cacheParts,
  clearPrivateImages,
  dropPrivateImage,
  isPrivateCacheUri,
  resolvePrivateImage,
  versionTag,
} from '@/repositories/remote/privateImage'

/**
 * 파일시스템 가짜. 실제 네이티브 모듈은 jest 에 없다.
 * uri 를 열쇠로 한 집합 두 개로 파일과 폴더를 흉내 낸다.
 */
jest.mock('expo-file-system', () => {
  const files = new Set<string>()
  const dirs = new Set<string>()
  const uriOf = (parts: unknown[]) =>
    parts.map(p => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/')

  class File {
    uri: string
    name: string
    constructor(...parts: unknown[]) {
      this.uri = uriOf(parts)
      this.name = this.uri.split('/').pop() ?? ''
    }
    get exists() {
      return files.has(this.uri)
    }
    delete() {
      files.delete(this.uri)
    }
    copy(to: { uri: string }) {
      files.add(to.uri)
    }
    static downloadFileAsync = jest.fn(async (_url: string, to: { uri: string }) => {
      files.add(to.uri)
      return to.uri
    })
  }

  class Directory {
    uri: string
    constructor(...parts: unknown[]) {
      this.uri = uriOf(parts)
    }
    get exists() {
      return dirs.has(this.uri)
    }
    create() {
      dirs.add(this.uri)
    }
    delete() {
      for (const f of [...files]) if (f.startsWith(`${this.uri}/`)) files.delete(f)
      for (const d of [...dirs]) if (d === this.uri || d.startsWith(`${this.uri}/`)) dirs.delete(d)
    }
    list() {
      return [...files].filter(f => f.slice(0, f.lastIndexOf('/')) === this.uri).map(f => new File(f))
    }
  }

  return { File, Directory, Paths: { cache: new Directory('mem://cache') }, __files: files }
})

const mockCreateSignedUrl = jest.fn()
// 로그아웃 구독은 모듈을 불러오는 순간 걸린다. 그때는 이 파일의 const 가 아직 안 섰으므로
// 바깥 배열에 담지 않고 jest.fn 의 호출 기록에서 꺼낸다
jest.mock('@/repositories/remote/supabase', () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockCreateSignedUrl(...a) }) },
    auth: { onAuthStateChange: jest.fn() },
  },
}))
const { supabase: mockSupabase } = jest.requireMock('@/repositories/remote/supabase') as {
  supabase: { auth: { onAuthStateChange: jest.Mock } }
}

const fs = jest.requireMock('expo-file-system') as {
  File: { downloadFileAsync: jest.Mock }
  __files: Set<string>
}

const REF = { bucket: 'my-player-photos', path: 'user-1/20060066', version: '2026-09-28T10:00:00.000Z' }

beforeEach(() => {
  fs.__files.clear()
  fs.File.downloadFileAsync.mockClear()
  mockCreateSignedUrl.mockReset()
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/x' }, error: null })
})

describe('캐시 파일 이름', () => {
  /** updated_at 의 ':' 는 파일 이름에 넣기 위험하다. 숫자만 남긴다 */
  it('버전은 밀리초 숫자가 된다', () => {
    expect(versionTag('2026-09-28T10:00:00.000Z')).toBe(String(Date.parse('2026-09-28T10:00:00.000Z')))
  })

  it('경로의 폴더는 그대로 두고 이름 끝에 버전을 붙인다', () => {
    expect(cacheParts(REF)).toEqual({
      folders: ['my-player-photos', 'user-1'],
      stem: '20060066',
      name: `20060066@${versionTag(REF.version)}`,
    })
  })
})

describe('해석', () => {
  it('캐시에 있으면 네트워크를 부르지 않는다', async () => {
    const first = await resolvePrivateImage(REF)
    mockCreateSignedUrl.mockClear()
    fs.File.downloadFileAsync.mockClear()

    const again = await resolvePrivateImage(REF)
    expect(again).toBe(first)
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    expect(fs.File.downloadFileAsync).not.toHaveBeenCalled()
  })

  it('없으면 60초짜리 서명 주소로 받아 둔다', async () => {
    const uri = await resolvePrivateImage(REF)
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(REF.path, 60)
    expect(fs.File.downloadFileAsync).toHaveBeenCalledWith('https://signed/x', expect.anything())
    expect(uri).toMatch(/my-player-photos\/user-1\/20060066@\d+$/)
  })

  /** OS 가 캐시를 비운 경우. 깨진 그림 대신 다시 받는다 */
  it('파일이 사라졌으면 다시 받는다', async () => {
    const uri = await resolvePrivateImage(REF)
    fs.__files.delete(uri!)
    await resolvePrivateImage(REF)
    expect(fs.File.downloadFileAsync).toHaveBeenCalledTimes(2)
  })

  it('버전이 바뀌면 새로 받고 옛 파일을 지운다', async () => {
    const old = await resolvePrivateImage(REF)
    const next = await resolvePrivateImage({ ...REF, version: '2026-09-29T10:00:00.000Z' })
    expect(next).not.toBe(old)
    expect(fs.__files.has(old!)).toBe(false)
    expect(fs.__files.has(next!)).toBe(true)
  })

  it('서명을 못 받으면 null', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error('403') })
    expect(await resolvePrivateImage(REF)).toBeNull()
  })

  it('내려받기가 실패하면 null', async () => {
    fs.File.downloadFileAsync.mockRejectedValueOnce(new Error('network'))
    expect(await resolvePrivateImage(REF)).toBeNull()
  })
})

describe('입양과 삭제', () => {
  /** 방금 올린 사진을 다시 받지 않는다 */
  it('로컬 파일을 그 버전 이름으로 캐시에 둔다', async () => {
    const uri = adoptPrivateImage(REF, 'file:///tmp/picked.png')
    expect(await resolvePrivateImage(REF)).toBe(uri)
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })

  /** 이미 그 이름인 캐시 파일을 다시 입양하면 자기 자신을 지우고 복사하려다 사라진다 */
  it('같은 파일을 다시 입양해도 남는다', () => {
    const uri = adoptPrivateImage(REF, 'file:///tmp/a.png')
    expect(adoptPrivateImage(REF, uri)).toBe(uri)
    expect(fs.__files.has(uri)).toBe(true)
  })

  it('치우면 모든 버전이 사라진다', () => {
    const a = adoptPrivateImage(REF, 'file:///tmp/a.png')
    const b = adoptPrivateImage({ ...REF, version: '2026-09-29T00:00:00.000Z' }, 'file:///tmp/b.png')
    dropPrivateImage(REF)
    expect(fs.__files.has(a)).toBe(false)
    expect(fs.__files.has(b)).toBe(false)
  })

  it('캐시 파일인지 가린다', () => {
    expect(isPrivateCacheUri(adoptPrivateImage(REF, 'file:///tmp/a.png'))).toBe(true)
    expect(isPrivateCacheUri('file:///documents/fan-card/1.jpg')).toBe(false)
  })
})

describe('로그아웃', () => {
  /** 같은 기기에 다른 사람이 로그인해도 앞 사람 사진이 안 남는다 */
  it('로그아웃하면 캐시를 통째로 비운다', () => {
    const uri = adoptPrivateImage(REF, 'file:///tmp/a.png')
    const listener = mockSupabase.auth.onAuthStateChange.mock.calls[0][0] as (event: string) => void
    listener('SIGNED_OUT')
    expect(fs.__files.has(uri)).toBe(false)
  })

  it('clearPrivateImages 를 직접 불러도 비운다', () => {
    const uri = adoptPrivateImage(REF, 'file:///tmp/a.png')
    clearPrivateImages()
    expect(fs.__files.has(uri)).toBe(false)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/private-image.test.ts`
Expected: FAIL — `Cannot find module '@/repositories/remote/privateImage'`

- [ ] **Step 3: 구현한다**

```ts
import { Directory, File, Paths } from 'expo-file-system'

import { supabase } from '@/repositories/remote/supabase'

/**
 * 비공개 버킷의 이미지를 기기 캐시 파일로 받는다.
 *
 * 서명 주소를 화면에 그대로 흘리지 않는다. 질의 캐시가 기기에 저장되므로 주소를 담아
 * 두면 만료된 채로 앱을 다시 켜도 살아남고, 이미지 캐시는 주소를 열쇠로 써서 발급할
 * 때마다 빗나간다. 파일로 받아 두면 둘 다 사라진다 — 스키아 useImage 도 로컬 파일을
 * 읽으니 카드를 열 때마다 다시 받지 않는다.
 *
 * 파일 이름에 버전(updated_at)을 넣는다. 사진을 바꾸면 이름이 달라져 옛 것을 쓸 일이 없다.
 */

export interface PrivateImageRef {
  bucket: string
  /** 버킷 안 경로. 맨 앞 칸이 사용자 id 다 */
  path: string
  /** 스토리지나 표가 준 updated_at */
  version: string
}

/** 서명 주소는 한 번 내려받는 데만 쓴다. 길 필요가 없다 */
const SIGN_SECONDS = 60

function rootDir(): Directory {
  return new Directory(Paths.cache, 'private-images')
}

/** updated_at 의 ':' 는 파일 이름에 넣기 위험하다. 밀리초 숫자로 바꾼다 */
export function versionTag(version: string): string {
  const ms = Date.parse(version)
  return Number.isNaN(ms) ? version.replace(/[^0-9A-Za-z]/g, '') : String(ms)
}

export function cacheParts(ref: PrivateImageRef): { folders: string[]; stem: string; name: string } {
  const segments = ref.path.split('/')
  const stem = segments.pop() ?? ''
  return { folders: [ref.bucket, ...segments], stem, name: `${stem}@${versionTag(ref.version)}` }
}

function dirOf(folders: string[]): Directory {
  return new Directory(rootDir(), ...folders)
}

/** 같은 대상의 다른 버전을 지운다. keep 이 없으면 전부 */
function dropVersions(dir: Directory, stem: string, keep: string | null) {
  if (!dir.exists) return
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue
    if (!entry.name.startsWith(`${stem}@`) || entry.name === keep) continue
    try {
      entry.delete()
    } catch {
      // 못 지워도 다음 버전 이름은 다르므로 틀린 그림이 나오지 않는다
    }
  }
}

/** 캐시 파일 uri. 못 얻으면 null — 화면은 실루엣을 그린다 */
export async function resolvePrivateImage(ref: PrivateImageRef): Promise<string | null> {
  const { folders, stem, name } = cacheParts(ref)
  const dir = dirOf(folders)
  const file = new File(dir, name)
  if (file.exists) return file.uri

  const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, SIGN_SECONDS)
  if (error || !data) return null

  try {
    if (!dir.exists) dir.create({ intermediates: true })
    await File.downloadFileAsync(data.signedUrl, file)
  } catch {
    return null
  }
  dropVersions(dir, stem, name)
  return file.uri
}

/** 방금 올린 로컬 파일을 그 버전 이름으로 캐시에 둔다. 다시 내려받지 않으려는 것이다 */
export function adoptPrivateImage(ref: PrivateImageRef, localUri: string): string {
  const { folders, stem, name } = cacheParts(ref)
  const dir = dirOf(folders)
  if (!dir.exists) dir.create({ intermediates: true })
  const target = new File(dir, name)
  // 팬카드를 사진 그대로 다시 저장하면 이미 그 자리에 있는 파일이 들어온다
  if (target.uri === localUri) return target.uri
  if (target.exists) target.delete()
  new File(localUri).copy(target)
  dropVersions(dir, stem, name)
  return target.uri
}

export function dropPrivateImage(ref: { bucket: string; path: string }): void {
  const { folders, stem } = cacheParts({ ...ref, version: '' })
  dropVersions(dirOf(folders), stem, null)
}

export function isPrivateCacheUri(uri: string): boolean {
  return uri.startsWith(`${rootDir().uri}/`)
}

export function clearPrivateImages(): void {
  try {
    const dir = rootDir()
    if (dir.exists) dir.delete()
  } catch {
    // 못 지워도 경로에 사용자 id 가 있어 남의 사진이 보이지는 않는다
  }
}

// 로그아웃하면 비운다. 경로에 사용자 id 가 있어 섞이지는 않지만 남겨 둘 이유가 없다
supabase.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') clearPrivateImages()
})
```

- [ ] **Step 4: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/private-image.test.ts && npx tsc --noEmit`
Expected: PASS, 타입 오류 없음. `Directory` 생성자가 `Directory` 인자를 받지 않는다고 나오면 `new Directory(rootDir().uri, ...folders)` 로 바꾼다.

- [ ] **Step 5: 커밋 (사용자에게 묻고)**

```bash
git add src/repositories/remote/privateImage.ts __tests__/private-image.test.ts
git commit -m "비공개 이미지를 기기 캐시 파일로 받는 해석기를 둔다"
```

---

### Task 3: 올리기 부품과 선수 사진 저장소·훅

**Files:**

- Create: `src/repositories/remote/imageUpload.ts`
- Create: `src/repositories/playerPhoto/remote.ts`
- Create: `src/hooks/playerPhoto/usePlayerPhotos.ts`
- Test: `__tests__/player-photo.test.ts`

**Interfaces:**

- Consumes: Task 2 의 `resolvePrivateImage`, `adoptPrivateImage`, `dropPrivateImage`
- Produces:
  - `imageUpload.ts`: `type ImageType = 'image/png' | 'image/jpeg'`, `detectImageType(bytes: Uint8Array): ImageType | null`, `uploadPrivateImage(bucket: string, path: string, localUri: string, maxWidth: number): Promise<void>`
  - `playerPhoto/remote.ts`: `PLAYER_PHOTO_BUCKET = 'my-player-photos'`, `playerPhotoPath(userId: string, playerId: string): string`, `type PhotoVersions = Record<string, string>`, `toVersions(entries: { name: string; updated_at: string | null }[]): PhotoVersions`, `listMyPlayerPhotos(userId: string): Promise<PhotoVersions>`, `uploadPlayerPhoto(userId, playerId, localUri): Promise<void>`, `removePlayerPhoto(userId, playerId): Promise<void>`
  - `usePlayerPhotos.ts`: `myPlayerPhotosKey(userId: string | null)`, `useMyPlayerPhotos(): PhotoVersions`, `usePlayerPhoto(playerId: string | null): string | null`, `usePlayerPhotoActions(playerId: string | null): { signedIn: boolean; put(localUri: string): Promise<void>; remove(): Promise<void> }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { detectImageType } from '@/repositories/remote/imageUpload'
import { playerPhotoPath, toVersions } from '@/repositories/playerPhoto/remote'
import { myPlayerPhotosKey } from '@/hooks/playerPhoto/usePlayerPhotos'

jest.mock('@/repositories/remote/supabase', () => ({
  supabase: { storage: { from: jest.fn() }, auth: { onAuthStateChange: jest.fn() } },
}))
// useAuth 는 불러오는 순간 세션을 묻는다. 여기서 볼 것은 순수 함수뿐이라 통째로 비운다
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: null }) }))

describe('형식 판별', () => {
  /** 누끼는 PNG 다. JPEG 로 올리면 투명한 자리가 검게 채워진다 */
  it('PNG 머리를 알아본다', () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    )
  })

  it('JPEG 머리를 알아본다', () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
  })

  it('모르는 것은 null', () => {
    expect(detectImageType(new Uint8Array([0x00, 0x01]))).toBeNull()
  })
})

describe('선수 사진 경로', () => {
  /** 맨 앞 칸이 사용자 id 여야 정책이 주인을 가린다 (0019) */
  it('사용자 id 로 시작하고 확장자가 없다', () => {
    expect(playerPhotoPath('user-1', '20060066')).toBe('user-1/20060066')
  })
})

describe('폴더 나열 결과', () => {
  it('선수 id 에서 버전으로 바꾼다', () => {
    expect(
      toVersions([
        { name: '20060066', updated_at: '2026-09-28T10:00:00.000Z' },
        { name: '20130151', updated_at: '2026-09-27T10:00:00.000Z' },
      ]),
    ).toEqual({ '20060066': '2026-09-28T10:00:00.000Z', '20130151': '2026-09-27T10:00:00.000Z' })
  })

  /** 스토리지는 빈 폴더를 지키려고 자리표시 파일과 updated_at 이 빈 폴더 항목을 끼워 준다 */
  it('자리표시와 폴더 항목은 뺀다', () => {
    expect(
      toVersions([
        { name: '.emptyFolderPlaceholder', updated_at: '2026-09-28T10:00:00.000Z' },
        { name: 'sub', updated_at: null },
      ]),
    ).toEqual({})
  })
})

describe('질의 열쇠', () => {
  it('누구의 답인지 담는다', () => {
    expect(myPlayerPhotosKey('user-1')).toEqual(['myPlayerPhotos', 'user-1'])
    expect(myPlayerPhotosKey(null)).not.toEqual(myPlayerPhotosKey('user-1'))
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/player-photo.test.ts`
Expected: FAIL — `Cannot find module '@/repositories/remote/imageUpload'`

- [ ] **Step 3: `imageUpload.ts` 를 쓴다**

```ts
import { File } from 'expo-file-system'
import * as ImageManipulator from 'expo-image-manipulator'

import { supabase } from '@/repositories/remote/supabase'

/**
 * 비공개 버킷에 사진을 올린다.
 *
 * 형식은 확장자가 아니라 파일 머리로 가린다. 누끼는 PNG 인데 이름이 .jpg 인 채로
 * 옮겨 다니는 일이 있었다(keepPhoto). contentType 을 이름으로 정하면 투명한 자리가
 * 검게 채워진다.
 */

export type ImageType = 'image/png' | 'image/jpeg'

export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

/** 폭을 maxWidth 까지 줄인다. 작은 사진은 키우지 않는다. PNG 면 PNG 로 남겨 투명도를 지킨다 */
async function prepare(
  localUri: string,
  maxWidth: number,
): Promise<{ bytes: ArrayBuffer; contentType: ImageType }> {
  const head = new Uint8Array(await new File(localUri).arrayBuffer()).subarray(0, 8)
  const png = detectImageType(head) === 'image/png'

  const probe = await ImageManipulator.ImageManipulator.manipulate(localUri).renderAsync()
  const image =
    probe.width > maxWidth
      ? await ImageManipulator.ImageManipulator.manipulate(localUri).resize({ width: maxWidth }).renderAsync()
      : probe
  const saved = await image.saveAsync({
    format: png ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
    compress: png ? 1 : 0.85,
  })

  return { bytes: await new File(saved.uri).arrayBuffer(), contentType: png ? 'image/png' : 'image/jpeg' }
}

/** 같은 경로를 덮어쓴다. 원본과 누끼를 오가도 서버에는 늘 한 장이다 */
export async function uploadPrivateImage(
  bucket: string,
  path: string,
  localUri: string,
  maxWidth: number,
): Promise<void> {
  const { bytes, contentType } = await prepare(localUri, maxWidth)
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: true })
  if (error) throw error
}
```

- [ ] **Step 4: `playerPhoto/remote.ts` 를 쓴다**

```ts
import { supabase } from '@/repositories/remote/supabase'
import { uploadPrivateImage } from '@/repositories/remote/imageUpload'

/**
 * 사용자가 직접 넣은 선수 사진.
 *
 * 앱은 선수 사진을 내보내지 않는다. 남의 사진을 우리가 복제해 재배포하면 초상권과
 * 앱스토어 5.2.1 에 걸린다. 사용자가 자기 앨범에서 고른 것을 본인만 본다.
 *
 * 표를 두지 않는다. 내 폴더를 나열하면 누구 사진이 있는지와 언제 바뀌었는지가 같이
 * 온다 — 원본이 하나라 표와 파일이 어긋날 일이 없다.
 */

export const PLAYER_PHOTO_BUCKET = 'my-player-photos'

/** 홀로 카드가 사진을 크게 얹는다. 가장 큰 아이폰에서 864px 이 필요했다 */
const WIDTH = 1000

/**
 * 맨 앞 칸이 사용자 id 여야 한다 — 정책이 그 칸만 보고 주인을 가린다 (0019).
 * 확장자를 붙이지 않는다. 원본(JPEG)과 누끼(PNG)를 오가도 같은 자리를 덮어쓴다.
 * 시즌도 넣지 않는다. 선수 id 는 시즌이 바뀌어도 같다.
 */
export function playerPhotoPath(userId: string, playerId: string): string {
  return `${userId}/${playerId}`
}

/** 선수 id → updated_at */
export type PhotoVersions = Record<string, string>

export function toVersions(entries: { name: string; updated_at: string | null }[]): PhotoVersions {
  const out: PhotoVersions = {}
  for (const entry of entries) {
    // 폴더 항목은 updated_at 이 없고, 빈 폴더를 지키는 자리표시는 점으로 시작한다
    if (!entry.updated_at || entry.name.startsWith('.')) continue
    out[entry.name] = entry.updated_at
  }
  return out
}

export async function listMyPlayerPhotos(userId: string): Promise<PhotoVersions> {
  // 스쿼드가 40명 안팎이라 한 번에 다 온다
  const { data, error } = await supabase.storage.from(PLAYER_PHOTO_BUCKET).list(userId, { limit: 1000 })
  if (error) throw error
  return toVersions(data ?? [])
}

export function uploadPlayerPhoto(userId: string, playerId: string, localUri: string): Promise<void> {
  return uploadPrivateImage(PLAYER_PHOTO_BUCKET, playerPhotoPath(userId, playerId), localUri, WIDTH)
}

export async function removePlayerPhoto(userId: string, playerId: string): Promise<void> {
  const { error } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .remove([playerPhotoPath(userId, playerId)])
  if (error) throw error
}
```

- [ ] **Step 5: `usePlayerPhotos.ts` 를 쓴다**

```ts
import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/auth/useAuth'
import {
  listMyPlayerPhotos,
  PLAYER_PHOTO_BUCKET,
  type PhotoVersions,
  playerPhotoPath,
  removePlayerPhoto,
  uploadPlayerPhoto,
} from '@/repositories/playerPhoto/remote'
import { adoptPrivateImage, dropPrivateImage, resolvePrivateImage } from '@/repositories/remote/privateImage'

/**
 * 내가 사진을 넣은 선수 목록의 질의 열쇠.
 *
 * 누구의 답인지 열쇠에 넣는다 (adminKey 와 같은 이유). 안 넣으면 로그아웃 뒤나 다른
 * 사람이 로그인했을 때 앞 사람의 목록을 물려받는다. 목록에는 주소가 없어서 기기에
 * 저장돼도 만료될 것이 없다.
 */
export const myPlayerPhotosKey = (userId: string | null) => ['myPlayerPhotos', userId] as const

const EMPTY: PhotoVersions = {}

export function useMyPlayerPhotos(): PhotoVersions {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const query = useQuery({
    queryKey: myPlayerPhotosKey(userId),
    queryFn: () => listMyPlayerPhotos(userId!),
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  })
  // 못 받았으면 사진 없음으로 본다. 실루엣이 나오고 카드는 막히지 않는다
  return (userId !== null && query.data) || EMPTY
}

/** 선수 한 명의 사진 파일. 없거나 못 받았으면 null */
export function usePlayerPhoto(playerId: string | null): string | null {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const versions = useMyPlayerPhotos()
  const version = playerId ? versions[playerId] : undefined
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !playerId || !version) {
      setUri(null)
      return
    }
    let alive = true
    void resolvePrivateImage({
      bucket: PLAYER_PHOTO_BUCKET,
      path: playerPhotoPath(userId, playerId),
      version,
    }).then(next => {
      if (alive) setUri(next)
    })
    return () => {
      alive = false
    }
  }, [userId, playerId, version])

  return uri
}

export function usePlayerPhotoActions(playerId: string | null) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  /**
   * 올리고 나서 목록을 다시 받아 새 버전을 안다. 그 이름으로 방금 고른 파일을 캐시에
   * 옮겨 두어 올린 것을 다시 내려받지 않는다.
   */
  const put = useCallback(
    async (localUri: string) => {
      if (!userId || !playerId) throw new Error('로그인이 필요합니다')
      await uploadPlayerPhoto(userId, playerId, localUri)
      const versions = await listMyPlayerPhotos(userId)
      const version = versions[playerId]
      if (version) {
        adoptPrivateImage(
          { bucket: PLAYER_PHOTO_BUCKET, path: playerPhotoPath(userId, playerId), version },
          localUri,
        )
      }
      queryClient.setQueryData(myPlayerPhotosKey(userId), versions)
    },
    [playerId, queryClient, userId],
  )

  const remove = useCallback(async () => {
    if (!userId || !playerId) return
    await removePlayerPhoto(userId, playerId)
    dropPrivateImage({ bucket: PLAYER_PHOTO_BUCKET, path: playerPhotoPath(userId, playerId) })
    queryClient.setQueryData<PhotoVersions>(myPlayerPhotosKey(userId), prev => {
      const next = { ...prev }
      delete next[playerId]
      return next
    })
  }, [playerId, queryClient, userId])

  return { signedIn: userId !== null, put, remove }
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/player-photo.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, 타입·린트 오류 없음

- [ ] **Step 7: 커밋 (사용자에게 묻고)**

```bash
git add src/repositories/remote/imageUpload.ts src/repositories/playerPhoto/remote.ts src/hooks/playerPhoto/usePlayerPhotos.ts __tests__/player-photo.test.ts
git commit -m "사용자가 넣은 선수 사진을 비공개 버킷에 두고 읽는다"
```

---

### Task 4: 사진 고르기·누끼를 카드 만들기에서 떼어 낸다

**Files:**

- Create: `src/utils/pickPhoto.ts`
- Modify: `src/screens/CardMakerScreen.tsx` (현재 `cutOut` 정의 124-147행, `pickPhoto` 의 권한·고르기 149-162행, `removeBackground` import 4행)
- Test: `__tests__/pick-photo.test.ts`

**Interfaces:**

- Produces: `pickFromLibrary(): Promise<string | 'denied' | null>` (고른 파일 uri / 권한 거부 / 취소), `cutOut(uri: string): Promise<string | null>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { cutOut, pickFromLibrary } from '@/utils/pickPhoto'

const mockRemoveBackground = jest.fn()
jest.mock('@six33/react-native-bg-removal', () => ({
  removeBackground: (...a: unknown[]) => mockRemoveBackground(...a),
}))

const mockPermission = jest.fn()
const mockLaunch = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: () => mockPermission(),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunch(...a),
}))

beforeEach(() => {
  mockRemoveBackground.mockReset()
  mockPermission.mockReset().mockResolvedValue({ granted: true })
  mockLaunch.mockReset()
})

describe('누끼', () => {
  it('딴 파일을 돌려준다', async () => {
    mockRemoveBackground.mockResolvedValue('file:///cut.png')
    expect(await cutOut('file:///raw.jpg')).toBe('file:///cut.png')
    // 옵션을 늘 넘긴다. 빼면 네이티브가 콜백을 옵션 자리에서 읽고 앱이 죽는다
    expect(mockRemoveBackground).toHaveBeenCalledWith('file:///raw.jpg', { trim: true })
  })

  /** 시뮬레이터는 원본을 그대로 돌려준다. 그건 누끼가 아니다 */
  it('원본이 그대로 오면 null', async () => {
    mockRemoveBackground.mockResolvedValue('file:///raw.jpg')
    expect(await cutOut('file:///raw.jpg')).toBeNull()
  })

  it('실패하면 null', async () => {
    mockRemoveBackground.mockRejectedValue(new Error('iOS 17 미만'))
    expect(await cutOut('file:///raw.jpg')).toBeNull()
  })
})

describe('고르기', () => {
  it('권한이 없으면 denied', async () => {
    mockPermission.mockResolvedValue({ granted: false })
    expect(await pickFromLibrary()).toBe('denied')
    expect(mockLaunch).not.toHaveBeenCalled()
  })

  it('취소하면 null', async () => {
    mockLaunch.mockResolvedValue({ canceled: true, assets: [] })
    expect(await pickFromLibrary()).toBeNull()
  })

  it('3:4 로 잘라 고른 파일을 돌려준다', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///picked.jpg' }] })
    expect(await pickFromLibrary()).toBe('file:///picked.jpg')
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [3, 4] }))
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/pick-photo.test.ts`
Expected: FAIL — `Cannot find module '@/utils/pickPhoto'`

- [ ] **Step 3: `pickPhoto.ts` 를 쓴다** — `CardMakerScreen.tsx` 124-147행의 주석을 함께 옮긴다

```ts
import * as ImagePicker from 'expo-image-picker'
import { removeBackground } from '@six33/react-native-bg-removal'

/**
 * 카드에 넣을 사진을 고른다. 카드 만들기와 선수 카드가 같이 쓴다.
 *
 * 카드에 들어가는 자리가 3:4 라 고를 때부터 그 비율로 자르게 한다.
 */
export async function pickFromLibrary(): Promise<string | 'denied' | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'denied'
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.9,
  })
  if (picked.canceled || !picked.assets[0]) return null
  return picked.assets[0].uri
}

/**
 * 고른 사진에서 배경을 걷어낸다.
 *
 * 기기 안에서 돈다 — iOS 는 Vision, 안드로이드는 ML Kit 이 피사체를 찾아낸다. 사진이
 * 밖으로 나가지 않는다.
 *
 * 실패는 정상적인 경우가 많다. iOS 17 미만이거나, 피사체를 못 찾는 사진이면 null 을
 * 돌려주고 부르는 쪽이 원본을 쓴다 — 카드가 안 만들어지는 것보다 네모난 사진이 낫다.
 *
 * 라이브러리의 isNativeBackgroundRemovalSupported 는 쓰지 않는다. 그 함수가 내부에서
 * removeBackground 를 **옵션 없이** 부르는데, 네이티브 스펙은 옵션을 필수로 받도록
 * 되어 있어 콜백을 옵션 자리에서 읽고 앱이 통째로 죽는다. 옵션을 늘 넘기면 피할 수 있다.
 */
export async function cutOut(uri: string): Promise<string | null> {
  try {
    // trim 은 투명한 가장자리를 잘라 낸다. 카드에 얹을 때 피사체가 더 크게 들어간다
    const out = await removeBackground(uri, { trim: true })
    // 시뮬레이터에서는 원본을 그대로 돌려준다. 그건 누끼를 딴 것이 아니다
    return out === uri ? null : out
  } catch {
    return null
  }
}
```

- [ ] **Step 4: `CardMakerScreen.tsx` 가 이것을 쓰게 한다**

4행 `import { removeBackground } from '@six33/react-native-bg-removal'` 를 지우고 `import { cutOut, pickFromLibrary } from '@/utils/pickPhoto'` 를 넣는다. `ImagePicker` import 가 다른 곳에서 안 쓰이면 지운다. 124-147행의 `cutOut` useCallback 과 그 주석을 지운다. `pickPhoto` 는 이렇게 바꾼다:

```tsx
const pickPhoto = useCallback(async () => {
  const picked = await pickFromLibrary()
  if (picked === 'denied') {
    Alert.alert('사진 접근이 필요합니다', '설정에서 사진 접근을 켜면 카드에 넣을 수 있습니다.')
    return
  }
  if (!picked) return

  setWorking(true)
  try {
    const raw = await keepPhoto(picked)
    const cut = await cutOut(raw)
    // 누끼를 땄으면 그것도 앱 안으로 옮겨 둔다. 임시 자리는 언제 비워질지 모른다
    const kept = cut ? await keepPhoto(cut) : null
    set({ rawPhotoUri: raw, cutPhotoUri: kept, photoUri: kept ?? raw })
  } catch {
    Alert.alert('사진을 저장하지 못했습니다', '다시 골라 주세요.')
  } finally {
    setWorking(false)
  }
}, [set])
```

- [ ] **Step 5: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/pick-photo.test.ts __tests__/card-maker.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS. 카드 만들기 테스트가 그대로 통과해야 한다

- [ ] **Step 6: 커밋 (사용자에게 묻고)**

```bash
git add src/utils/pickPhoto.ts src/screens/CardMakerScreen.tsx __tests__/pick-photo.test.ts
git commit -m "사진 고르기와 누끼를 카드 만들기에서 떼어 낸다"
```

---

### Task 5: 카드 오버레이의 사진 편집기

**Files:**

- Create: `src/components/club/OverlayAction.tsx`
- Create: `src/components/club/PlayerPhotoEditor.tsx`
- Modify: `src/components/club/FanCardOverlay.tsx` (`Action` 함수와 `styles.action`, 83-105행)
- Modify: `src/components/club/PlayerCardOverlay.tsx`
- Test: `__tests__/player-photo-editor.test.tsx`

**Interfaces:**

- Consumes: Task 3 `usePlayerPhotoActions`, Task 4 `pickFromLibrary`, `cutOut`
- Produces:
  - `OverlayAction({ label, tone?, onPress?, disabled? })`
  - `PlayerPhotoEditor({ playerId: string; hasPhoto: boolean; onPreview(uri: string | null | undefined): void; onRequireLogin(): void })` — `onPreview(undefined)` 는 "미리보기를 거두고 서버 사진을 보여라"
  - `PlayerCardOverlay` props 에 `onRequireLogin?: () => void` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```tsx
import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { PlayerPhotoEditor } from '@/components/club/PlayerPhotoEditor'

const mockActions = { signedIn: true, put: jest.fn(), remove: jest.fn() }
jest.mock('@/hooks/playerPhoto/usePlayerPhotos', () => ({
  usePlayerPhotoActions: () => mockActions,
}))

const mockPick = jest.fn()
const mockCut = jest.fn()
jest.mock('@/utils/pickPhoto', () => ({
  pickFromLibrary: () => mockPick(),
  cutOut: (uri: string) => mockCut(uri),
}))

function open(props: Partial<React.ComponentProps<typeof PlayerPhotoEditor>> = {}) {
  const onPreview = jest.fn()
  const onRequireLogin = jest.fn()
  render(
    <ThemeProvider initialPreference="home">
      <PlayerPhotoEditor
        playerId="20060066"
        hasPhoto={false}
        onPreview={onPreview}
        onRequireLogin={onRequireLogin}
        {...props}
      />
    </ThemeProvider>,
  )
  return { onPreview, onRequireLogin }
}

beforeEach(() => {
  mockActions.signedIn = true
  mockActions.put.mockReset().mockResolvedValue(undefined)
  mockActions.remove.mockReset().mockResolvedValue(undefined)
  mockPick.mockReset().mockResolvedValue('file:///raw.jpg')
  mockCut.mockReset().mockResolvedValue('file:///cut.png')
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

describe('선수 사진 편집기', () => {
  it('사진이 없으면 넣기만 보인다', () => {
    open()
    expect(screen.getByText('사진 넣기')).toBeTruthy()
    expect(screen.queryByText('치우기')).toBeNull()
  })

  it('사진이 있으면 바꾸기와 치우기가 보인다', () => {
    open({ hasPhoto: true })
    expect(screen.getByText('바꾸기')).toBeTruthy()
    expect(screen.getByText('치우기')).toBeTruthy()
  })

  /** 신고·차단과 같은 흐름. 앨범부터 열면 고르고 나서 막힌다 */
  it('로그인 전이면 로그인부터 청하고 앨범을 열지 않는다', () => {
    mockActions.signedIn = false
    const { onRequireLogin } = open()
    fireEvent.press(screen.getByText('사진 넣기'))
    expect(onRequireLogin).toHaveBeenCalled()
    expect(mockPick).not.toHaveBeenCalled()
  })

  it('고르면 누끼를 바로 보여 주고 올린다', async () => {
    const { onPreview } = open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => expect(mockActions.put).toHaveBeenCalledWith('file:///cut.png'))
    expect(onPreview).toHaveBeenCalledWith('file:///cut.png')
  })

  it('누끼를 못 따면 원본을 올리고 전환은 없다', async () => {
    mockCut.mockResolvedValue(null)
    open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => expect(mockActions.put).toHaveBeenCalledWith('file:///raw.jpg'))
    expect(screen.queryByText('원본으로')).toBeNull()
  })

  it('방금 고른 사진은 원본으로 되돌려 다시 올릴 수 있다', async () => {
    open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => screen.getByText('원본으로'))
    fireEvent.press(screen.getByText('원본으로'))
    await waitFor(() => expect(mockActions.put).toHaveBeenLastCalledWith('file:///raw.jpg'))
    expect(screen.getByText('누끼로')).toBeTruthy()
  })

  /** 넣은 줄 알았는데 다음에 보니 없는 것이 제일 나쁘다 */
  it('올리기가 실패하면 알리고 미리보기를 거둔다', async () => {
    mockActions.put.mockRejectedValue(new Error('network'))
    const { onPreview } = open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('사진을 올리지 못했습니다', 'network'))
    expect(onPreview).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByText('사진 넣기')).toBeTruthy()
  })

  /**
   * 닫고 다른 선수를 연 뒤 앞 업로드가 실패로 끝나도 그 카드를 건드리면 안 된다.
   * 오버레이는 닫힐 때 미리보기를 거두는데, 늦게 온 실패가 새 선수 카드의 미리보기를 또
   * 거두거나 엉뚱한 알림을 띄우면 안 된다.
   */
  it('사라진 뒤 실패한 업로드는 미리보기도 알림도 건드리지 않는다', async () => {
    let fail: (e: Error) => void = () => {}
    mockActions.put.mockReturnValue(new Promise<void>((_resolve, reject) => (fail = reject)))
    const { onPreview } = open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => expect(mockActions.put).toHaveBeenCalled())
    screen.unmount()
    const calls = onPreview.mock.calls.length
    fail(new Error('network'))
    await new Promise(resolve => setImmediate(resolve))
    expect(onPreview.mock.calls.length).toBe(calls)
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('치우기는 확인을 받는다', () => {
    open({ hasPhoto: true })
    fireEvent.press(screen.getByText('치우기'))
    expect(Alert.alert).toHaveBeenCalledWith('사진을 치울까요?', undefined, expect.any(Array))
    expect(mockActions.remove).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/player-photo-editor.test.tsx`
Expected: FAIL — `Cannot find module '@/components/club/PlayerPhotoEditor'`

- [ ] **Step 3: `OverlayAction.tsx` 를 쓰고 팬카드 오버레이가 쓰게 한다**

```tsx
import { StyleSheet, Text } from 'react-native'

import { cornerRadius, fonts, palette, spacing } from '@/styles'
import { PressableScale } from '@/components/foundation/PressableScale'

/** 어두운 오버레이 위의 둥근 단추. 팬카드와 선수 카드가 같이 쓴다 */
export function OverlayAction({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string
  tone?: string
  onPress?: () => void
  disabled?: boolean
}) {
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[styles.action, { borderColor: tone ?? palette.gray['60'], opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={[fonts.label, { color: tone ?? palette.white }]}>{label}</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  action: {
    paddingHorizontal: spacing['300'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
```

`FanCardOverlay.tsx` 에서 `function Action(...)` 과 `styles.action` 을 지우고, `<Action` 두 곳을 `<OverlayAction` 으로 바꾸고 import 를 더한다. 쓰지 않게 된 `cornerRadius`·`PressableScale`·`Text` import 는 지운다(`Text` 는 다른 곳에서 쓰면 남긴다).

- [ ] **Step 4: `PlayerPhotoEditor.tsx` 를 쓴다**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'

import { palette, spacing } from '@/styles'
import { OverlayAction } from '@/components/club/OverlayAction'
import { usePlayerPhotoActions } from '@/hooks/playerPhoto/usePlayerPhotos'
import { cutOut, pickFromLibrary } from '@/utils/pickPhoto'

export interface PlayerPhotoEditorProps {
  playerId: string
  /** 지금 카드에 사진이 있는지. 미리보기까지 친 값이다 */
  hasPhoto: boolean
  /** 카드에 잠깐 보여 줄 파일. null 은 "비움", undefined 는 "미리보기를 거두고 서버 사진을" */
  onPreview: (uri: string | null | undefined) => void
  onRequireLogin: () => void
}

interface Picked {
  raw: string
  cut: string | null
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * 선수 카드에 내 사진을 넣는다.
 *
 * 앨범에서 고르는 것까지만 한다. 앱이 사진을 대신 가져오는 순간 우리가 복제 도구를
 * 내미는 셈이 된다.
 *
 * 올라가기를 기다리지 않고 고른 파일로 카드를 곧바로 그린다. 실패하면 알리고 되돌린다 —
 * 넣은 줄 알았는데 다음에 보니 없는 것이 제일 나쁘다.
 *
 * 원본/누끼 전환은 방금 고른 동안에만 된다. 서버에는 늘 한 장만 두므로, 다시 열면 그
 * 한 장만 남는다 (팬카드와 같은 제약).
 */
export function PlayerPhotoEditor({ playerId, hasPhoto, onPreview, onRequireLogin }: PlayerPhotoEditorProps) {
  const { signedIn, put, remove } = usePlayerPhotoActions(playerId)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [showingCut, setShowingCut] = useState(false)
  const [busy, setBusy] = useState(false)

  // 닫힌 뒤에 끝난 업로드가 다른 선수 카드의 미리보기를 건드리지 않게 한다
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  const upload = useCallback(
    async (uri: string, rollback: () => void) => {
      onPreview(uri)
      setBusy(true)
      try {
        await put(uri)
      } catch (e) {
        if (!alive.current) return
        rollback()
        onPreview(undefined)
        Alert.alert('사진을 올리지 못했습니다', messageOf(e))
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [onPreview, put],
  )

  const choose = useCallback(async () => {
    if (!signedIn) {
      onRequireLogin()
      return
    }
    const raw = await pickFromLibrary()
    if (raw === 'denied') {
      Alert.alert('사진 접근이 필요합니다', '설정에서 사진 접근을 켜면 카드에 넣을 수 있습니다.')
      return
    }
    if (!raw || !alive.current) return

    setBusy(true)
    const cut = await cutOut(raw)
    if (!alive.current) return
    const before = { picked, showingCut }
    setPicked({ raw, cut })
    setShowingCut(cut !== null)
    await upload(cut ?? raw, () => {
      setPicked(before.picked)
      setShowingCut(before.showingCut)
    })
  }, [onRequireLogin, picked, showingCut, signedIn, upload])

  const toggle = useCallback(async () => {
    if (!picked?.cut) return
    const next = !showingCut
    setShowingCut(next)
    await upload(next ? picked.cut : picked.raw, () => setShowingCut(!next))
  }, [picked, showingCut, upload])

  const clear = useCallback(() => {
    Alert.alert('사진을 치울까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '치우기',
        style: 'destructive',
        onPress: () => {
          setBusy(true)
          remove()
            .then(() => {
              if (!alive.current) return
              setPicked(null)
              onPreview(null)
            })
            .catch(e => Alert.alert('치우지 못했습니다', messageOf(e)))
            .finally(() => {
              if (alive.current) setBusy(false)
            })
        },
      },
    ])
  }, [onPreview, remove])

  const filled = hasPhoto || picked !== null

  return (
    <View style={styles.row}>
      {filled ? (
        <>
          <OverlayAction label="바꾸기" onPress={() => void choose()} disabled={busy} />
          {picked?.cut && (
            <OverlayAction
              label={showingCut ? '원본으로' : '누끼로'}
              onPress={() => void toggle()}
              disabled={busy}
            />
          )}
          <OverlayAction label="치우기" tone={palette.red} onPress={clear} disabled={busy} />
        </>
      ) : (
        <OverlayAction label="사진 넣기" onPress={() => void choose()} disabled={busy} />
      )}
      {busy && <ActivityIndicator color={palette.white} />}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'], marginTop: spacing['250'] },
})
```

- [ ] **Step 5: `PlayerCardOverlay.tsx` 에 미리보기와 편집기를 넣는다**

props 에 `onRequireLogin?: () => void` 를 더하고, 본문을 이렇게 바꾼다:

```tsx
import { useEffect, useState } from 'react'
// ... 기존 import 에 더한다
import { PlayerPhotoEditor } from '@/components/club/PlayerPhotoEditor'

export function PlayerCardOverlay({ player, onClose, onRequireLogin }: PlayerCardOverlayProps) {
  const { width, height } = useWindowDimensions()
  /**
   * 올라가는 동안 카드에 보여 줄 파일. undefined 면 넘겨받은 사진을 그대로 쓴다.
   * 닫히면 거둔다 — 다음에 여는 선수에게 남으면 안 된다.
   */
  const [preview, setPreview] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (player === null) setPreview(undefined)
  }, [player])

  const room = { w: width - HIT_PAD * 2, h: height - HIT_PAD * 2 }
  const cardWidth = Math.min(room.w * 0.92, room.h * 0.72 * CARD_ASPECT)
  const shown = player && preview !== undefined ? { ...player, photoUrl: preview } : player

  return (
    <Modal
      visible={player !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="카드 닫기" />

        {shown && (
          <View style={styles.center} pointerEvents="box-none">
            <PlayerCard player={shown} width={cardWidth} />

            <View style={styles.caption} pointerEvents="none">
              <Text style={[fonts.label, styles.tier]}>{tierLabelOf(shown)}</Text>
              <Text style={[fonts.caption, styles.hint]}>카드를 문지르면 빛이 따라옵니다</Text>
            </View>

            {/* 선수 id 가 없으면 사진을 둘 자리를 만들 수 없다 */}
            {shown.playerId && (
              <PlayerPhotoEditor
                key={shown.playerId}
                playerId={shown.playerId}
                hasPhoto={shown.photoUrl !== null}
                onPreview={setPreview}
                onRequireLogin={() => onRequireLogin?.()}
              />
            )}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  )
}
```

`key={shown.playerId}` 는 선수가 바뀌면 편집기를 새로 세워 앞 선수의 고른 사진 상태가 남지 않게 한다.

- [ ] **Step 6: 통과를 확인한다**

Run: `cd steelers-app && npx jest __tests__/player-photo-editor.test.tsx && npx jest && npx tsc --noEmit && npm run lint`
Expected: 새 테스트 PASS, 전체 스위트 PASS

- [ ] **Step 7: 커밋 (사용자에게 묻고)**

```bash
git add src/components/club/OverlayAction.tsx src/components/club/PlayerPhotoEditor.tsx src/components/club/FanCardOverlay.tsx src/components/club/PlayerCardOverlay.tsx __tests__/player-photo-editor.test.tsx
git commit -m "선수 카드에서 내 사진을 넣고 바꾸고 치운다"
```

---

### Task 6: 프로필이 내 사진을 그리고 K리그 사진 주소를 버린다

**Files:**

- Modify: `src/screens/PlayerScreen.tsx` (사진 틀 177-186행, 오버레이 263행, 스타일)
- Modify: `src/services/kleague/clubService.ts:6,50-51`
- Modify: `src/services/kleague/mappers.ts:68-70`
- Test: `__tests__/navigation.test.tsx` 는 그대로 통과해야 한다

**Interfaces:**

- Consumes: Task 3 `usePlayerPhoto`, Task 5 `PlayerCardOverlay` 의 `onRequireLogin`

- [ ] **Step 1: K리그 주소를 지운다**

`mappers.ts` 의 `playerPhotoUrl` 함수(68-70행)를 지운다. `clubService.ts` 6행 import 에서 `playerPhotoUrl` 을 빼고, 50-51행을 지운다:

```ts
      // 스쿼드 API 의 photo_url 은 늘 null 이다. 주소는 선수ID 로 만든다
      photoUrl: playerPhotoUrl(seen.team_id, seen.player_id),
```

`toPlayer` 가 넘기는 `row.photo_url`(늘 null)이 그대로 남아 스쿼드 목록은 전원 실루엣이 된다. 그 자리에 주석을 하나 둔다:

```ts
// 선수 사진은 앱이 내보내지 않는다. 사용자가 넣은 것만 프로필과 카드에서 본다
// (usePlayerPhoto). 목록은 전원 실루엣이다
```

- [ ] **Step 2: 프로필을 바꾼다**

`PlayerScreen` 본문 위쪽에:

```tsx
// 내가 넣은 사진. 목록에는 안 쓰고 여기와 카드에서만 쓴다
const myPhoto = usePlayerPhoto(player?.playerId ?? null)
const shown = useMemo(() => (player ? { ...player, photoUrl: myPhoto } : undefined), [player, myPhoto])

// 카드가 모달이라 덮은 채로 로그인 화면을 밀면 그 뒤에 깔린다. 닫고 나서 민다
const requireLoginFromCard = useCallback(() => {
  setCardOpen(false)
  onRequireLogin?.()
}, [onRequireLogin])
```

사진 틀:

```tsx
;<PlayerPhoto uri={myPhoto} style={styles.photo} />
{
  /* 넣을 수 있다는 표시. 누르는 곳은 틀 전체다 */
}
{
  player?.playerId && (
    <View style={[styles.badge, { backgroundColor: theme.accent }]} pointerEvents="none">
      <Text style={[fonts.label, { color: palette.white }]}>+</Text>
    </View>
  )
}
```

오버레이:

```tsx
<PlayerCardOverlay
  player={cardOpen && shown ? shown : null}
  onClose={() => setCardOpen(false)}
  onRequireLogin={requireLoginFromCard}
/>
```

스타일에 더한다:

```ts
  badge: {
    position: 'absolute',
    right: spacing['050'],
    bottom: spacing['050'],
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

`usePlayerPhoto`, `useCallback`, `useMemo`, `palette` import 를 더한다(이미 있으면 그대로). `photoFrame` 스타일에 `overflow: 'hidden'` 이 있으면 배지가 잘리므로, 있으면 배지를 틀 바깥 형제로 옮기고 틀을 `View` 로 감싼다.

- [ ] **Step 3: 확인한다**

Run: `cd steelers-app && npx tsc --noEmit && npx jest && npm run lint && grep -rn "player-photos\|playerPhotoUrl" src`
Expected: 모두 통과, grep 결과 없음

- [ ] **Step 4: 커밋 (사용자에게 묻고)**

```bash
git add src/screens/PlayerScreen.tsx src/services/kleague/clubService.ts src/services/kleague/mappers.ts
git commit -m "선수 사진을 앱이 내보내지 않고 내가 넣은 것만 그린다"
```

---

### Task 7: 팬카드 사진을 경로로 두고 해석기로 읽는다

**Files:**

- Modify: `src/repositories/fanCard/remote.ts`
- Modify: `src/hooks/fanCard/useFanCards.ts` (`fromRemote` 152-168행, `pullRemote` 196-208행, `pushCard` 211-228행, import 7-14행)
- Modify: `docs/privacy.md` (40행 표, 67-78행)
- Test: `__tests__/fan-card-remote.test.ts`

**Interfaces:**

- Consumes: Task 2 `resolvePrivateImage`, `adoptPrivateImage`, `isPrivateCacheUri`, `dropPrivateImage`; Task 3 `uploadPrivateImage`
- Produces:
  - `RemoteCard` 에서 `photoUrl` 을 빼고 `photoPath: string | null`, `updatedAt: string` 을 더한다
  - `storedPhotoPath(value: string | null): string | null`
  - `uploadCardPhoto(userId, cardId, localUri): Promise<string>` — 경로를 돌려준다
  - `upsertCard(userId, card: RemoteCard)` 는 `photo_path` 를 쓴다
  - `isUploadedPhoto` 는 사라진다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { cardPhotoPath, storedPhotoPath } from '@/repositories/fanCard/remote'
import { SUPABASE_URL } from '@/config/env'

jest.mock('@/repositories/remote/supabase', () => ({
  supabase: { storage: { from: jest.fn() }, auth: { onAuthStateChange: jest.fn() } },
}))

describe('팬카드 사진 경로', () => {
  it('경로는 그대로 읽는다', () => {
    expect(storedPhotoPath('user-1/card-1.jpg')).toBe('user-1/card-1.jpg')
  })

  /** migration 이 놓친 행이 섞여 있어도 앱이 버틴다 */
  it('옛 공개 주소에서 경로만 뽑는다', () => {
    const legacy = `${SUPABASE_URL}/storage/v1/object/public/fan-cards/user-1/card-1.jpg?v=1700000000000`
    expect(storedPhotoPath(legacy)).toBe('user-1/card-1.jpg')
  })

  it('비어 있으면 null', () => {
    expect(storedPhotoPath(null)).toBeNull()
    expect(storedPhotoPath('')).toBeNull()
  })

  /** 맨 앞 칸이 사용자 id 여야 정책이 주인을 가린다. 옛 파일과 같은 이름을 쓴다 */
  it('저장 경로는 바뀌지 않았다', () => {
    expect(cardPhotoPath('user-1', 'card-1')).toBe('user-1/card-1.jpg')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd steelers-app && npx jest __tests__/fan-card-remote.test.ts`
Expected: FAIL — `storedPhotoPath is not a function`

- [ ] **Step 3: `fanCard/remote.ts` 를 바꾼다**

`SUPABASE_URL`·`File` import 는 `storedPhotoPath` 에서만 쓰는지 보고 정리한다. 바뀌는 부분:

```ts
import { supabase } from '@/repositories/remote/supabase'
import { uploadPrivateImage } from '@/repositories/remote/imageUpload'

export const CARD_BUCKET = 'fan-cards'

/** 카드 사진 폭. 선수 사진과 같은 카드에 같은 크기로 얹는다 */
const CARD_PHOTO_WIDTH = 1000

export interface RemoteCard {
  id: string
  name: string
  backNo: string
  tagline: string
  tint: string
  pattern: CardPattern
  effect: ShineKey
  /** 버킷 안 경로. 사진 없이 만든 카드는 null */
  photoPath: string | null
  /** 캐시 파일 이름의 버전으로 쓴다 */
  updatedAt: string
}

interface Row {
  id: string
  name: string
  back_no: string
  tagline: string
  tint: string
  pattern: string
  effect: string
  photo_path: string | null
  updated_at: string
}

const LEGACY_PREFIX = `/storage/v1/object/public/${CARD_BUCKET}/`

/**
 * 표에 적힌 값을 버킷 안 경로로 읽는다.
 *
 * 예전에는 공개 주소를 통째로 적었다. 0019 가 경로로 바꾸지만, 놓친 행이 있어도
 * 사진이 사라지지 않게 여기서 한 번 더 가른다.
 */
export function storedPhotoPath(value: string | null): string | null {
  if (!value) return null
  const at = value.indexOf(LEGACY_PREFIX)
  if (at < 0) return value
  return value.slice(at + LEGACY_PREFIX.length).split('?')[0] || null
}

function toRemote(row: Row): RemoteCard {
  return {
    id: row.id,
    name: row.name,
    backNo: row.back_no,
    tagline: row.tagline,
    tint: row.tint,
    pattern: row.pattern as CardPattern,
    effect: row.effect as ShineKey,
    photoPath: storedPhotoPath(row.photo_path),
    updatedAt: row.updated_at,
  }
}

const COLUMNS = 'id, name, back_no, tagline, tint, pattern, effect, photo_path, updated_at'

/**
 * 기기에 있는 사진을 올리고 버킷 안 경로를 돌려준다.
 *
 * 경로가 카드 id 로 고정이라 같은 카드를 고치면 같은 자리를 덮어쓴다. 버전은 표의
 * updated_at 이 맡으므로 주소 끝에 시각을 달 필요가 없어졌다.
 */
export async function uploadCardPhoto(userId: string, cardId: string, localUri: string): Promise<string> {
  const path = cardPhotoPath(userId, cardId)
  await uploadPrivateImage(CARD_BUCKET, path, localUri, CARD_PHOTO_WIDTH)
  return path
}

export async function upsertCard(userId: string, card: Omit<RemoteCard, 'updatedAt'>): Promise<RemoteCard> {
  const { data, error } = await supabase
    .from('fan_cards')
    .upsert({
      id: card.id,
      owner: userId,
      name: card.name,
      back_no: card.backNo,
      tagline: card.tagline,
      tint: card.tint,
      pattern: card.pattern,
      effect: card.effect,
      photo_path: card.photoPath,
    })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return toRemote(data as Row)
}
```

`isUploadedPhoto` 를 지운다. `listMyCards`, `cardPhotoPath`, `deleteCard` 는 그대로 둔다.

- [ ] **Step 4: `useFanCards.ts` 를 바꾼다**

import 에서 `isUploadedPhoto` 를 빼고 `CARD_BUCKET`, `cardPhotoPath` 를 더한다. `privateImage` 에서 `adoptPrivateImage`, `dropPrivateImage`, `isPrivateCacheUri`, `resolvePrivateImage` 를 가져온다.

```ts
/** 서버 행을 화면이 쓰는 모양으로 옮긴다. 사진은 캐시 파일이 준비된 뒤 채운다 */
function fromRemote(card: RemoteCard, photoUri: string | null): FanCard {
  return {
    id: card.id,
    name: card.name,
    backNo: card.backNo,
    tagline: card.tagline,
    photoUri,
    // 원본·누끼는 기기에만 있던 것이라 서버에서 받은 카드에는 없다.
    // 그래서 누끼 되돌리기는 대기분에서만 쓸 수 있다
    rawPhotoUri: null,
    cutPhotoUri: null,
    tint: card.tint,
    pattern: card.pattern,
    effect: card.effect,
  }
}

const refOf = (card: RemoteCard) =>
  card.photoPath ? { bucket: CARD_BUCKET, path: card.photoPath, version: card.updatedAt } : null

/**
 * 서버 카드를 받는다. 글자는 곧바로 보여 주고 사진은 받는 대로 채운다 —
 * 사진 열 장을 다 받을 때까지 보관함이 비어 있으면 안 된다.
 */
async function pullRemote() {
  if (!userId) {
    remote = []
    emit()
    return
  }
  let rows: RemoteCard[]
  try {
    rows = await listMyCards()
  } catch {
    // 못 받아도 대기분은 그대로 보인다. 다음 로그인/복귀에 다시 시도한다
    return
  }
  remote = rows.map(row => fromRemote(row, null))
  emit()

  for (const row of rows) {
    const ref = refOf(row)
    if (!ref) continue
    const uri = await resolvePrivateImage(ref)
    if (!uri) continue
    remote = remote.map(c => (c.id === row.id ? { ...c, photoUri: uri } : c))
    emit()
  }
}

/**
 * 카드 한 장을 서버에 올린다.
 *
 * 사진이 캐시 파일이면 이미 올라가 있는 것이다. 기기 파일이면 새로 고른 것이라 올린다.
 * 올린 뒤에는 그 파일을 캐시로 옮겨 두어 다음 저장 때 다시 올리지 않는다.
 */
async function pushCard(card: FanCard, owner: string): Promise<FanCard> {
  const fresh = card.photoUri !== null && !isPrivateCacheUri(card.photoUri)
  const photoPath = fresh
    ? await uploadCardPhoto(owner, card.id, card.photoUri!)
    : card.photoUri
      ? cardPhotoPath(owner, card.id)
      : null

  const saved = await upsertCard(owner, {
    id: card.id,
    name: card.name,
    backNo: card.backNo,
    tagline: card.tagline,
    tint: card.tint,
    pattern: card.pattern,
    effect: card.effect,
    photoPath,
  })

  const ref = refOf(saved)
  if (!ref) {
    // 사진을 뺐으면 서버 파일과 캐시도 치운다
    dropPrivateImage({ bucket: CARD_BUCKET, path: cardPhotoPath(owner, card.id) })
    return fromRemote(saved, null)
  }
  // 새로 올렸으면 방금 파일을, 아니면 기존 캐시 파일을 새 버전 이름으로 옮긴다
  return fromRemote(saved, adoptPrivateImage(ref, card.photoUri!))
}
```

사진을 뺐을 때 서버 파일 지우기는 지금 코드에도 없다(범위 밖). `dropPrivateImage` 는 캐시만 치운다.

- [ ] **Step 5: 개인정보 방침을 고친다**

`docs/privacy.md` 40행 뒤에 한 줄을 더한다:

```
| 선수 사진(직접 넣은 것)                          | **본인만** 볼 수 있습니다                             |
```

2절 표의 "본인만" 줄을 `| 본인만                                 | 팬카드, 직접 넣은 선수 사진, 차단 목록 |` 로 바꾸고(표 폭은 prettier 가 맞춘다), 75-78행 문단을 이것으로 바꾼다:

```
**이미지 주소에 관한 안내.** 프로필 이미지는 파일 보관소에 저장되며, 그 **주소를 아는
사람은 로그인 없이도 이미지를 열 수 있습니다.** 주소에는 임의의 문자열이 들어가 추측하기
어렵지만, 주소 자체가 외부로 알려지면 막을 수 없습니다. 팬카드 사진과 직접 넣은 선수
사진은 본인만 열 수 있는 보관소에 두며, 앱은 잠깐만 유효한 주소로 한 번 내려받아 기기에
보관합니다.
```

- [ ] **Step 6: 확인한다**

Run: `cd steelers-app && npx prettier --write docs/privacy.md && npx jest && npx tsc --noEmit && npm run lint && grep -rn "getPublicUrl\|object/public" src`
Expected: 모두 통과. grep 결과는 `src/hooks/auth/avatar.ts` 와 `src/services/kleague/mappers.ts` 의 `news-thumbs`(범위 밖)뿐

- [ ] **Step 7: 커밋 (사용자에게 묻고)**

```bash
git add src/repositories/fanCard/remote.ts src/hooks/fanCard/useFanCards.ts docs/privacy.md __tests__/fan-card-remote.test.ts
git commit -m "팬카드 사진을 본인만 여는 보관소에서 읽는다"
```

---

### Task 8: 전체 검증

- [ ] **Step 1: 전체를 돌린다**

Run: `cd steelers-app && npx tsc --noEmit && npm run lint && npx jest`
Expected: 전부 통과. 실패하면 멈추고 출력을 그대로 보고한다

- [ ] **Step 2: 남은 공개 주소를 센다**

Run: `cd steelers-app && grep -rn "getPublicUrl\|object/public\|player-photos\|playerPhotoUrl\|isUploadedPhoto" src`
Expected: `avatar.ts` 와 `news-thumbs` 만

---

### Task 9: migration 적용과 기기 확인 (사용자와 함께)

- [ ] **Step 1: 사용자에게 migration 을 청한다**

`supabase/migrations/0019_private_photos.sql` 전체를 Supabase SQL Editor 에 붙여 넣어 돌려 달라고 한다. 돌렸다는 답을 받을 때까지 다음 단계로 가지 않는다.

- [ ] **Step 2: 적용을 확인한다**

```bash
cd steelers-app && set -a && . ./.env && set +a
# 옛 팬카드 공개 주소가 더는 열리지 않아야 한다 (400 또는 404)
curl -s -o /dev/null -w '%{http_code}\n' "$EXPO_PUBLIC_SUPABASE_URL/storage/v1/object/public/fan-cards/x/y.jpg"
# 로그인 없이 선수 사진 버킷을 나열하면 빈 배열이어야 한다
curl -s -X POST "$EXPO_PUBLIC_SUPABASE_URL/storage/v1/object/list/my-player-photos" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_KEY" -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_KEY" \
  -H 'Content-Type: application/json' -d '{"prefix":"","limit":10}'
```

Expected: 첫 줄 `400`, 둘째 `[]`. 사용자에게 SQL Editor 에서 `select count(*) from public.fan_cards where photo_path like 'http%';` 가 0 인지도 봐 달라고 한다.

- [ ] **Step 3: 폰에 설치한다**

Run: `cd steelers-app && npx expo run:ios --configuration Release --device 00008130-001225AC01F2001C`
Expected: 빌드 성공, 설치. 실패하면 로그 끝부분을 보고한다

- [ ] **Step 4: 사용자에게 기기 확인을 청한다**

다음을 차례로 해 달라고 한다:

1. 선수 프로필 → 카드 → 사진 넣기 → 누끼가 보인다 → 원본으로/누끼로 전환
2. 앱을 완전히 끄고 다시 켜 같은 선수를 연다 → 사진이 남아 있다
3. 치우기 → 실루엣
4. 팬카드 보관함 → 기존 카드 사진이 보인다, 새 카드를 사진과 함께 저장한다
5. 로그아웃 → 다른 계정으로 로그인 → 앞 사람의 선수 사진·팬카드가 안 보인다
6. 스쿼드 목록 → 전원 실루엣

하나라도 어긋나면 그 증상을 받아 superpowers:systematic-debugging 으로 넘어간다.

---

### Task 10: 옛 선수 사진 정리 (되돌릴 수 없음 — 사용자 확인 필수)

**Files:**

- Delete: `supabase/functions/collect-player-photos/` (index.ts, logic.ts)
- Delete: `supabase/functions/_shared/kleague/photo-client.ts`
- Modify: `supabase/functions/_shared/image.ts` 는 `collect-news-thumbs` 가 쓰므로 **남긴다**

- [ ] **Step 1: 지울 것을 보여 주고 확인을 받는다**

`player-photos` 버킷 객체 수, 함수 `collect-player-photos`, 코드 두 곳을 나열하고 "지워도 될까요?" 를 묻는다. 답을 받기 전에는 아무것도 지우지 않는다.

- [ ] **Step 2: 크론에 남은 잡이 있는지 사용자에게 봐 달라고 한다**

SQL Editor: `select jobname, schedule from cron.job where command like '%collect-player-photos%';`
Expected: 0행. 행이 있으면 `select cron.unschedule('<jobname>');` 도 함께 청한다.

- [ ] **Step 3: 버킷을 비우고 지운다**

관리 API 로 service_role 키를 받아 스토리지 API 를 부른다. 키는 화면에 찍지 않는다.

```bash
cd steelers-app && set -a && . ./.env && set +a
KEY=$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys?reveal=true" \
  | python3 -c "import json,sys;print(next(k['api_key'] for k in json.load(sys.stdin) if k['name']=='service_role'))")
curl -s -X POST "$EXPO_PUBLIC_SUPABASE_URL/storage/v1/bucket/player-photos/empty" -H "Authorization: Bearer $KEY" -H "apikey: $KEY"
curl -s -X DELETE "$EXPO_PUBLIC_SUPABASE_URL/storage/v1/bucket/player-photos" -H "Authorization: Bearer $KEY" -H "apikey: $KEY"
```

Expected: 두 응답 모두 `{"message":"Successfully ..."}`. `empty` 가 비동기라 삭제가 "not empty" 로 실패하면 10초 뒤 한 번 더 부른다. api-keys 가 403 이면 멈추고 대시보드(Storage → player-photos → Delete bucket)에서 지워 달라고 청한다.

- [ ] **Step 4: 함수를 지운다**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions/collect-player-photos"
```

Expected: `200`

- [ ] **Step 5: 코드를 지우고 확인한다**

```bash
cd steelers-app && git rm -r supabase/functions/collect-player-photos supabase/functions/_shared/kleague/photo-client.ts
grep -rn "photo-client\|collect-player-photos\|player-photos" supabase scripts src docs --include='*' | grep -v "docs/superpowers"
deno check supabase/functions/*/index.ts && deno test --allow-read --no-lock supabase/functions
curl -s -o /dev/null -w '%{http_code}\n' "$EXPO_PUBLIC_SUPABASE_URL/storage/v1/object/public/player-photos/2026/K03/20060066.webp"
git checkout -- deno.lock 2>/dev/null || true
```

Expected: grep 은 migration 주석(0010)만, deno 검사·테스트 통과, 마지막 줄 `400` 또는 `404`. `scripts/` 나 `deno.json` 태스크가 지운 파일을 부르면 함께 고친다.

- [ ] **Step 6: 커밋 (사용자에게 묻고)**

```bash
git commit -m "K리그에서 모아 두던 선수 사진과 그 수집기를 걷어낸다"
```

---

## 스펙 대비 메모

- 스펙은 누끼·고르기를 훅(`usePickedPhoto`)으로 뺀다고 적었다. 두 화면이 쓰는 방식이 달라(카드 만들기는 문서 폴더로 옮기고, 선수 카드는 곧바로 올린다) 상태를 품는 훅 대신 함수 두 개(`pickFromLibrary`, `cutOut`)로 뺐다. 동작은 같다.
- 스펙의 "올리는 중 세션 만료 → 로그인을 청한다" 는 따로 가르지 않는다. 만료되면 업로드가 오류를 내고 "사진을 올리지 못했습니다" 로 알린다. 사용자가 다시 누르면 `signedIn` 이 false 라 로그인을 청한다.

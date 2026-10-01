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
  // Directory.uri 는 끝에 '/' 가 붙어 온다. 안 붙은 판이 와도 같게 본다
  const root = rootDir().uri
  return uri.startsWith(root.endsWith('/') ? root : `${root}/`)
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

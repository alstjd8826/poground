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

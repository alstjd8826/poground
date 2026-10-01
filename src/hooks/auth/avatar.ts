import { File } from 'expo-file-system'
import * as ImageManipulator from 'expo-image-manipulator'

import { supabase } from '@/repositories/remote/supabase'
import { SUPABASE_URL } from '@/config/env'

export { normalizeKakaoAvatar } from '@/utils/kakaoAvatar'

/**
 * 프로필 이미지 올리기.
 *
 * 카카오가 준 사진 주소를 그대로 쓸 수도 있지만, 그건 카카오 계정을 바꾸면 따라
 * 바뀌고 동의를 거부하면 아예 없다. 직접 올린 것은 우리 것이라 그런 흔들림이 없다.
 */

export const AVATAR_BUCKET = 'avatars'

/** 화면에 쓰는 크기의 두 배. 레티나에서 뭉개지지 않는 선까지만 키운다 */
const SIZE = 512

/**
 * 512px 정사각형 JPEG 으로 줄인다.
 *
 * 줄이지 않으면 요즘 폰 사진이 그대로 올라간다 — 12MP 한 장이 3~5MB 다.
 * 목록에서 40px 로 보여 줄 이미지에 그만한 값을 치를 이유가 없고, 버킷에 걸어 둔
 * 2MB 제한에도 걸린다.
 */
async function shrink(uri: string): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri).resize({
    width: SIZE,
    height: SIZE,
  })
  const image = await context.renderAsync()
  const result = await image.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.8,
  })
  return result.uri
}

/**
 * 저장 경로.
 *
 * 맨 앞 칸이 사용자 id 여야 한다 — 스토리지 정책이 그 칸만 보고 주인을 가린다
 * (0008_avatars.sql).
 *
 * 이름에 시각을 넣는다. 같은 이름으로 덮으면 CDN 이 예전 이미지를 한동안 계속
 * 내보내서, 바꿨는데 안 바뀐 것처럼 보인다.
 */
export function avatarPath(userId: string, now = Date.now()): string {
  return `${userId}/${now}.jpg`
}

/** 우리 버킷에 있는 파일인지. 카카오가 준 주소는 지우면 안 된다 */
export function isOwnAvatar(url: string | null): boolean {
  if (!url) return false
  return url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/`)
}

/** 공개 주소에서 버킷 안 경로만 되찾는다. 옛 파일을 지울 때 쓴다 */
export function pathFromPublicUrl(url: string): string | null {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/`
  if (!url.startsWith(prefix)) return null
  // 캐시 무력화용 쿼리가 붙어 올 수 있다
  return url.slice(prefix.length).split('?')[0] || null
}

/**
 * 골라 온 사진을 올리고 공개 주소를 돌려준다.
 *
 * 올리기가 성공한 **뒤에** 옛 파일을 지운다. 먼저 지우면 업로드가 실패했을 때
 * 프로필 이미지가 사라진 채로 남는다.
 */
export async function uploadAvatar(
  userId: string,
  localUri: string,
  previousUrl: string | null,
): Promise<string> {
  const small = await shrink(localUri)
  const bytes = await new File(small).arrayBuffer()
  const path = avatarPath(userId)

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)

  // 옛 파일 정리. 실패해도 새 이미지는 이미 올라갔으므로 막지 않는다
  if (isOwnAvatar(previousUrl)) {
    const old = pathFromPublicUrl(previousUrl!)
    if (old && old !== path) {
      await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([old])
        .catch(() => {})
    }
  }

  return data.publicUrl
}

/** 올린 사진을 치운다. 카카오가 준 주소로 되돌아간다 */
export async function removeAvatar(previousUrl: string | null): Promise<void> {
  if (!isOwnAvatar(previousUrl)) return
  const path = pathFromPublicUrl(previousUrl!)
  if (!path) return
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path])
  if (error) throw error
}

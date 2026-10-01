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

/**
 * 올린다. 기본은 같은 경로를 덮어쓴다 — 원본과 누끼를 오가도 서버에는 늘 한 장이다.
 *
 * 게시글 사진은 upsert 를 끈다. 덮어쓰기는 스토리지가 읽기 정책까지 요구하는데, 새 글은 아직
 * 글이 없어 읽기 정책을 넘지 못한다. 이름이 사진마다 새 uuid 라 덮을 일도 없다.
 */
export async function uploadPrivateImage(
  bucket: string,
  path: string,
  localUri: string,
  maxWidth: number,
  options: { upsert?: boolean } = {},
): Promise<void> {
  const { bytes, contentType } = await prepare(localUri, maxWidth)
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert: options.upsert ?? true })
  if (error) throw error
}

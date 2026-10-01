import * as ImagePicker from 'expo-image-picker'
import { removeBackground } from '@six33/react-native-bg-removal'

/**
 * 앨범에서 고른다. 카드 만들기와 선수 카드가 같이 쓴다. 카메라로 찍는 길은 없다 — 글 사진도 앨범에서만(2026-09-29).
 *
 * 카드에 들어가는 자리가 3:4 라 기본은 그 비율로 자르게 한다. 직관 사진처럼 원본 비율
 * 그대로 쓸 때는 null 을 준다.
 */
export async function pickFromLibrary(
  aspect: [number, number] | null = [3, 4],
): Promise<string | 'denied' | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'denied'
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: aspect !== null,
    ...(aspect ? { aspect } : {}),
    quality: 0.9,
  })
  if (picked.canceled || !picked.assets[0]) return null
  return picked.assets[0].uri
}

/** 앨범에서 고른 사진. assetId 는 앨범 속 사진의 id — 고를 때마다 바뀌는 주소와 달리 같은 사진이면 같다 */
export interface PickedPhoto {
  uri: string
  assetId: string | null
}

/**
 * 앨범에서 여러 장 고른다. 게시글이 쓴다. 자르지 않는다 — 경기장 사진은 가로가 많다.
 *
 * 남은 자리만큼만 고르게 한다. 더 고르게 두고 뒤에서 버리면 무엇이 빠졌는지 알 수 없다.
 */
export async function pickManyFromLibrary(limit: number): Promise<PickedPhoto[] | 'denied'> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'denied'
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 0.9,
  })
  if (picked.canceled || !picked.assets) return []
  return picked.assets.map(a => ({ uri: a.uri, assetId: a.assetId ?? null }))
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

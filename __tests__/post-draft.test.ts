import * as ImagePicker from 'expo-image-picker'

import {
  BODY_MAX,
  canSubmit,
  draftFromPost,
  draftReducer,
  emptyDraft,
  type PostDraft,
  roomForPhotos,
} from '@/models/postDraft'
import type { Post } from '@/models/community'
import { pickManyFromLibrary } from '@/utils/pickPhoto'

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))
jest.mock('@six33/react-native-bg-removal', () => ({ removeBackground: jest.fn() }))

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>
const add = (d: PostDraft, ...uris: string[]) =>
  draftReducer(d, { type: 'addPhotos', photos: uris.map(uri => ({ uri, assetId: null })) })
const keys = (d: PostDraft) => d.photos.map(p => p.key)

describe('사진', () => {
  it('4장을 넘기면 앞의 것만 받는다', () => {
    const d = add(emptyDraft(), 'a', 'b', 'c', 'd', 'e')
    expect(keys(d)).toEqual(['a', 'b', 'c', 'd'])
    expect(roomForPhotos(d)).toBe(0)
  })

  it('이미 있는 사진은 다시 넣지 않는다', () => {
    expect(keys(add(add(emptyDraft(), 'a'), 'a', 'b'))).toEqual(['a', 'b'])
  })

  /** iOS 는 고를 때마다 사진을 새 임시 파일로 복사한다. 주소가 달라도 앨범의 같은 사진이면 한 장만 */
  it('앨범의 같은 사진은 주소가 달라도 다시 넣지 않는다', () => {
    const first = draftReducer(emptyDraft(), {
      type: 'addPhotos',
      photos: [{ uri: 'tmp/1.jpg', assetId: 'A' }],
    })
    const again = draftReducer(first, {
      type: 'addPhotos',
      photos: [
        { uri: 'tmp/2.jpg', assetId: 'A' },
        { uri: 'tmp/3.jpg', assetId: 'B' },
      ],
    })
    expect(again.photos.map(p => (p.kind === 'local' ? p.uri : p.path))).toEqual(['tmp/1.jpg', 'tmp/3.jpg'])
  })

  it('빼면 자리가 난다', () => {
    const d = draftReducer(add(emptyDraft(), 'a', 'b'), { type: 'removePhoto', key: 'a' })
    expect(keys(d)).toEqual(['b'])
    expect(roomForPhotos(d)).toBe(3)
  })

  it('앞뒤로 옮긴다. 끝에서는 그대로다', () => {
    const d = add(emptyDraft(), 'a', 'b', 'c')
    expect(keys(draftReducer(d, { type: 'movePhoto', key: 'b', by: -1 }))).toEqual(['b', 'a', 'c'])
    expect(keys(draftReducer(d, { type: 'movePhoto', key: 'c', by: 1 }))).toEqual(['a', 'b', 'c'])
  })
})

describe('본문', () => {
  it('1,000자에서 자른다', () => {
    const d = draftReducer(emptyDraft(), { type: 'setBody', body: 'x'.repeat(BODY_MAX + 5) })
    expect(d.body).toHaveLength(BODY_MAX)
  })
})

describe('올릴 수 있는지', () => {
  it('공백뿐이면 안 된다', () => {
    expect(canSubmit(draftReducer(emptyDraft(), { type: 'setBody', body: '   ' }))).toBe(false)
  })

  /** 직관 글은 본문의 #직관 으로 가른다. 경기를 안 골라도 올릴 수 있다 */
  it('#직관 만 있어도 올릴 수 있다', () => {
    expect(canSubmit(draftReducer(emptyDraft(), { type: 'setBody', body: '#직관' }))).toBe(true)
  })
})

describe('고칠 글에서 초안 만들기', () => {
  it('사진·본문·공개 설정을 옮긴다', () => {
    const post = {
      body: '본문',
      visibility: 'private',
      match: { year: 2026, leagueId: 1, gameId: 180 },
      photos: [
        { position: 0, path: 'u/p/a' },
        { position: 1, path: 'u/p/b' },
      ],
    } as Post
    expect(draftFromPost(post)).toEqual({
      body: '본문',
      visibility: 'private',
      photos: [
        { kind: 'remote', key: 'u/p/a', path: 'u/p/a' },
        { kind: 'remote', key: 'u/p/b', path: 'u/p/b' },
      ],
    })
  })
})

describe('앨범에서 여러 장', () => {
  it('남은 자리만큼만 고르게 하고 자르지 않는다', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never)
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'a', assetId: 'A' }, { uri: 'b' }],
    } as never)
    await expect(pickManyFromLibrary(2)).resolves.toEqual([
      { uri: 'a', assetId: 'A' },
      { uri: 'b', assetId: null },
    ])
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 2, allowsEditing: false }),
    )
  })

  it('권한이 없으면 알린다', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never)
    await expect(pickManyFromLibrary(4)).resolves.toBe('denied')
  })

  it('취소하면 빈 목록', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never)
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never)
    await expect(pickManyFromLibrary(4)).resolves.toEqual([])
  })
})

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

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

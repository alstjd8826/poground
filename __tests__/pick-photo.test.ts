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

describe('자르지 않고 고르기', () => {
  it('비율을 null 로 주면 자르지 않는다', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///wide.jpg' }] })
    await pickFromLibrary(null)
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }))
  })
})

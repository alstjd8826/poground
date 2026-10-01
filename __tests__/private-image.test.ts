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
  // 실제 Directory.uri 는 끝에 '/' 가 붙는다 (iOS 는 isDirectory URL, 안드로이드는 직접 붙인다).
  // 이어 붙일 때는 떼고 잇는다
  const trim = (u: string) => u.replace(/\/+$/, '')
  const uriOf = (parts: unknown[]) =>
    parts.map(p => trim(typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/')

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
    base: string
    uri: string
    constructor(...parts: unknown[]) {
      this.base = uriOf(parts)
      this.uri = `${this.base}/`
    }
    get exists() {
      return dirs.has(this.base)
    }
    // intermediates 처럼 위쪽 폴더까지 세운다. 실제 파일시스템이 그렇다
    create() {
      const segments = this.base.split('/')
      for (let i = 3; i <= segments.length; i++) dirs.add(segments.slice(0, i).join('/'))
    }
    delete() {
      for (const f of [...files]) if (f.startsWith(`${this.base}/`)) files.delete(f)
      for (const d of [...dirs]) if (d === this.base || d.startsWith(`${this.base}/`)) dirs.delete(d)
    }
    list() {
      return [...files].filter(f => f.slice(0, f.lastIndexOf('/')) === this.base).map(f => new File(f))
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

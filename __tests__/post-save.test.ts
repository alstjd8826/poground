import { deletePost, postPhotoPath, savePost } from '@/repositories/community/remote'
import type { PostDraft } from '@/models/postDraft'

const mockUpload = jest.fn()
jest.mock('@/repositories/remote/imageUpload', () => ({
  uploadPrivateImage: (...args: unknown[]) => mockUpload(...args),
}))

const mockRpc = jest.fn()
const mockRemove = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/repositories/remote/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: { from: () => ({ remove: (...args: unknown[]) => mockRemove(...args) }) },
    from: () => ({
      update: (patch: unknown) => {
        mockUpdate(patch)
        return { eq: async () => ({ error: null }) }
      },
    }),
  },
}))

const ME = 'me-uid'
const POST = 'post-id'
const draft = (over: Partial<PostDraft> = {}): PostDraft => ({
  photos: [],
  body: '  직관 다녀왔다  ',
  visibility: 'public',
  ...over,
})

let ids: string[]
const newId = () => ids.shift()!

beforeEach(() => {
  ids = ['n1', 'n2', 'n3']
  mockUpload.mockReset().mockResolvedValue(undefined)
  mockRpc.mockReset().mockResolvedValue({ data: '2026-09-29T00:00:00Z', error: null })
  mockRemove.mockReset().mockResolvedValue({ error: null })
  mockUpdate.mockReset()
})

describe('사진 경로', () => {
  it('사용자 폴더, 글 폴더, 사진 이름 순이다', () => {
    expect(postPhotoPath('u', 'p', 'x')).toBe('u/p/x')
  })
})

describe('글 저장', () => {
  it('새 사진만 올리고 보여 줄 순서대로 경로를 넘긴다', async () => {
    await savePost(
      {
        postId: POST,
        userId: ME,
        match: null,
        previousPaths: [`${ME}/${POST}/old`],
        draft: draft({
          photos: [
            { kind: 'local', key: 'a', uri: 'file:///a.jpg' },
            { kind: 'remote', key: 'old', path: `${ME}/${POST}/old` },
          ],
        }),
      },
      newId,
    )
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpload.mock.calls[0]!.slice(0, 3)).toEqual([
      'post-photos',
      `${ME}/${POST}/n1`,
      'file:///a.jpg',
    ])
    expect(mockRpc).toHaveBeenCalledWith('save_post', {
      p_id: POST,
      p_body: '직관 다녀왔다',
      p_visibility: 'public',
      p_match_year: null,
      p_match_league_id: null,
      p_match_game_id: null,
      p_paths: [`${ME}/${POST}/n1`, `${ME}/${POST}/old`],
    })
  })

  /** 새 글은 아직 글이 없어 읽기 정책을 못 넘는다. 덮어쓰기(upsert)는 읽기 정책도 요구한다 */
  it('덮어쓰기 없이 올린다', async () => {
    await savePost(
      {
        postId: POST,
        userId: ME,
        match: null,
        previousPaths: [],
        draft: draft({ photos: [{ kind: 'local', key: 'a', uri: 'a' }] }),
      },
      newId,
    )
    expect(mockUpload.mock.calls[0]![4]).toEqual({ upsert: false })
  })

  it('경기가 없으면 경기 키를 비워 보낸다', async () => {
    await savePost({ postId: POST, userId: ME, previousPaths: [], match: null, draft: draft() }, newId)
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({ p_match_year: null, p_match_game_id: null })
  })

  it('경기 태그로 찾은 경기 키를 보낸다', async () => {
    await savePost(
      {
        postId: POST,
        userId: ME,
        previousPaths: [],
        match: { year: 2026, leagueId: 1, gameId: 180 },
        draft: draft({ body: '#직관 #9월20일서울전' }),
      },
      newId,
    )
    expect(mockRpc.mock.calls[0]![1]).toMatchObject({
      p_match_year: 2026,
      p_match_league_id: 1,
      p_match_game_id: 180,
    })
  })

  it('저장 뒤 뺀 사진 파일을 지우고, 뺀 경로를 돌려준다', async () => {
    const saved = await savePost(
      { postId: POST, userId: ME, match: null, previousPaths: [`${ME}/${POST}/gone`], draft: draft() },
      newId,
    )
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/gone`])
    expect(saved.removed).toEqual([`${ME}/${POST}/gone`])
  })

  it('사진 하나가 실패하면 글을 만들지 않고 올라간 사진을 지운다', async () => {
    mockUpload.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('network'))
    await expect(
      savePost(
        {
          postId: POST,
          userId: ME,
          match: null,
          previousPaths: [],
          draft: draft({
            photos: [
              { kind: 'local', key: 'a', uri: 'a' },
              { kind: 'local', key: 'b', uri: 'b' },
            ],
          }),
        },
        newId,
      ),
    ).rejects.toThrow('network')
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/n1`])
  })

  it('글 저장이 실패하면 올라간 사진을 지운다', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('rls') })
    await expect(
      savePost(
        {
          postId: POST,
          userId: ME,
          match: null,
          previousPaths: [],
          draft: draft({ photos: [{ kind: 'local', key: 'a', uri: 'a' }] }),
        },
        newId,
      ),
    ).rejects.toThrow('rls')
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/n1`])
  })

  /** 고치는 사이 글이 지워졌으면 update 는 0 행이고 이어지는 insert 가 기본 키에 걸린다(0024) */
  it('고칠 글이 없어졌으면 기본 키 오류 대신 글을 찾을 수 없다고 한다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "posts_pkey"' },
    })
    await expect(
      savePost({ postId: POST, userId: ME, match: null, previousPaths: [], draft: draft() }, newId),
    ).rejects.toThrow('글을 찾을 수 없습니다')
  })

  /** 글은 이미 새 사진을 가리킨다. 여기서 새 사진까지 지우면 방금 저장한 글이 깨진다 */
  it('옛 사진 정리가 실패해도 새 사진은 지우지 않는다', async () => {
    mockRemove.mockRejectedValue(new Error('storage'))
    const saved = await savePost(
      {
        postId: POST,
        userId: ME,
        match: null,
        previousPaths: [`${ME}/${POST}/gone`],
        draft: draft({ photos: [{ kind: 'local', key: 'a', uri: 'a' }] }),
      },
      newId,
    )
    expect(mockRemove).toHaveBeenCalledTimes(1)
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/gone`])
    expect(saved).toEqual({
      id: POST,
      updatedAt: '2026-09-29T00:00:00Z',
      uploaded: [{ path: `${ME}/${POST}/n1`, localUri: 'a' }],
      removed: [`${ME}/${POST}/gone`],
    })
  })
})

describe('글 지우기', () => {
  it('지운 표시를 하고 사진 파일을 치운다', async () => {
    await deletePost({ id: POST, photos: [{ position: 0, path: `${ME}/${POST}/x` }] })
    expect(mockUpdate).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(mockRemove).toHaveBeenCalledWith([`${ME}/${POST}/x`])
  })

  it('사진 정리가 실패해도 지우기는 끝난다', async () => {
    mockRemove.mockRejectedValue(new Error('storage'))
    await expect(deletePost({ id: POST, photos: [{ position: 0, path: 'x' }] })).resolves.toBeUndefined()
  })
})

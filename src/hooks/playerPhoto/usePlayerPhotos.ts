import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/auth/useAuth'
import {
  listMyPlayerPhotos,
  PLAYER_PHOTO_BUCKET,
  type PhotoVersions,
  playerPhotoPath,
  removePlayerPhoto,
  uploadPlayerPhoto,
} from '@/repositories/playerPhoto/remote'
import { adoptPrivateImage, dropPrivateImage, resolvePrivateImage } from '@/repositories/remote/privateImage'

/**
 * 내가 사진을 넣은 선수 목록의 질의 열쇠.
 *
 * 누구의 답인지 열쇠에 넣는다 (adminKey 와 같은 이유). 안 넣으면 로그아웃 뒤나 다른
 * 사람이 로그인했을 때 앞 사람의 목록을 물려받는다. 목록에는 주소가 없어서 기기에
 * 저장돼도 만료될 것이 없다.
 */
export const myPlayerPhotosKey = (userId: string | null) => ['myPlayerPhotos', userId] as const

const EMPTY: PhotoVersions = {}

export function useMyPlayerPhotos(): PhotoVersions {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const query = useQuery({
    queryKey: myPlayerPhotosKey(userId),
    queryFn: () => listMyPlayerPhotos(userId!),
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  })
  // 못 받았으면 사진 없음으로 본다. 실루엣이 나오고 카드는 막히지 않는다
  return (userId !== null && query.data) || EMPTY
}

/** 선수 한 명의 사진 파일. 없거나 못 받았으면 null */
export function usePlayerPhoto(playerId: string | null): string | null {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const versions = useMyPlayerPhotos()
  const version = playerId ? versions[playerId] : undefined
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !playerId || !version) {
      setUri(null)
      return
    }
    let alive = true
    void resolvePrivateImage({
      bucket: PLAYER_PHOTO_BUCKET,
      path: playerPhotoPath(userId, playerId),
      version,
    }).then(next => {
      if (alive) setUri(next)
    })
    return () => {
      alive = false
    }
  }, [userId, playerId, version])

  return uri
}

export function usePlayerPhotoActions(playerId: string | null) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  // 기다리는 사이 로그인이 바뀌었는지 보려고 지금 사람을 붙잡아 둔다
  const current = useRef(userId)
  useEffect(() => {
    current.current = userId
  }, [userId])

  /**
   * 올리고 나서 목록을 다시 받아 새 버전을 안다. 그 이름으로 방금 고른 파일을 캐시에
   * 옮겨 두어 올린 것을 다시 내려받지 않는다.
   *
   * 올라갔으면 성공이다. 뒤따르는 것은 다시 받지 않으려는 손질이라, 실패하면 목록만 다음에
   * 다시 받게 둔다 — 서버에 새 사진이 있는데 "올리지 못했다" 고 되돌리면 안 된다.
   * 그 사이 로그아웃했으면 캐시에 적지 않는다. 로그아웃이 비운 자리를 다시 채우게 된다.
   */
  const put = useCallback(
    async (localUri: string) => {
      if (!userId || !playerId) throw new Error('로그인이 필요합니다')
      await uploadPlayerPhoto(userId, playerId, localUri)
      if (current.current !== userId) return
      try {
        const versions = await listMyPlayerPhotos(userId)
        if (current.current !== userId) return
        const version = versions[playerId]
        if (version) {
          adoptPrivateImage(
            { bucket: PLAYER_PHOTO_BUCKET, path: playerPhotoPath(userId, playerId), version },
            localUri,
          )
        }
        queryClient.setQueryData(myPlayerPhotosKey(userId), versions)
      } catch {
        void queryClient.invalidateQueries({ queryKey: myPlayerPhotosKey(userId) })
      }
    },
    [playerId, queryClient, userId],
  )

  const remove = useCallback(async () => {
    if (!userId || !playerId) return
    await removePlayerPhoto(userId, playerId)
    dropPrivateImage({ bucket: PLAYER_PHOTO_BUCKET, path: playerPhotoPath(userId, playerId) })
    queryClient.setQueryData<PhotoVersions>(myPlayerPhotosKey(userId), prev => {
      const next = { ...prev }
      delete next[playerId]
      return next
    })
  }, [playerId, queryClient, userId])

  return { signedIn: userId !== null, put, remove }
}

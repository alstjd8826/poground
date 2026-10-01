import { videoRepository } from '@/repositories/kleague/videoRepository'
import type { VideoClip } from '@/models/kleague'
import { toVideoClips } from './mappers'

/** 영상 탭의 "전체" 는 카테고리를 걸지 않는다는 뜻이다. 화면의 문자열을 도메인으로 옮긴다. */
export const ALL_CATEGORY = 'all'

export async function getVideos(category?: string): Promise<VideoClip[]> {
  const rows = await videoRepository.findRecent(category === ALL_CATEGORY ? undefined : category)
  return toVideoClips(rows)
}

/** 한 경기의 영상. 하이라이트를 먼저 보여준다. */
export async function getMatchVideos(round: number): Promise<VideoClip[]> {
  const videos = toVideoClips(await videoRepository.findByRound(round))
  // 하이라이트 → 골 → 나머지
  const rank = (c: string | null) => {
    if (c === 'highlight') return 0
    if (c === 'goal') return 1
    return 2
  }
  return [...videos].sort((a, b) => rank(a.category) - rank(b.category))
}

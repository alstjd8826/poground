import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type JobResult, upsertAll } from "../_shared/runner.ts";
import { fetchVideoList, type VideoCategory } from "../_shared/kleague/news-client.ts";
import { toVideoRow, type VideoRow } from "../_shared/kleague/mappers.ts";

/**
 * goal/highlight 는 포항 경기만, club 은 포항 구단 콘텐츠만 모은다.
 * 목록 썸네일이 i.ytimg.com/vi/{id}/ 라서 youtubeId 가 목록에서 바로 나온다.
 * video_view.do 를 건별로 열 필요가 없다.
 */
export const PROBES: Array<{ category: VideoCategory; searchWord: string; pages: number }> = [
  { category: "goal", searchWord: "포항", pages: 1 },
  { category: "highlight", searchWord: "포항", pages: 1 },
  { category: "club", searchWord: "포항스틸러스", pages: 1 },
];

export async function collectVideos(): Promise<VideoRow[]> {
  const bySeq = new Map<number, VideoRow>();
  for (const probe of PROBES) {
    for (let page = 1; page <= probe.pages; page++) {
      const items = await fetchVideoList({ category: probe.category, searchWord: probe.searchWord, page });
      for (const item of items) bySeq.set(item.seq, toVideoRow(item));
    }
  }
  return [...bySeq.values()];
}

export async function runCollectVideos(db: SupabaseClient): Promise<JobResult> {
  const rows = await collectVideos();
  if (rows.length === 0) throw new Error("영상이 0건입니다 (셀렉터가 깨졌을 수 있음)");

  const withId = rows.filter((r) => r.youtube_id);
  const upserted = await upsertAll(db, "videos", rows, "seq");

  return {
    fetched: rows.length,
    upserted,
    // 썸네일이 유튜브가 아닌 항목이 늘면 목록에서 ID 를 못 뽑고 있다는 신호다.
    detail: { withYoutubeId: withId.length, missingId: rows.length - withId.length },
  };
}

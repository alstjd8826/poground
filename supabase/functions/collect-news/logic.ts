import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type JobResult, upsertAll } from "../_shared/runner.ts";
import { fetchNewsList, type NewsCategory } from "../_shared/kleague/news-client.ts";
import { type NewsListRow, toNewsListRow } from "../_shared/kleague/mappers.ts";

/**
 * 수집 대상. club 은 구단 보도자료라 "포항" 으로 좁히고,
 * league 는 리그 전체 소식이라 좁히지 않는다.
 */
export const PROBES: Array<{ category: NewsCategory; search?: string; pages: number }> = [
  { category: "club", search: "포항", pages: 2 },
  { category: "league", pages: 1 },
  { category: "notice", pages: 1 },
];

export async function collectList(): Promise<NewsListRow[]> {
  const bySeq = new Map<number, NewsListRow>();
  for (const probe of PROBES) {
    for (let page = 1; page <= probe.pages; page++) {
      const items = await fetchNewsList({ category: probe.category, search: probe.search, page });
      for (const item of items) bySeq.set(item.seq, toNewsListRow(item));
    }
  }
  return [...bySeq.values()];
}

export async function runCollectNews(db: SupabaseClient): Promise<JobResult> {
  const rows = await collectList();
  if (rows.length === 0) throw new Error("뉴스가 0건입니다 (셀렉터가 깨졌을 수 있음)");

  /*
    본문은 받지 않는다. 기사는 남의 저작물이라 화면에 안 보여도 우리 DB 에 담는 순간
    복제가 된다. 앱은 제목까지만 보여 주고 읽는 것은 원문 페이지에서 하게 한다.
  */
  const upserted = await upsertAll(db, "news", rows, "seq");

  return { fetched: rows.length, upserted };
}

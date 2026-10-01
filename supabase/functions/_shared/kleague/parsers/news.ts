import { type ListItem, parseListPage } from "./list.ts";

export interface NewsItem extends ListItem {
  /** 목록 제목의 "[포항] ..." 접두어에서 뽑은 구단명. 없으면 연맹/리그 기사. */
  clubTag: string | null;
}

const CLUB_TAG_RE = /^\[([^\]]{1,10})\]\s*/;

export function parseNewsList(html: string): NewsItem[] {
  return parseListPage(html)
    .filter((i) => i.href.startsWith("/news_view.do"))
    .map((i) => ({ ...i, clubTag: i.title.match(CLUB_TAG_RE)?.[1] ?? null }));
}


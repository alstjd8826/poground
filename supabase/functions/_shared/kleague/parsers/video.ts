import { type ListItem, parseListPage } from "./list.ts";

export interface VideoItem extends ListItem {
  /** 목록 썸네일(i.ytimg.com/vi/{id}/...)에서 바로 추출. video_view.do 를 따로 안 열어도 된다. */
  youtubeId: string | null;
}

const YT_THUMB_RE = /(?:i\d?\.ytimg\.com|img\.youtube\.com)\/vi\/([A-Za-z0-9_-]{8,})\//;

export function parseVideoList(html: string): VideoItem[] {
  return parseListPage(html)
    .filter((i) => i.href.startsWith("/video_view.do"))
    .map((i) => ({ ...i, youtubeId: i.thumbnail?.match(YT_THUMB_RE)?.[1] ?? null }));
}

/** 목록에 썸네일이 없는 예외 항목용 폴백. */
export function parseVideoDetail(html: string): string | null {
  return html.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{8,})/)?.[1] ?? null;
}

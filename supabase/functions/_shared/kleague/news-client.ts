import { type NewsItem, parseNewsList } from "./parsers/news.ts";
import { parseVideoList, type VideoItem } from "./parsers/video.ts";
import { getHtml } from "./http.ts";

export type NewsCategory = "club" | "league" | "notice" | "fan" | "youth";
export type VideoCategory = "goal" | "highlight" | "club" | "etc";

export function fetchNewsList(
  opts: { category?: NewsCategory; search?: string; page?: number } = {},
): Promise<NewsItem[]> {
  return getHtml("/news_list.do", {
    category: opts.category ?? "",
    search: opts.search ?? "",
    orderBy: "seq",
    viewOption: "album",
    page: String(opts.page ?? 1),
  }).then(parseNewsList);
}

export function fetchVideoList(
  opts: { category?: VideoCategory; searchWord?: string; page?: number } = {},
): Promise<VideoItem[]> {
  return getHtml("/video_list.do", {
    category: opts.category ?? "",
    searchWord: opts.searchWord ?? "",
    listType: "tile",
    page: String(opts.page ?? 1),
  }).then(parseVideoList);
}

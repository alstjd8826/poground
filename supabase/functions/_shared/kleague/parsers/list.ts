import { attr, parseCount, parseDotDate, text } from "./html.ts";

/** 뉴스/영상 목록이 같은 마크업을 쓴다: li > a > (.img-box img, .txt-box > span + strong.name + .sort) */
export interface ListItem {
  seq: number;
  category: string | null;
  title: string;
  publishedOn: string | null;
  viewCount: number | null;
  thumbnail: string | null;
  href: string;
}

const ITEM_RE = /<a\s+href="(\/(?:news|video)_view\.do\?[^"]*\bseq=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

export function parseListPage(html: string): ListItem[] {
  const items: ListItem[] = [];
  const seen = new Set<number>();

  for (const m of html.matchAll(ITEM_RE)) {
    const [, href, seqStr, inner] = m;
    const seq = Number(seqStr);
    if (seen.has(seq)) continue;

    const title = text(
      inner.match(/<strong[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ?? "",
    );
    if (!title) continue; // 제목 없는 a 태그(페이징/썸네일 링크)는 버린다

    const imgTag = inner.match(/<img\b[^>]*>/i)?.[0];
    const sort = inner.match(/<div[^>]*class="[^"]*\bsort\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const spans = [...sort.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((s) => text(s[1]));

    seen.add(seq);
    items.push({
      seq,
      category: text(inner.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "") || null,
      title,
      publishedOn: parseDotDate(spans.find((s) => /\d{4}\.\d{1,2}\.\d{1,2}/.test(s))),
      viewCount: parseCount(spans.find((s) => s.includes("조회수"))),
      thumbnail: imgTag ? attr(imgTag, "src") : null,
      href,
    });
  }
  return items;
}

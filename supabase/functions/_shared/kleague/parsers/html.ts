/** kleague.com 은 SSR HTML 을 주므로 의존성 없이 정규식으로 긁는다. */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X"
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

export function stripTags(s: string): string {
  return s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

/** 인라인 텍스트용 — 줄바꿈까지 공백 하나로 접는다. */
export function text(html: string): string {
  return decodeEntities(stripTags(html)).replace(/\s+/g, " ").trim();
}


export function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i")) ??
    tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

/** "2026.09.14" → "2026-09-14" (KST 기준 날짜. 시각 정보는 원본에 없다) */
export function parseDotDate(s: string | null | undefined): string | null {
  const m = s?.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function parseCount(s: string | null | undefined): number | null {
  const m = s?.match(/([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}


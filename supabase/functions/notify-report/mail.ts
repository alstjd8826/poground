/**
 * 신고 메일 본문. 댓글과 게시글이 같은 틀을 쓴다 — 무엇이 신고됐는지만 다르다.
 *
 * 앱으로 여는 링크는 https 다. Gmail 은 https 가 아닌 주소(poground://)를 링크로 만들어 주지 않아서 메일에서
 * 누를 수가 없었다(2026-09-29). 그래서 open-link 함수를 거친다 — 받은 값을 확인하고 poground://comment?… 로
 * 넘긴다. 그 모양은 앱의 navigation/deepLink.ts 가 읽는 것과 같아야 한다. 게시글은 type=post, id=글 id.
 */
export interface MailInput {
  /** Edge Function 주소의 앞부분. …/functions/v1 */
  functionsUrl: string;
  kind: "comment" | "post";
  targetId: string;
  reason: string;
  reporter: string;
  author: string;
  subjectType: string | null;
  subjectId: string | null;
  body: string | null;
  createdAt: string | null;
}

const LABEL = { comment: "댓글", post: "게시글" } as const;

export function appLink(functionsUrl: string, type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  return `${functionsUrl}/open-link?type=${type}&id=${encodeURIComponent(id)}`;
}

export function buildReportMail(input: MailInput): { subject: string; text: string } {
  const label = LABEL[input.kind];
  const link = appLink(input.functionsUrl, input.subjectType, input.subjectId);
  const lines = [
    `대상: ${label}`,
    ...(input.kind === "comment" ? [`달린 곳: ${input.subjectType ?? "?"} ${input.subjectId ?? "?"}`] : []),
    `글쓴이: ${input.author}`,
    `신고한 사람: ${input.reporter}`,
    `신고 사유: ${input.reason || "(적지 않음)"}`,
    `쓴 시각: ${input.createdAt ?? "?"}`,
    "",
    "내용",
    "----",
    input.body ?? "(글을 읽지 못했습니다)",
    "",
    // 링크는 앱이 깔린 기기에서만 열린다. 열리지 않을 때를 위해 아래 id 를 함께 남긴다
    ...(link ? [`앱에서 열기: ${link}`, ""] : []),
    `${label} id: ${input.targetId}`,
    "신고함: 앱 → 마이 → 신고함",
  ];
  return { subject: `[포그라운드] ${label} 신고 1건`, text: lines.join("\n") };
}

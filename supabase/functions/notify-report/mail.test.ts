import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { buildReportMail } from "./mail.ts";

const base = {
  functionsUrl: "https://fn.example",
  reason: "욕설",
  reporter: "@b (비)",
  author: "@a (에이)",
  body: "문제의 글",
  createdAt: "2026-09-29T00:00:00Z",
};

Deno.test("게시글 신고는 제목과 본문에 게시글이라고 적고 글을 여는 링크를 단다", () => {
  const mail = buildReportMail({
    ...base,
    kind: "post",
    targetId: "p1",
    subjectType: "post",
    subjectId: "p1",
  });
  assertEquals(mail.subject, "[포그라운드] 게시글 신고 1건");
  assertStringIncludes(mail.text, "대상: 게시글");
  // Gmail 은 https 만 링크로 만든다. 받은 값을 확인해 poground:// 로 넘기는 함수를 거친다
  assertStringIncludes(mail.text, "https://fn.example/open-link?type=post&id=p1");
  assertStringIncludes(mail.text, "게시글 id: p1");
});

Deno.test("댓글 신고는 달린 곳을 적는다", () => {
  const mail = buildReportMail({
    ...base,
    kind: "comment",
    targetId: "c1",
    subjectType: "match",
    subjectId: "180",
  });
  assertEquals(mail.subject, "[포그라운드] 댓글 신고 1건");
  assertStringIncludes(mail.text, "대상: 댓글");
  assertStringIncludes(mail.text, "달린 곳: match 180");
  assertStringIncludes(mail.text, "댓글 id: c1");
});

Deno.test("글을 못 읽었으면 그 자리만 비우고 보낸다", () => {
  const mail = buildReportMail({
    ...base,
    kind: "post",
    targetId: "p1",
    subjectType: null,
    subjectId: null,
    body: null,
  });
  assertStringIncludes(mail.text, "(글을 읽지 못했습니다)");
  assert(!mail.text.includes("앱에서 열기"));
});

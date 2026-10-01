import { adminClient } from "../_shared/runner.ts";
import { buildReportMail } from "./mail.ts";

/**
 * 신고가 들어오면 운영자에게 메일로 알린다.
 *
 * 앱스토어 심사 지침 1.2 는 신고 수단만 요구하지 않는다 — "제때 응답" 까지 요구한다.
 * 표에 쌓아 두기만 하면 대시보드를 들여다볼 때까지 아무도 모르므로, 들어온 즉시 민다.
 *
 * 부르는 쪽은 앱이 아니라 **DB 트리거**다 (댓글 0014, 게시글 0025). 본문 틀은 mail.ts. 앱이 부르면 신고는
 * 넣고 알림만 빼먹는 요청을 만들 수 있고, 그 호출을 막을 길도 마땅치 않다.
 */
const TO = "htk4064@gmail.com";

/**
 * 보내는 주소.
 *
 * Resend 는 도메인을 확인하기 전까지 onboarding@resend.dev 로만 보낼 수 있고, 받는 사람도
 * 계정 주인으로 제한된다. 우리는 받는 사람이 운영자 한 명이라 그 제한에 걸리지 않는다.
 * 나중에 도메인을 붙이면 이 값만 바꾼다.
 */
const FROM = Deno.env.get("REPORT_FROM") ?? "포그라운드 <onboarding@resend.dev>";

interface Payload {
  /** 댓글 신고(0014) */
  comment_id?: string;
  /** 게시글 신고(0025) */
  post_id?: string;
  reporter: string;
  reason: string;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "RESEND_API_KEY 가 없습니다" }, 500);

  const payload = (await req.json()) as Payload;
  const db = adminClient();
  const kind = payload.post_id ? "post" : "comment";
  const targetId = (payload.post_id ?? payload.comment_id)!;

  // 메일에 담을 내용. 하나라도 못 읽으면 그 자리만 비우고 보낸다 — 알림이 늦는 것보다 낫다
  const target: {
    subject_type?: string;
    subject_id?: string;
    body?: string;
    author?: string;
    created_at?: string;
  } | null = kind === "post"
    ? (await db.from("posts").select("body, author, created_at").eq("id", targetId).maybeSingle()).data
    : (await db.from("comments").select("subject_type, subject_id, body, author, created_at").eq(
      "id",
      targetId,
    )
      .maybeSingle()).data;

  const ids = [target?.author, payload.reporter].filter(Boolean) as string[];
  const { data: people } = await db.from("profiles").select("id, handle, nickname").in("id", ids);
  const who = (id: string | undefined) => {
    const p = people?.find((x) => x.id === id);
    return p ? `@${p.handle} (${p.nickname})` : (id ?? "알 수 없음");
  };

  const mail = buildReportMail({
    functionsUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1`,
    kind,
    targetId,
    reason: payload.reason,
    reporter: who(payload.reporter),
    author: who(target?.author),
    // 게시글은 글 자체가 여는 곳이다. 댓글은 달린 곳을 연다
    subjectType: kind === "post" ? (target ? "post" : null) : target?.subject_type ?? null,
    subjectId: kind === "post" ? (target ? targetId : null) : target?.subject_id ?? null,
    body: target?.body ?? null,
    createdAt: target?.created_at ?? null,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject: mail.subject,
      text: mail.text,
    }),
  });

  if (!res.ok) {
    return json({ error: `메일 실패: ${res.status} ${await res.text()}` }, 500);
  }
  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

import { appTarget } from "./logic.ts";

/**
 * 신고 메일의 "앱에서 열기" (https) 를 앱 주소로 넘긴다. 자세한 까닭은 logic.ts.
 *
 * 로그인 없이 누구나 부른다(verify_jwt 끔) — 메일 앱이 여는 주소라 인증을 실을 수 없다. 넘기는 곳은 우리 앱
 * 주소뿐이고 앱이 연 뒤에는 앱의 읽기 정책이 그대로 걸린다.
 */
Deno.serve((req) => {
  const target = appTarget(new URL(req.url));
  if (!target) {
    return new Response("잘못된 링크입니다", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(null, { status: 302, headers: { Location: target } });
});

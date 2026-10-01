import { adminClient } from "../_shared/runner.ts";
import { deleteAccount, type Deps } from "./logic.ts";

/**
 * 앱의 "계정 삭제" 가 부른다. 무엇을 어떤 순서로 지우는지는 logic.ts.
 *
 * verify_jwt 는 끈다 — 게이트웨이의 JWT 검사에 기대지 않고, 여기서 토큰으로 사용자를 직접 묻는다(auth.getUser).
 * 지우는 대상은 언제나 그 토큰의 주인뿐이다. 요청 본문으로 누구를 지울지 받지 않는다.
 */
const PAGE = 1000;

Deno.serve(async (req) => {
  const db = adminClient();
  const deps: Deps = {
    userFromToken: async (token) => {
      const { data, error } = await db.auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    },
    isAdmin: async (userId) => {
      const { data, error } = await db.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    list: async (bucket, prefix) => {
      const { data, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE });
      if (error) throw error;
      // 폴더는 id 가 비어 온다
      return (data ?? []).map((f) => ({ name: f.name, folder: f.id === null }));
    },
    remove: async (bucket, paths) => {
      const { error } = await db.storage.from(bucket).remove(paths);
      if (error) throw error;
    },
    withdrawComments: async (userId) => {
      const { error } = await db.rpc("withdraw_comments", { p_user: userId });
      if (error) throw error;
    },
    deleteUser: async (userId) => {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  };

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const outcome = await deleteAccount(deps, token);
  return new Response(JSON.stringify(outcome.body), {
    status: outcome.status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
});

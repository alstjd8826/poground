import { assertEquals } from "jsr:@std/assert@1";
import { BUCKETS, deleteAccount, type Deps } from "./logic.ts";

/** 가짜 저장소. 버킷마다 경로 목록을 들고, list 는 한 단씩만 보여 준다(Supabase 와 같다) */
function fake(opts: { files?: Record<string, string[]>; admin?: boolean; failRemove?: string } = {}) {
  const files: Record<string, string[]> = Object.fromEntries(
    BUCKETS.map((b) => [b, [...(opts.files?.[b] ?? [])]]),
  );
  const calls: string[] = [];
  const deps: Deps = {
    userFromToken: async (token) => (token === "good" ? "u1" : null),
    isAdmin: async () => opts.admin ?? false,
    list: async (bucket, prefix) => {
      const seen = new Map<string, boolean>();
      for (const path of files[bucket]!) {
        if (!path.startsWith(`${prefix}/`)) continue;
        const [head, ...rest] = path.slice(prefix.length + 1).split("/");
        seen.set(head!, rest.length > 0 || seen.get(head!) === true);
      }
      return [...seen].map(([name, folder]) => ({ name, folder }));
    },
    remove: async (bucket, paths) => {
      if (bucket === opts.failRemove) throw new Error("storage down");
      calls.push(`remove ${bucket} ${paths.join(",")}`);
      files[bucket] = files[bucket]!.filter((p) => !paths.includes(p));
    },
    withdrawComments: async (uid) => void calls.push(`withdraw ${uid}`),
    deleteUser: async (uid) => void calls.push(`delete ${uid}`),
  };
  return { deps, calls, files };
}

Deno.test("로그인하지 않았으면 아무것도 지우지 않는다", async () => {
  const { deps, calls } = fake();
  assertEquals((await deleteAccount(deps, null)).status, 401);
  assertEquals((await deleteAccount(deps, "bad")).status, 401);
  assertEquals(calls, []);
});

Deno.test("운영자 계정은 지우지 않는다", async () => {
  const { deps, calls } = fake({ admin: true });
  assertEquals((await deleteAccount(deps, "good")).status, 403);
  assertEquals(calls, []);
});

Deno.test("내 폴더의 파일을 하위 폴더까지 모두 치우고, 댓글 자리를 남긴 뒤 계정을 지운다", async () => {
  const { deps, calls, files } = fake({
    files: {
      "post-photos": ["u1/p1/a", "u1/p1/b", "u1/p2/c", "u2/p9/z"],
      "fan-cards": ["u1/c1.jpg"],
      "avatars": ["u1/1.jpg", "u2/2.jpg"],
    },
  });
  assertEquals((await deleteAccount(deps, "good")).status, 200);
  assertEquals(files["post-photos"], ["u2/p9/z"]);
  assertEquals(files["fan-cards"], []);
  assertEquals(files["avatars"], ["u2/2.jpg"]);
  // 순서: 파일 → 댓글 → 계정. 계정부터 지우면 실패했을 때 남은 파일을 지울 주인이 없다
  assertEquals(calls.slice(-2), ["withdraw u1", "delete u1"]);
});

Deno.test("파일을 못 지우면 계정을 남겨 둔다 — 다시 시도할 수 있게", async () => {
  const { deps, calls } = fake({ files: { "avatars": ["u1/1.jpg"] }, failRemove: "avatars" });
  assertEquals((await deleteAccount(deps, "good")).status, 500);
  assertEquals(calls.some((c) => c.startsWith("delete")), false);
  assertEquals(calls.some((c) => c.startsWith("withdraw")), false);
});

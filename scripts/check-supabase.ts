/**
 * .env 의 Supabase 연결이 실제로 되는지 확인한다.
 *   deno task check-db
 *
 * 앱과 같은 anon 키로 같은 테이블을 읽어보므로, 여기서 통과하면 앱에서도 뜬다.
 * 키 값 자체는 출력하지 않는다.
 */
const envPath = new URL("../.env", import.meta.url);

let env: Record<string, string> = {};
try {
  env = Object.fromEntries(
    (await Deno.readTextFile(envPath))
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
} catch {
  console.error("✗ .env 가 없습니다. .env.example 을 복사해서 채우세요.");
  Deno.exit(1);
}

const url = env.EXPO_PUBLIC_SUPABASE_URL;
// Connect 대화상자는 _KEY, 예전 프로젝트는 _ANON_KEY 를 준다
const key = env.EXPO_PUBLIC_SUPABASE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key || url.includes("xxxxxxxxxxxx")) {
  console.error("✗ .env 의 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY 가 비었거나 예시값입니다.");
  Deno.exit(1);
}
// service_role 을 앱 키 자리에 넣는 건 치명적이다. 배포 전에 여기서 막는다.
if (key.startsWith("sb_secret_") || (key.startsWith("eyJ") && atob(key.split(".")[1] ?? "").includes("service_role"))) {
  console.error("✗ 공개 키 자리에 service_role/secret 키가 들어 있습니다.");
  console.error("  이 값은 앱 번들에 박혀 나가고 RLS 를 통째로 우회합니다. anon / sb_publishable 키로 바꾸세요.");
  Deno.exit(1);
}
console.log(`대상: ${url}`);

const TABLES = ["clubs", "matches", "standings", "players", "news", "videos"] as const;

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed++;
};

async function count(table: string): Promise<number | string> {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  });
  if (!res.ok) return `HTTP ${res.status}`;
  // content-range 는 "0-24/137" 또는 "*/0" 형태
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

console.log("\n[테이블 읽기 (anon)]");
for (const t of TABLES) {
  const n = await count(t);
  check(t, typeof n === "number", typeof n === "number" ? `${n}행` : String(n));
}

console.log("\n[RLS - 쓰기는 막혀야 한다]");
const write = await fetch(`${url}/rest/v1/news`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ seq: -1, title: "rls probe" }),
});
// 정책이 select 만 허용하므로 401/403 이 정상이다. 201 이면 정책이 새고 있다는 뜻.
check("anon 으로 insert 거부됨", write.status !== 201, `HTTP ${write.status}`);

console.log("\n[수집 실행 로그]");
const runs = await fetch(`${url}/rest/v1/collect_runs?select=job,ok,fetched,ran_at&order=ran_at.desc&limit=5`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
// collect_runs 는 정책이 없어 anon 에게 보이면 안 된다(빈 배열이 정상)
const rows = runs.ok ? await runs.json() : [];
check("collect_runs 비공개", Array.isArray(rows) && rows.length === 0, `${rows.length}행 노출`);

console.log(failed === 0 ? "\n연결 정상\n" : `\n${failed}건 실패\n`);
Deno.exit(failed === 0 ? 0 : 1);

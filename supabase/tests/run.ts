/**
 * migration 과 그 검증 스크립트를 로컬 PGlite(WebAssembly 로 도는 Postgres)에서 돌린다.
 *
 *   deno task sql-check supabase/migrations/0023_community.sql supabase/migrations/0024_post_writes.sql \
 *     supabase/tests/0024_post_writes_check.sql
 *
 * 마지막 인자가 검증 스크립트, 앞은 차례로 적용할 migration 이다.
 *
 * node_modules 를 보지 않게 돌린다(--node-modules-dir=none). PGlite 를 앱 의존성에 넣지 않으려는 것이다.
 *
 * 로컬에 Postgres 가 없고 관리 API 로 SQL 을 못 돌려서(403), 정책을 고친 뒤 SQL Editor 에
 * 붙이기 전에 여기서 먼저 본다. prelude.sql 이 Supabase 를 흉내 낸다 — 진짜와 다를 수 있으니
 * 적용한 뒤 SQL Editor 에서 같은 검증 스크립트를 한 번 더 돌린다.
 */
import { PGlite } from "npm:@electric-sql/pglite@0.3.7";

const args = [...Deno.args];
const checkPath = args.pop();
const migrationPaths = args;
if (!checkPath || migrationPaths.length === 0) {
  console.error("사용: deno task sql-check <migration.sql>... <check.sql>");
  Deno.exit(2);
}
const prelude = Deno.readTextFileSync(new URL("./prelude.sql", import.meta.url));
const db = new PGlite();
await db.exec(prelude);

for (const path of migrationPaths) {
  try {
    await db.exec(Deno.readTextFileSync(path));
  } catch (e) {
    console.error(`migration 실패 (${path}):`, (e as Error).message);
    Deno.exit(1);
  }
}

try {
  const out = await db.exec(Deno.readTextFileSync(checkPath));
  const last = out.filter((r) => r.rows?.length).pop();
  console.log(JSON.stringify(last?.rows ?? []));
} catch (e) {
  console.error((e as Error).message);
  Deno.exit(1);
}

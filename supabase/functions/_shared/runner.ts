import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface JobResult {
  fetched: number;
  upserted: number;
  /** 응답에 같이 실어 보낼 부가 정보 */
  detail?: Record<string, unknown>;
}

/**
 * 수집 함수 공통 껍데기.
 * - 실행 결과를 collect_runs 에 남긴다. 파서가 조용히 깨지면 fetched 가 0 으로 찍혀서 드러난다.
 * - 크론이 CRON_SECRET 을 헤더로 보내게 해서 외부 호출을 막는다.
 */
export function serveJob(job: string, run: (db: SupabaseClient, req: Request) => Promise<JobResult>) {
  Deno.serve(async (req) => {
    const secret = Deno.env.get("CRON_SECRET");
    if (secret && req.headers.get("x-cron-secret") !== secret) {
      return json({ error: "unauthorized" }, 401);
    }

    const started = Date.now();
    const db = adminClient();
    try {
      const result = await run(db, req);
      const duration = Date.now() - started;
      await db.from("collect_runs").insert({
        job,
        ok: true,
        fetched: result.fetched,
        upserted: result.upserted,
        duration_ms: duration,
      });
      return json({ job, ok: true, ...result, duration_ms: duration });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.from("collect_runs").insert({
        job,
        ok: false,
        error: message,
        duration_ms: Date.now() - started,
      });
      return json({ job, ok: false, error: message }, 500);
    }
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** upsert 결과 행 수를 세는 헬퍼. 빈 배열이면 호출 자체를 건너뛴다. */
export async function upsertAll<T extends object>(
  db: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await db.from(table).upsert(rows as unknown as Record<string, unknown>[], { onConflict });
  if (error) throw new Error(`${table} upsert 실패: ${error.message}`);
  return rows.length;
}

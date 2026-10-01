/**
 * 계정 삭제 (앱스토어 지침 5.1.1(v), 2026-09-30).
 *
 * 순서가 중요하다 — 파일 → 댓글 → 계정. 계정을 먼저 지우면 파일 치우기가 실패했을 때 남은 파일의 주인이 사라져
 * 다시 지울 길이 없다. 파일을 못 지우면 계정을 그대로 두고 실패를 알린다 — 앱에서 다시 누르면 된다.
 *
 * 글·좋아요·팬카드·직관 기록·차단은 계정을 따라 DB 가 지운다(on delete cascade). 댓글은 자리를 남긴다
 * (withdraw_comments, 0029).
 */

/** 파일이 모두 `{사용자 id}/…` 아래에 있는 버킷 */
export const BUCKETS = ["post-photos", "fan-cards", "my-player-photos", "avatars"] as const;

export interface Entry {
  name: string;
  /** 하위 폴더인가. Supabase 의 list 는 한 단씩만 보여 주고 폴더는 id 가 비어 온다 */
  folder: boolean;
}

export interface Deps {
  /** 요청의 토큰이 가리키는 사용자. 틀리거나 만료됐으면 null */
  userFromToken: (token: string) => Promise<string | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  list: (bucket: string, prefix: string) => Promise<Entry[]>;
  remove: (bucket: string, paths: string[]) => Promise<void>;
  withdrawComments: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

export interface Outcome {
  status: number;
  body: { ok: true } | { error: string };
}

export async function deleteAccount(deps: Deps, token: string | null): Promise<Outcome> {
  const userId = token ? await deps.userFromToken(token) : null;
  if (!userId) return { status: 401, body: { error: "로그인이 필요합니다" } };
  if (await deps.isAdmin(userId)) return { status: 403, body: { error: "운영자 계정은 지울 수 없습니다" } };

  try {
    for (const bucket of BUCKETS) {
      const paths = await filesUnder(deps, bucket, userId);
      if (paths.length > 0) await deps.remove(bucket, paths);
    }
    await deps.withdrawComments(userId);
    await deps.deleteUser(userId);
  } catch (e) {
    return { status: 500, body: { error: e instanceof Error ? e.message : String(e) } };
  }
  return { status: 200, body: { ok: true } };
}

/** 폴더 아래 파일을 하위 폴더까지 모두 모은다. 글 사진은 {사용자}/{글}/{사진} 으로 한 단 더 깊다 */
async function filesUnder(deps: Deps, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await deps.list(bucket, prefix)) {
    const path = `${prefix}/${entry.name}`;
    if (entry.folder) out.push(...(await filesUnder(deps, bucket, path)));
    else out.push(path);
  }
  return out;
}

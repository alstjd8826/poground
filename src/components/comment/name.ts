import type { Comment } from '@/repositories/comment/remote'

/**
 * 댓글에 적을 이름.
 *
 * 아이디를 보여준다 — 계정 화면과 같은 `@아이디` 꼴이다. 닉네임은 겹칠 수 있어서
 * 같은 이름 둘이 서로 다른 사람인지 구별되지 않는다.
 *
 * 아직 프로필을 안 만든 사람은 아이디가 없다. 그때만 두루 쓰는 말로 대신한다.
 */
export function nameOf(c: Comment): string {
  return c.handle ? `@${c.handle}` : '포항 팬'
}

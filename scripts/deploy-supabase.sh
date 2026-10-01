#!/usr/bin/env bash
# Supabase 프로젝트에 스키마와 수집 함수를 올린다.
#
#   ./scripts/deploy-supabase.sh [project-ref]
#
# 자격 증명은 .env 의 SUPABASE_ACCESS_TOKEN 을 쓴다(개인 계정 토큰).
# 브라우저 로그인을 쓰지 않으므로 다른 계정 세션에 붙는 사고가 없고,
# 전역 자격 저장소도 건드리지 않는다. .env.example 설명 참고.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "✗ .env 가 없습니다. cp .env.example .env 후 값을 채우세요." >&2
  exit 1
fi

# .env 를 읽되 주석/빈 줄은 건너뛴다. 값에 공백이 있어도 깨지지 않게 export -a 를 쓴다.
set -a
# shellcheck disable=SC1091
source ./.env
set +a

REF="${1:-${SUPABASE_PROJECT_REF:-}}"
if [ -z "$REF" ] || [ "$REF" = "xxxxxxxxxxxx" ]; then
  echo "✗ project-ref 가 없습니다. .env 의 SUPABASE_PROJECT_REF 를 채우거나 인자로 넘기세요." >&2
  exit 1
fi
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [[ "$SUPABASE_ACCESS_TOKEN" != sbp_* ]]; then
  echo "✗ .env 의 SUPABASE_ACCESS_TOKEN 이 비었거나 형식이 아닙니다(sbp_ 로 시작)." >&2
  echo "  https://supabase.com/dashboard/account/tokens 에서 개인 계정으로 발급하세요." >&2
  exit 1
fi

# 어느 계정으로 붙는지 먼저 보여준다. 여기서 회사 조직이 보이면 즉시 멈출 것.
echo "▶ 토큰으로 접근 가능한 조직"
npx supabase orgs list

# 크론과 함수가 같은 값을 써야 하므로 마지막에 출력해 준다.
CRON_SECRET="${CRON_SECRET:-$(openssl rand -hex 24)}"
SEASON_YEAR="${EXPO_PUBLIC_SEASON_YEAR:-2026}"
CLUB_TEAM_ID="${CLUB_TEAM_ID:-K03}"

echo "▶ 프로젝트 연결: $REF"
npx supabase link --project-ref "$REF"

echo "▶ 마이그레이션 적용"
npx supabase db push

echo "▶ 함수 시크릿 설정"
# RESEND_API_KEY(신고 알림 메일)는 여기서 건드리지 않는다. 값이 git 에 닿지 않도록
# 대시보드의 Edge Functions > Secrets 에서 한 번 심는다.
npx supabase secrets set \
  CRON_SECRET="$CRON_SECRET" \
  SEASON_YEAR="$SEASON_YEAR" \
  CLUB_TEAM_ID="$CLUB_TEAM_ID"

echo "▶ Edge Function 배포"
# 수집 함수는 크론이 x-cron-secret 으로 인증하므로 Supabase 의 JWT 검사는 끈다.
# notify-report 도 같은 방식이다. 부르는 쪽이 DB 트리거라 JWT 가 없고 x-cron-secret 으로 가린다.
for fn in collect-matches collect-standings collect-news collect-videos collect-lineups notify-report; do
  npx supabase functions deploy "$fn" --no-verify-jwt
done

echo
echo "▶ 남은 한 단계: 크론이 함수를 부를 수 있게 DB 설정을 넣는다."
echo "   SQL Editor 에 아래를 붙여넣고 실행하세요. (없으면 크론이 조용히 아무것도 안 합니다)"
echo
cat <<SQL
alter database postgres set app.functions_url = 'https://$REF.supabase.co/functions/v1';
alter database postgres set app.cron_secret   = '$CRON_SECRET';
SQL
echo
echo "   첫 수집을 바로 돌리려면"
echo "   select public.call_collector('collect-matches', '?full=1');"
echo "   select public.call_collector('collect-standings');"
echo "   select public.call_collector('collect-news');"
echo "   select public.call_collector('collect-videos');"

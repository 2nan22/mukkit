#!/usr/bin/env bash
# 로컬 Supabase 에 네이버 커스텀 OIDC 공급자(custom:naver) 등록 — db reset 뒤 다시 실행 (근거 ADR 0002)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${MYCHELIN_SUPABASE_ENV:-$ROOT/supabase/.env}"

read_env() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

NAVER_LOGIN_CLIENT_ID="$(read_env NAVER_LOGIN_CLIENT_ID)"
NAVER_LOGIN_CLIENT_SECRET="$(read_env NAVER_LOGIN_CLIENT_SECRET)"
if [ -z "$NAVER_LOGIN_CLIENT_ID" ] || [ -z "$NAVER_LOGIN_CLIENT_SECRET" ]; then
  echo "[naver] supabase/.env 에 NAVER_LOGIN_CLIENT_ID · NAVER_LOGIN_CLIENT_SECRET 이 없어 등록 건너뜀" >&2
  exit 0
fi

# 호스팅에 등록할 때는 NAVER_TARGET_URL · NAVER_TARGET_SECRET 을 넘긴다 (없으면 로컬)
if [ -n "${NAVER_TARGET_URL:-}" ]; then
  API_URL="$NAVER_TARGET_URL"
  SECRET_KEY="${NAVER_TARGET_SECRET:-}"
else
  status_env="$(cd "$ROOT" && supabase status -o env 2>/dev/null)"
  API_URL="$(printf '%s\n' "$status_env" | grep '^API_URL=' | cut -d= -f2- | tr -d '"')"
  SECRET_KEY="$(printf '%s\n' "$status_env" | grep '^SECRET_KEY=' | cut -d= -f2- | tr -d '"')"
fi
if [ -z "$API_URL" ] || [ -z "$SECRET_KEY" ]; then
  echo "[naver] 로컬 Supabase 가 꺼져 있음 — pnpm db:start 후 다시 실행" >&2
  exit 1
fi

admin=("-H" "apikey: $SECRET_KEY" "-H" "Authorization: Bearer $SECRET_KEY")
curl -s -o /dev/null "${admin[@]}" -X DELETE "$API_URL/auth/v1/admin/custom-providers/custom:naver"

# 사용자 정보는 id_token 에서 읽는다 — 네이버 userinfo 는 response 로 한 겹 감싸져 Supabase 가 못 읽음
payload="$(NAVER_LOGIN_CLIENT_ID="$NAVER_LOGIN_CLIENT_ID" NAVER_LOGIN_CLIENT_SECRET="$NAVER_LOGIN_CLIENT_SECRET" node -e '
  process.stdout.write(JSON.stringify({
    identifier: "custom:naver",
    name: "네이버",
    provider_type: "oidc",
    issuer: "https://nid.naver.com",
    client_id: process.env.NAVER_LOGIN_CLIENT_ID,
    client_secret: process.env.NAVER_LOGIN_CLIENT_SECRET,
    scopes: ["openid", "profile"],
    pkce_enabled: true,
    email_optional: true,
  }));
')"

result="$(mktemp)"
trap 'rm -f "$result"' EXIT
code="$(curl -s -o "$result" -w '%{http_code}' "${admin[@]}" \
  -H "Content-Type: application/json" -X POST "$API_URL/auth/v1/admin/custom-providers" --data "$payload")"
if [ "$code" != "201" ]; then
  # 응답에 client_id 가 실릴 수 있어 오류 필드만 보여 준다
  node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")||"{}");console.error("[naver] 등록 실패", process.argv[1], b.error_code ?? b.code ?? "", b.msg ?? b.message ?? "")' "$code" "$result" || true
  exit 1
fi
echo "[naver] custom:naver(OIDC) 등록 완료"

#!/usr/bin/env bash
# 로컬 Supabase 에 실제로 써 보는 검사 (*.db.test.ts) — 키는 출력하지 않는다
set -euo pipefail
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=' \
  | sed -e 's/^API_URL=/export SUPABASE_TEST_URL=/' -e 's/^PUBLISHABLE_KEY=/export SUPABASE_TEST_PUBLISHABLE_KEY=/' \
        -e 's/^SECRET_KEY=/export SUPABASE_TEST_SECRET_KEY=/')"
exec vitest run db.test

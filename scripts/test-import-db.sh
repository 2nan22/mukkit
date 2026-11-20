#!/usr/bin/env bash
# 가져오기 저장을 로컬 Supabase 에 실제로 써 보는 검사 — 키는 출력하지 않는다
set -euo pipefail
eval "$(supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY)=' \
  | sed -e 's/^API_URL=/export SUPABASE_TEST_URL=/' -e 's/^PUBLISHABLE_KEY=/export SUPABASE_TEST_PUBLISHABLE_KEY=/')"
exec vitest run src/features/import/saveImportedList.db.test.ts

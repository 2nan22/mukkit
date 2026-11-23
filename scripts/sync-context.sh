#!/usr/bin/env bash
# Vault 10_llm-context → .claude 사본 동기화 (항목은 .claude/context.manifest)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/.claude/context.manifest"
VAULT="${MUKKIT_VAULT_CONTEXT:-${MYCHELIN_VAULT_CONTEXT:-$HOME/Documents/Obsidian/llm-wiki-new/10_llm-context}}"
DEST_VAULT="$ROOT/.claude/vault"
DEST_SKILLS="$ROOT/.claude/skills"
SYNCED_LIST="$DEST_VAULT/.synced-skills"

mode=sync
quiet=0
for arg in "$@"; do
  case "$arg" in
    --check) mode=check ;;
    --quiet) quiet=1 ;;
    *) echo "usage: $0 [--check] [--quiet]" >&2; exit 2 ;;
  esac
done

if [ ! -d "$VAULT" ]; then
  echo "[sync-context] Vault 없음: $VAULT · 커밋된 사본으로 진행 (MUKKIT_VAULT_CONTEXT 로 경로 지정 가능)" >&2
  [ "$mode" = check ] && exit 1
  exit 0
fi

version="$(awk '$1=="version"{print $2}' "$MANIFEST")"
src="$VAULT/context-versions/$version"
if [ -z "$version" ] || [ ! -d "$src" ]; then
  echo "[sync-context] 베이스 버전 폴더 없음: $src" >&2
  exit 1
fi

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/vault" "$stage/skills"

skills=()
while read -r kind path _; do
  case "$kind" in
    ''|\#*|version) ;;
    file)
      mkdir -p "$stage/vault/$(dirname "$path")"
      cp "$src/$path" "$stage/vault/$path"
      ;;
    skill)
      cp -R "$src/skills/$path" "$stage/skills/$path"
      skills+=("$path")
      ;;
    *) echo "[sync-context] manifest 알 수 없는 종류: $kind" >&2; exit 1 ;;
  esac
done < "$MANIFEST"

cat > "$stage/vault/README.md" <<EOF
# .claude/vault — Vault 사본 (자동 생성)

- 정본: Vault \`10_llm-context/context-versions/$version/\`
- 갱신: \`scripts/sync-context.sh\` (Claude Code 세션 시작 시 자동 실행)
- 이 폴더와 동기화된 skill 은 **직접 고치지 않는다** — Vault 에서 고친 뒤 동기화한다
- 가져올 항목은 \`.claude/context.manifest\` 에서 정한다
EOF
printf '%s\n' ${skills[@]+"${skills[@]}"} > "$stage/vault/.synced-skills"

# 변경 목록 (추가 · 수정 · 삭제)
changes="$(
  if [ -d "$DEST_VAULT" ]; then
    { diff -rq "$stage/vault" "$DEST_VAULT" || true; } | sed "s|$stage/||; s|$ROOT/||"
  else
    echo "새 사본: .claude/vault"
  fi
  for s in ${skills[@]+"${skills[@]}"}; do
    { diff -rq "$stage/skills/$s" "$DEST_SKILLS/$s" 2>/dev/null || [ -d "$DEST_SKILLS/$s" ] || echo "새 skill: $s"; } | sed "s|$stage/||; s|$ROOT/||"
  done
  if [ -f "$SYNCED_LIST" ]; then
    while read -r old; do
      [ -n "$old" ] && ! printf '%s\n' ${skills[@]+"${skills[@]}"} | grep -qx "$old" && echo "제거된 skill: $old"
    done < "$SYNCED_LIST"
  fi
  true
)"

if [ "$mode" = check ]; then
  if [ -n "$changes" ]; then
    echo "[sync-context] Vault 와 다름 ($version):"; echo "$changes"; exit 1
  fi
  [ "$quiet" = 1 ] || echo "[sync-context] Vault 와 일치 ($version)"
  exit 0
fi

if [ -z "$changes" ]; then
  [ "$quiet" = 1 ] || echo "[sync-context] 변경 없음 ($version)"
  exit 0
fi

# 목록에서 빠진 skill 제거 (이전에 동기화한 것만)
if [ -f "$SYNCED_LIST" ]; then
  while read -r old; do
    if [ -n "$old" ] && ! printf '%s\n' ${skills[@]+"${skills[@]}"} | grep -qx "$old"; then
      rm -rf "${DEST_SKILLS:?}/$old"
    fi
  done < "$SYNCED_LIST"
fi

mkdir -p "$DEST_VAULT" "$DEST_SKILLS"
rsync -a --delete "$stage/vault/" "$DEST_VAULT/"
for s in ${skills[@]+"${skills[@]}"}; do
  rsync -a --delete "$stage/skills/$s/" "$DEST_SKILLS/$s/"
done

echo "[sync-context] Vault 변경 반영 ($version) — 규칙이 바뀌었을 수 있으니 바뀐 파일을 다시 읽을 것:"
echo "$changes"

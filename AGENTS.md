# AGENTS.md

이 저장소의 에이전트 지침 정본은 **`.claude/CLAUDE.md`** 다. 이 파일은 그것을 가리키기만 한다.

## 작업 전 순서
1. `scripts/sync-context.sh` 실행 — Vault 정본의 최신 사본으로 `.claude/vault/` · `.claude/skills/` 갱신
   - 출력에 바뀐 파일이 나오면 그 파일을 읽는다
2. `.claude/CLAUDE.md` — 프로젝트 개요 · 결정 기록 · 베이스 대비 변경
3. `.claude/vault/CLAUDE.base.md` — 공통 불변부 (`〈〈 〉〉` 빈칸은 2번이 대신한다)
4. `.claude/vault/rules/` — `coding/_common.md` 와 작업에 해당하는 규칙
5. 진행 중인 `.claude/prompts/{NN}_{topic}.md` 와 `.claude/SESSION_LOG.md`

## 지키는 것
- `.claude/vault/` 와 동기화된 skill 은 직접 고치지 않는다 — 정본은 Vault `10_llm-context`
- 비밀파일(`.env` 등) 열람 · 커밋 금지 — `.claude/vault/CLAUDE.base.md` 보안 절
- 커밋은 개인 계정 `2nan22` · `git push` 사용, `gh` 로 PR · 머지하지 않음

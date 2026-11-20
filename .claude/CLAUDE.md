# CLAUDE.md — 마이슐랭 (mychelin)

## 공통 지침 — Vault 정본 참조

공통 불변부(행동 지침 · 운영 정책 · prompt 작성 · 커밋 형식 · 버전 조회 · 세션 이력 · Vault 연계)는
아래 사본을 따른다. 사본의 `〈〈 〉〉` 빈칸은 **이 파일의 프로젝트 절이 대신한다.**

@vault/CLAUDE.base.md

- 사본 위치: `.claude/vault/` · 동기화 skill: `.claude/skills/` 중 `.claude/vault/.synced-skills` 에 적힌 것
- 정본은 Vault `10_llm-context` — **사본은 직접 고치지 않는다.** Vault 에서 고친 뒤 `scripts/sync-context.sh`
- 세션 시작 시 훅이 자동 동기화한다. 출력에 바뀐 파일이 나오면 그 파일을 다시 읽는다
- 가져올 규칙 · skill 은 `.claude/context.manifest` 에서 정한다

## 프로젝트 개요

**마이슐랭(가칭)** — 사람 단위로 신뢰하는 장소 평가 · 리스트 공유 모바일 웹.
네이버 · 카카오 지도 리뷰가 리뷰 이벤트로 오염됐다는 문제의식에서 출발한다.

- 네이버 지도 공유 리스트를 가져와 첫 화면부터 지도가 채워진 상태로 시작
- 등급: 3스타 · 2스타 · 1스타 · 추천 안 함 · 가고 싶은 곳 · 평가 전
- **평가는 선택** — 저장만 해도 지도 · 리스트를 다 쓸 수 있다. 평가는 신뢰 통계 · 추천의 재료
- 리스트 공유(비로그인 열람) · 팔로우 · 취향 겹침 기반 사람 추천 · 3스타 비교로 등급 안 순위

### 비협상 목표
1. **가게가 쓸 수 있는 레버를 두지 않는다** — 업주 답글 · 리뷰 요청 · 노출 광고 없음. 협찬 표시 평가는 통계 제외
2. **가게 단위 평균 점수를 만들지 않는다** — 누가 어떤 등급을 줬는지만 보인다. 점수를 사도 효과가 없어야 한다

### 현재 마일스톤
```
✓ M0 저장소 · 컨텍스트 세팅
✓ 스택 확정 (ADR 0001)
✓ 데이터 모델 · RLS · 카카오 로그인 · 시작하기 화면 (02)
✗ 구글 · 네이버 로그인 · 가져오기 저장 (03) · 평가 (04) · 지도 (05)
✗ 외부 리뷰 본문 수집 · 표시 — 법적 위험, 원문 링크만
```

### 결정 기록 (근거는 Vault)
- 이름 '마이슐랭' · 등급 '3스타' 표기는 가칭 — 미쉐린 상표 리스크로 **공개 출시 전 재검토**, 이름과 등급 표기는 함께 바꾼다
- 네이버 가져오기 — 공개 범위 '일부 공개' · '전체 공개' 리스트의 공유 링크로 로그인 없이 수집 (비공식 내부 API)
- 음식 종류 — 네이버 `cidPath` 코드 또는 카카오 로컬 API 카테고리
- 지도 SDK 미정 — 카카오맵 JS SDK 우선 검토 (무료 사용량)
- 로그인 — 카카오 · 구글은 로컬 실제 왕복 확인 (2026-11-20), 네이버는 Supabase 커스텀 OAuth 로 연결 예정
    - 카카오는 Supabase 가 account_email 을 항상 요청 — 비즈 앱 전환 + 이메일 동의항목(선택) 필수, 안 하면 KOE205
- 로컬 Supabase 는 553xx 포트 — 다른 로컬 Supabase(티키타카)와 충돌 회피
- 디자인 시안: https://claude.ai/artifact/WNsn9Zu7nGyQxdQxpUXc2n

## 규칙 파일

**이 프로젝트가 사용하는 언어**: TypeScript — Next.js(App Router) + Supabase · 네이버 지도. 결정 근거 [docs/adr/0001-stack.md](../docs/adr/0001-stack.md)
→ `vault/rules/coding/_common.md` + `nextjs.md` + `react.md`(공통 부분) 를 읽는다. `nextjs.md` 는 Vault 미검증본이라 쓰면서 검증한다

현재 동기화 대상: `vault/rules/coding/_common.md` · `react.md` · `nextjs.md` · `vault/rules/testing.md` · `vault/rules/git_workflow.md` · `vault/rules/logging.md`

## 베이스 대비 변경 (개인 프로젝트)
- `harvest-worklog` skill 제외 — 회사 업무일지 환원 대상 아님
- 자막 생태계 서술 무시 — 도메인이 다르다
- Git — 개인 계정 `2nan22` 로 커밋하고 `git push` 로 올린다. **`gh` 로 PR · 머지하지 않는다**
    - `git_workflow.md` 의 PR 단계는 로컬 `git merge --no-ff` 후 push 로 대체 (feat → dev, dev → main)
    - **커밋 · 머지 · push 는 묻지 않고 진행** — 꼭지마다 커밋하고 메시지는 보고에만 남긴다 (베이스의 '승인 후 다음 꼭지' 대체)
    - 커밋 · 머지 메시지에 `Co-Authored-By` 등 트레일러를 넣지 않는다 (Vault 저장소 규칙과 동일)
    - dev → main 은 마일스톤 단위로만, 사용자가 요청할 때
- 비밀값뿐 아니라 개인 데이터 · 노출이 우려되는 파일(실제 장소 메모 · 공유 링크)도 커밋 금지 · `.gitignore`

## 세션 운영
- prompt: `.claude/prompts/{NN}_{topic}.md` → 완료 시 `.claude/prompts/_complete/`
- 이력: [SESSION_LOG.md](SESSION_LOG.md)

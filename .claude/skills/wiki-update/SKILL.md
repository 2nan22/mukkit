---
name: wiki-update
description: 프로젝트에서 Claude Code로 작업하는 중에 발생한 새로운 스택 인사이트나 트러블슈팅(오류 해결)을 개인 Vault(2nan's)에 환원해 위키를 계속 최신으로 유지한다. 트러블슈팅은 유형별(docker/git/build/runtime/data/perf 등)로 분류해 기록한다. 작업 종료 시 또는 의미 있는 문제를 해결한 직후 호출한다.
---

# wiki-update

## 목적
repo에서 작업하며 얻은 자산(새 스택 사용법·해결한 문제)을 그때그때 Vault 장기기억으로 환원한다.
프로젝트가 끝나도 지식이 휘발되지 않게 하고, 다음 프로젝트가 `seed-project-context`로 재사용한다.

## Vault 경로
`/Users/2nan/Documents/2nan-obsidian/2nan's` — 템플릿은 `_templates/`, 규약은 `.claude/CLAUDE.md` 참조.

## 트리거
- 의미 있는 오류를 해결한 직후
- 새 스택/라이브러리를 처음 도입해 사용법·함정을 알게 됐을 때
- 세션 종료 체크리스트 단계

## 기록 종류

### A. 트러블슈팅 (`30_engineering/troubleshooting/`)
`_templates/troubleshooting-note.md` 사용. **유형(category)을 반드시 분류**한다:

| category | 예시 |
|---|---|
| `docker-infra` | 빌드·compose·볼륨·env 전달·GPU 런타임 |
| `runtime` | 예외·정지·수명주기·검증이 못 보는 자리 |
| `concurrency` | 큐·세마포어·취소·경쟁 상태 |
| `perf` | 지연·처리량·메모리·측정 오독 |
| `data` / `data-pipeline` | 스키마·인코딩·정규화·파싱·집계 |
| `network` | HTTP·S3 호환·프록시·타임아웃 |
| `security` | 노출 표면·인증 경계·응답에 실려 나가는 것 |
| `frontend` | 레이아웃·이벤트·라우팅·자산 |
| `build` / `git` / `db` / `media` / `model` | 각 영역 |

> 폴더는 **Vault 의 실제 하위 폴더와 일치**시킨다. 새 축이 필요하면 폴더를 먼저 만들고 쓴다.

### 📏 노트 제목 (반드시)
- **개조식 명사형**으로 닫는다 — `~한다`·`~안 된다`·`~못한다` 같은 **서술문 종결 금지**.
  명사나 `~기`·`~음`으로 닫는다(제목은 스캔하는 색인이다).
- **60바이트 이내(한글 약 20자)** 목표 · 상한 90바이트. **대상 + 현상 한 덩어리만** —
  근거·수치는 본문으로 내린다.
- `/` 와 `:` 금지(경로로 해석되거나 파일명에 못 쓴다). `·` 로 바꾼다.

frontmatter에 `category`, `stack: [...]`, `importance: 1~3`, `portfolio_ready`를 채운다.
본문은 상황→원인→조치(diff)→**정량 결과**→재사용 포인트.

### B. 스택 인사이트 (`30_engineering/stacks/`)
`_templates/stack-note.md` 사용. 어디에·왜 썼나 / 베스트 프랙티스 / 직접 겪은 인사이트.

## 절차
1. 종류(A/B) 판별, 트러블슈팅이면 category 분류.
2. 해당 템플릿으로 노트 작성. **코드/설정 diff는 최소·핵심만**, 원문 장문 복제 금지.
3. **링크 자동 생성**: 관련 `[[project]]`(`10_llm-context/projects/`), `15_concepts` 허브, 기존 노트 연결. `up::` MOC 지정.
4. 사람만 아는 값(impact 수치·역할·의사결정의 "왜")은 추측 금지 → `#status/needs-input` + 질문.
5. 큰 배치는 `00_inbox/_backfill/`에 staging 후 검수 → 이동(고아 노트 방지).

## 금지
- 정량 결과 비우고 done / 사람 영역 창작 / 링크 누락 / 원문 복제

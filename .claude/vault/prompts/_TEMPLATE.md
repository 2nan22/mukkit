# {NN}_{topic}  — 세션 prompt (self-contained 작업 지시서)

> **이 파일은 Claude가 작성한다.** 사용자가 하려는 작업을 설명하면, Claude가 이 형식의 1세션짜리
> 지시서로 변환한다(CLAUDE.md의 *Prompt 작성 정책*). 사람이 빈칸을 직접 채우는 용도가 아니다.
> 파일명: `{NN}_{topic}.md` (예: `01_infra_bootstrap.md`). 완료 후 `prompts/_complete/`로 이동.

## 0. 진입 전 필수
- `.claude/rules/`를 먼저 읽는다: `coding/_common.md` + 사용 언어·프레임워크 파일(`python.md`+`fastapi.md` / `react.md` / `html-css.md`), `logging.md`, `docker.md`, `git_workflow.md`, `testing.md`(+배포를 건드리면 `github-actions.md`).
- `dev`에서 분기: `git checkout dev && git pull && git checkout -b feat/{NN}_{topic}`

## 1. 세션 목표 (성공 기준 — 측정 가능하게)
〈〈끝났을 때 검증 가능한 상태. 가능하면 수치 임계값.〉〉

## 2. 추상화 전략 (코드 전 기술)
〈〈어떤 인터페이스를 쓰는가 / 새 구현체 추가 시 어떤 파일만 / DI는 어디서.〉〉

## 3. 진행 현황 (꼭지 = 커밋 단위, 권장 3~5개)
각 번호 = 1 커밋. 꼭지 완료마다 커밋 메시지 제시 후 승인 대기.
```
### 1. 〈〈꼭지〉〉 → 검증: 〈〈확인〉〉
### 2. 〈〈꼭지〉〉 → 검증: 〈〈확인〉〉
### 3. 〈〈꼭지〉〉 → 검증: 〈〈확인〉〉
```
> 분량 기준: 꼭지가 5~7개를 넘거나 여러 레이어를 광범위하게 동시에 건드리면 **세션을 분할**한다
> (`02_`, `03_` 신설 + 의존 순서 명시). 토큰·효율이 비례하는 만큼만 한 세션에 담는다.

## 4. 본 세션 범위 밖 (다음 세션/별도 prompt)
〈〈명시적으로 하지 않을 것. 분할 시 떼어낸 범위.〉〉

## 5. 종료 체크리스트
- [ ] 모든 꼭지 커밋 완료
- [ ] **주석 점검** — 3줄 넘는 주석 / 세션 번호·날짜가 박힌 주석이 이번 변경에 없는가
- [ ] **검사 점검** — 새로 넣은 검사가 무동작 치환에서 실제로 실패하는가 (`testing.md`)
- [ ] PR feat/* → dev (no-ff) 머지 + 브랜치 정리
- [ ] 이 파일을 `prompts/_complete/`로 이동
- [ ] `SESSION_LOG.md` 표 갱신 (변경 요약 **30~40자 이내 개조식 한 줄**)
- [ ] 새 스택·트러블슈팅(유형별)을 `wiki-update` skill로 Vault 환원
- [ ] `harvest-worklog` skill로 그날 작업을 Vault 업무일지에 append

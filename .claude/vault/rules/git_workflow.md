# git_workflow.md — 브랜치 / 커밋 / PR 규칙

모든 코드·docs 변경은 본 규칙을 따른다. 커밋 형식은 [CLAUDE.md](../CLAUDE.md)의 *Git 커밋 형식*과 일관.

---

## 브랜치 구조
```
main          ← 운영 배포 브랜치 (GitHub default). 직접 push 금지.
  └── dev     ← 통합 브랜치. 작업 브랜치는 항상 여기서 분기.
        ├── feat/01_*
        ├── fix/N_*
        ├── refactor/N_*
        ├── chore/<topic>
        └── docs/<topic>
```
- `main`: 직접 push 절대 금지. `dev`에서 PR(no-ff)로만 병합.
- `dev`: 모든 작업 브랜치가 PR(no-ff)로 병합되는 단일 지점. 직접 push 금지.
- 작업 브랜치: 세션/기능 단위. PR 머지 완료 후 로컬·원격 모두 삭제.

### 브랜치 prefix
| prefix | 용도 |
|--------|------|
| `feat/` | 새 기능 |
| `fix/` | 버그 수정 |
| `refactor/` | 동작 변경 없는 구조 개선 |
| `chore/` | 빌드·설정·의존성 |
| `docs/` | 문서(`.claude/`, `docs/`, README) |

- 영어 소문자 + 언더스코어/하이픈. 세션 작업은 prefix 뒤 세션 번호: `feat/01_infra_bootstrap`.

---

## 작업 흐름 (세션 단위)
```
1. dev 최신화 후 분기
   git checkout dev && git pull origin dev
   git checkout -b feat/01_infra_bootstrap

2. 꼭지 단위 커밋 (type: 제목 + bullet)
   - 세션 prompt의 ## 진행 현황 번호 항목 1개 = 1 커밋
   - 꼭지마다 커밋 메시지를 사용자에게 보여주고 다음 작업 전 대기

3. push
   git push -u origin feat/01_infra_bootstrap

4. PR feat/* → dev (gh CLI)
   gh pr create --base dev --head feat/01_infra_bootstrap --title "..." --body "..."

5. PR 머지 (Merge Commit, --no-ff)
   gh pr merge <N> --merge --subject "Merge pull request #N: ..." --body "..."

6. 로컬 정리
   git checkout dev && git pull origin dev
   git branch -D feat/01_infra_bootstrap

7. 원격 작업 브랜치 삭제 (사용자 승인 후)
   git push origin --delete feat/01_infra_bootstrap
```
### 릴리스 (dev → main)
```
gh pr create --base main --head dev --title "release: v0.1.0 ..." --body "..."
gh pr merge <N> --merge --subject "Merge pull request #N: release v0.1.0" --body "..."
git checkout main && git pull origin main
```

### 릴리스 태그 (main)
버전(`APP_VERSION` 등)을 범프하는 dev → main 릴리스는, main 병합 직후 그 커밋에
버전과 동일한 `vN.N.N` 태그를 단다 (예: `v1.33.0`). 배포 시점·릴리스 단위를 SHA 없이 식별.
```
git tag -a v1.33.0 -m "release v1.33.0"
git push origin v1.33.0
```
- 태그는 **main 커밋에만** (dev·작업 브랜치엔 금지). 버전 범프 없는 순수 chore·docs release 는 태그 생략.
- 푸시한 태그는 이동·삭제 금지 — 정정은 다음 패치 버전 태그로.

### 릴리스 후 운영 재빌드 안내
dev → main 릴리스 머지·태그 뒤, 이번 릴리스에서 **운영계 재빌드·재기동이 필요한 이미지**를
`dc.sh`(docker.md) 기준으로 사용자에게 알려준다.
- 변경 소스가 반영되는 **최소 이미지만** 지목 (예: `./dc.sh prod build <service> && ./dc.sh prod up <service>`).
- 코드 변경 없이 문서·설정만이면 **재빌드 불필요**임을 명시.

---

## 커밋 메시지 형식
```
type: [커밋 제목]

- 기능 요약 bullet
- 기능 요약 bullet
```
- type: `fix`/`feat`/`refactor`/`chore`/`docs`. 제목 50자 이내·현재형·마침표 없음.
- bullet: 무엇을·왜(구현 세부는 diff가 설명).
- **📌 제목·bullet 모두 개조식(명사형) — `~한다`·`~했다`·`~된다` 서술문 종결 금지.**
  명사나 `~기`·`~음`으로 닫는다. `git log --oneline` 으로 훑는 색인이라 앞 두세 단어로 판별돼야 한다.
- **본문은 문단이 아니라 bullet.** 근거·수치는 한 단계 들여쓴 하위 bullet 으로. 상세는 [CLAUDE.md](../CLAUDE.md) *Git 커밋 형식*.
- 세션 prompt 각 꼭지마다 커밋 메시지를 보여주고 승인 후 다음 진행(세션 전체 일괄 커밋 금지).

---

## PR 규칙
| PR 방향 | 병합 방식 | 이유 |
|---------|----------|------|
| `*/* → dev` | **Merge Commit(--no-ff)** | 브랜치 토폴로지 보존 |
| `dev → main` | **Merge Commit(--no-ff)** | 릴리스 단위 이력 명확 |

GitHub Settings → Pull Requests: `Allow merge commits` ✓ / `squash` ✗ / `rebase` ✗.
```bash
gh pr create --base dev --head <작업-브랜치> --title "type: 제목" --body "$(cat <<'EOF'
## Summary
- 변경 요약 bullet

## Test plan
- [ ] 검증 항목
EOF
)"
gh pr merge <N> --merge --subject "Merge pull request #N: <PR 제목>" --body "<2~3줄 요약>"
```
`--delete-branch` 자동 사용 금지 — 사용자 확인 후 별도 명령으로 원격 삭제.

---

## 배포 대상(서버)의 작업 트리
서버에 둔 체크아웃은 **작업 공간이 아니라 배포 산출물**이다.

- **서버에서 직접 고치지 않는다.** 고치면 그 변경은 어디에도 없고, 다음 배포가 조용히 덮는다.
  이미 고쳐진 것을 발견하면 **먼저 회수**한다 — 커밋으로 만들어 `dev`·`main` 에 넣고 서버를 git 상태로 되돌린다.
- **`git pull` 을 쓰지 않는다.** 서버에 로컬 변경이 있으면 pull 이 **머지 커밋을 만들어** 서버만의
  갈래가 생기고, 그때부터 배포마다 충돌한다. `fetch` 후 **정해진 지점으로 맞춘다**.
  ```bash
  git fetch --all --tags
  git reset --hard origin/main      # 또는 배포 태그
  ```
- **배포 스크립트 자신이 갱신 대상이면 순서가 있다.** 스크립트가 소스를 받아오면서 자기 자신도
  갱신되면, **구 스크립트가 새 구성을 돌린다**(빌드를 건너뛰고 옛 이미지로 뜬다). 받아오기를 먼저
  하고 **다시 호출**하거나, 배포 절차를 저장소 밖에 둔다.
- 배포 뒤 확인은 **버전 응답과 마운트·이미지 실물**로 한다 — 로그에는 이 어긋남이 안 보인다.

## 안전 수칙
- `git push --force` 금지(main/dev 절대, 작업 브랜치도 PR 생성 후 금지).
- `git rebase`/`git reset --hard`는 원격 미푸시 상태에서만. 푸시 후엔 새 커밋으로 수정.
- 머지 후 삭제 전 `git log <작업-브랜치> --not main dev`로 미반영 커밋 확인.
- 사용자에게 받지 않은 destructive 명령은 실행하지 않는다.

## 세션 prompt 와의 연결
- 세션 시작: dev에서 분기한 새 작업 브랜치 위에서 작업.
- 세션 종료: 작업 브랜치 → dev PR 머지 + 정리 + `prompts/`의 해당 파일을 `prompts/_complete/`로 이동 + `SESSION_LOG.md` 갱신.

# 04_rating — 평가 작성 · 빠르게 평가하기

## 0. 진입 전 필수
- `scripts/sync-context.sh` 실행 → 바뀐 파일이 있으면 먼저 읽는다
- 규칙: `.claude/vault/rules/coding/_common.md` · `nextjs.md` · `react.md` · `testing.md` · `git_workflow.md` · `logging.md`
- Next.js 16 가이드는 `node_modules/next/dist/docs/` 에서 먼저 읽는다 (server-actions · forms)
- 시안: CLAUDE.md 디자인 시안 링크의 `5 · 평가 작성`(Rate) · `13-1 · 빠르게 평가하기`(QuickRate) · `4 · 장소 상세`(Place) 아트보드
- `pnpm db:start` · `pnpm test:db` 통과 확인. **`pnpm db:reset` 은 계정이 지워지므로 사용자에게 먼저 묻는다**
- `git checkout dev && git pull && git checkout -b feat/04_rating`
- 꼭지마다 묻지 않고 커밋 · push, 트레일러 없음, `gh` 미사용

## 1. 세션 목표 (성공 기준)
- 내가 저장한 장소 하나에 등급 · 한마디 · 방문일 · 협찬 여부를 저장 · 수정할 수 있다
- 가져오기 완료 화면의 '빠르게 평가하기'로 평가 전 장소를 한 곳씩 넘기며 등급만 고를 수 있다
    - 안 가본 곳은 '가고 싶은 곳'으로, 건너뛰기 가능, 중간에 나가도 남은 평가 전부터 이어짐
- 등급 고르는 화면에 등급 설명(`TIER_MEANING`)이 보인다
- RLS: 남의 저장은 수정 불가 (pgTAP 또는 로컬 DB 검사로 확인)

## 2. 추상화 전략
- 쓰기는 서버 함수 하나(`rateUserPlace`)가 `user_places` 한 줄을 갱신 — 입력은 zod 로 검증, 등급 값은 DB enum 과 같은 문자열
- 도메인 `Tier`(camelCase) ↔ DB 값(snake_case) 변환은 `src/domain/tier.ts` 한 곳에 둔다 (가져오기의 `IMPORT_TIERS` 도 이쪽으로 정리)
- 빠르게 평가하기의 '다음 장소'는 평가 전 · 저장일 순으로 서버에서 한 곳씩 읽는다 — 클라이언트에 전체 목록을 싣지 않는다

## 3. 진행 현황
```
### 1. 등급 값 변환 한 곳 · rateUserPlace 서버 함수 → 검증: 단위 검사 + 로컬 DB 에서 남의 저장 수정 실패
### 2. 평가 작성 화면 (/places/[id]/rate) → 검증: 390px 화면, 저장 후 다시 열면 값 유지
### 3. 빠르게 평가하기 (/rate) · 가져오기 완료 화면 연결 → 검증: 실제 가져온 평가 전 장소로 넘기기 · 건너뛰기 · 이어하기
### 4. 홈에 평가 전 개수 · 진입 링크 → 검증: 평가하면 개수가 줄어든다
```

## 4. 범위 밖
- 지도 홈 · 지도 SDK · 장소 상세 지도 → 05
- 3스타 비교로 등급 안 순위 (시안 6)
- 폐업 여부 주기 확인 · 갱신 작업
- 사진 첨부 · 공개 프로필에 평가 노출 화면

## 5. 종료 체크리스트
- [ ] 모든 꼭지 커밋 완료
- [ ] **주석 점검** — 3줄 넘는 주석 / 세션 번호·날짜가 박힌 주석이 없는가
- [ ] **검사 점검** — 새 검사가 무동작 치환에서 실제로 실패하는가 (`testing.md`)
- [ ] **민감 데이터 점검** — 키 · 토큰 · 실제 공유 링크 · 장소 메모가 커밋에 없는가
- [ ] feat → dev `git merge --no-ff` 후 push + 브랜치 정리
- [ ] 이 파일을 `prompts/_complete/`로 이동 · 다음 세션 prompt 작성
- [ ] `SESSION_LOG.md` 표 갱신 (변경 요약 **30~40자 이내 개조식 한 줄**)
- [ ] 새 스택 · 트러블슈팅을 `wiki-update` skill로 Vault 환원 (Vault 커밋은 사용자 지시에 따름)

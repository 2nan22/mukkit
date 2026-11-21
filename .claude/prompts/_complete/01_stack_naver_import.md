# 01_stack_naver_import — 스택 확정 · 앱 뼈대 · 네이버 리스트 가져오기 모듈

## 0. 진입 전 필수
- `scripts/sync-context.sh` 실행 → 출력에 바뀐 파일이 있으면 먼저 읽는다
- 규칙 읽기: `.claude/vault/rules/coding/_common.md` · `testing.md` · `git_workflow.md` · `logging.md`
  - 꼭지 1에서 스택을 정한 뒤 해당 언어 규칙을 manifest 에 추가하고 **그 파일도 읽는다**
- 브랜치 — `dev` 에서 분기
  ```
  git checkout dev && git pull && git checkout -b feat/01_stack_naver_import
  ```
- 병합은 `gh` 를 쓰지 않는다 (`.claude/CLAUDE.md` 베이스 대비 변경)
  - `git checkout dev && git merge --no-ff feat/01_stack_naver_import && git push`
- 꼭지마다 묻지 않고 커밋 · push, 트레일러 없음. 단 꼭지 1의 **스택 선택만은 사용자 결정**

## 1. 세션 목표 (성공 기준)
- 스택 결정이 문서로 남고 manifest · CLAUDE.md 에 반영됨 — `scripts/sync-context.sh --check` 종료코드 0
- 앱 뼈대가 로컬에서 기동 · 빌드 · 검사 통과 — 빌드 · 린트 · 테스트 명령 3개 모두 종료코드 0
- 네이버 공유 링크 1개 입력 → 정규화된 장소 목록 반환
  - 실제 링크 스모크: 장소 수가 네이버 응답의 `bookmarkCount` 와 일치
  - 비공개 · 없는 링크는 구분된 오류 코드로 실패 (조용히 빈 목록 금지)
- 음식 종류 매핑: 사용자 실데이터 기준 **대분류 미매핑 5% 미만**, 미매핑은 '기타'로 계수 · 로그

## 2. 추상화 전략
- 가져오기는 `PlaceSource` 인터페이스 하나 — `fetch(input) → list[ImportedPlace]`
  - 구현체 1: `NaverSharedListSource` (공유 링크 → shareId → 비공식 내부 API)
  - SNS 링크 가져오기 등 다른 출처는 구현체만 추가, 호출부는 그대로
- `ImportedPlace` 는 출처와 무관한 정규형: `source` · `source_place_id` · `name` · `lat` · `lng` · `address` · `category_path` · `memo` · `saved_at` · `list_name`
- 음식 종류는 `category_path → Cuisine`(한식 · 중식 · 일식 · 양식 · 술집 · 카페 · 기타) 매핑 표 한 곳
  - 네이버 코드 표에서 시작, 카카오 로컬 API 보강은 범위 밖
- 비공식 API 주소 · 헤더는 설정 한 곳에 두고 호출 실패는 HTTP 상태 · 응답 오류코드를 그대로 남긴다

## 3. 진행 현황
```
### 1. 스택 결정 기록 → 검증: docs/adr/0001-stack.md 존재 · 사용자 승인 · sync --check 0
    - 후보를 표로 비교하고 사용자에게 고르게 한다 (임의 결정 금지)
        - 프론트: Next.js(App Router) vs Vite + React — Vault 규칙은 react.md 가 검증본, nextjs.md 는 미검증 보관본
        - 백엔드 · DB: Supabase(Postgres + Auth) vs FastAPI + Postgres
        - 지도: 카카오맵 JS SDK vs 네이버 지도(NCP) — 무료 사용량 · 커스텀 마커 · 클러스터링
        - 로그인: 카카오 · 구글 · 네이버 지원 방식
    - 라이브러리 버전은 2026 기준으로 검색해 확인
    - 결정 후 context.manifest 에 coding 규칙 추가 → sync → CLAUDE.md '사용 언어' 줄 갱신
### 2. 앱 뼈대 → 검증: 빌드 · 린트 · 테스트 종료코드 0, 로컬 기동 화면 확인
    - 디자인 토큰 한 층(색 · 글자 5단계 · 버튼 높이 · 그림자) — 시안 값 그대로
    - .env.example 에 키 이름만, 실제 값은 사용자가 채움
### 3. 네이버 리스트 가져오기 모듈 → 검증: 단위 테스트 + 실제 링크 스모크
    - 공유 링크(naver.me 단축 · map.naver.com 전체) → shareId 해석
    - 테스트 픽스처는 **익명화한 샘플**만 커밋 (실제 메모 · 공유 링크 커밋 금지)
    - 실제 링크 스모크는 환경변수로 받은 링크로 수동 실행, 결과 수치만 기록
### 4. 음식 종류 매핑 → 검증: 실데이터 미매핑 비율 5% 미만 수치 확인
    - cidPath 대분류 코드 → Cuisine 표, 근거 샘플(가게 이름)은 Vault 로 환원
```

## 4. 범위 밖
- 화면 구현(지도 · 리스트 · 평가) · 로그인 연동 · 지도 SDK 연동 → 02 이후
- 하루 1회 자동 동기화 스케줄러 → 가져오기 저장 모델 확정 후
- SNS 링크 가져오기 · 카카오 로컬 API 카테고리 보강
- 이름 · 등급 표기 변경 (공개 출시 전 재검토 항목)

## 5. 종료 체크리스트
- [ ] 모든 꼭지 커밋 완료
- [ ] **주석 점검** — 3줄 넘는 주석 / 세션 번호·날짜가 박힌 주석이 이번 변경에 없는가
- [ ] **검사 점검** — 새로 넣은 검사가 무동작 치환에서 실제로 실패하는가 (`testing.md`)
- [ ] **민감 데이터 점검** — 실제 공유 링크 · 장소 메모 · 키가 커밋에 없는가, 필요하면 `.gitignore`
- [ ] feat → dev `git merge --no-ff` 후 push + 브랜치 정리
- [ ] 이 파일을 `prompts/_complete/`로 이동
- [ ] `SESSION_LOG.md` 표 갱신 (변경 요약 **30~40자 이내 개조식 한 줄**)
- [ ] 새 스택 · 트러블슈팅(유형별)을 `wiki-update` skill로 Vault 환원

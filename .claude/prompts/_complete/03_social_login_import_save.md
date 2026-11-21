# 03_social_login_import_save — 구글 · 네이버 로그인 · 네이버 리스트 가져오기 저장

## 0. 진입 전 필수
- `scripts/sync-context.sh` 실행 → 바뀐 파일이 있으면 먼저 읽는다
- 규칙: `.claude/vault/rules/coding/_common.md` · `nextjs.md` · `react.md` · `testing.md` · `git_workflow.md` · `logging.md`
- Next.js 16 가이드는 `node_modules/next/dist/docs/` 에서 먼저 읽는다 (server-actions · forms · route handlers)
- `pnpm db:start` 로 로컬 Supabase(553xx 포트) 기동 · `pnpm test:db` 통과 확인
- `git checkout dev && git pull && git checkout -b feat/03_social_login_import_save`
- 꼭지마다 묻지 않고 커밋 · push, 트레일러 없음, `gh` 미사용
- **사용자 준비물** — 카카오 · 구글 OAuth 앱 키, 네이버 로그인 앱 키를 `supabase/.env` 에 (키 이름만 `.env.example` 에)

## 1. 세션 목표 (성공 기준)
- 카카오 · 구글 로그인 실제 왕복 성공 (02 에서 미확인으로 남은 카카오 포함)
- 네이버 로그인 — Supabase 커스텀 OAuth 로 왕복 성공, 안 되면 원인 · 대안을 ADR 로 남기고 버튼은 준비 중 유지
- 공유 링크 1개 → 가져오기 → DB 에 `places` · `user_places` · `lists` 저장, 다시 가져와도 중복 0
- 가져오기 진행 · 완료 · 오류(비공개 리스트) 화면이 시안 11~14번대로 동작

## 2. 추상화 전략
- 로그인 시작은 `/auth/login/[provider]` 하나로 — 공급자 목록은 `features/auth/providers.ts` 한 곳
- 가져오기 저장은 서버 함수 하나(`importNaverList`)가 01 의 `NaverSharedListSource` → 정규형 → upsert 순서로
    - 장소는 `(source, source_place_id)` upsert, 사용자 저장은 `(user_id, place_id)` upsert
    - 리스트별 가져올 방식(리스트로 · 등급 · 가고 싶은 곳)은 입력으로 받는다
- 음식 종류는 01 의 `naverCuisineOf` 결과를 `places.cuisine` 에 저장

## 3. 진행 현황
```
### 1. ✓ 구글 로그인 · 공급자 목록 정리 → 카카오 · 구글 실제 왕복
### 2. ✓ 네이버 로그인 → 커스텀 OIDC custom:naver 로 왕복 (ADR 0002)
    - 추가: 첫 로그인 닉네임 정하기 · 같은 사람의 소셜 계정 연결
### 3. ✓ 가져오기 저장 서버 함수 → 실제 4개 리스트 606곳 = 네이버 개수, 재실행 중복 0, 남의 계정 쓰기 차단
    - 리스트마다 '그냥 저장한 리스트 / 등급 리스트' 선택, 메모 · 세부 업종 · 폐업 여부 저장
### 4. ✓ 가져오기 화면 · 진행 · 완료 · 오류 → 390px 확인, 없는 리스트 링크로 오류 화면
```

## 4. 범위 밖
- 폐업 여부 주기 확인 · 갱신 작업 (places.available · source_checked_at 컬럼만 준비)
- 하루 1회 자동 동기화 스케줄러
- 빠르게 평가하기 · 평가 작성 화면 → 04
- 지도 홈 · 네이버 지도 SDK → 05
- 배포 · 호스팅 Supabase 프로젝트 연결

## 5. 종료 체크리스트
- [x] 모든 꼭지 커밋 완료
- [x] **주석 점검** — 3줄 넘는 주석 / 세션 번호·날짜가 박힌 주석이 없는가
- [x] **검사 점검** — 새 검사가 무동작 치환에서 실제로 실패하는가 (`testing.md`)
- [x] **민감 데이터 점검** — 키 · 토큰 · 실제 공유 링크 · 장소 메모가 커밋에 없는가
- [x] feat → dev `git merge --no-ff` 후 push + 브랜치 정리
- [x] 이 파일을 `prompts/_complete/`로 이동 · 다음 세션 prompt 작성
- [x] `SESSION_LOG.md` 표 갱신 (변경 요약 **30~40자 이내 개조식 한 줄**)
- [x] 새 스택 · 트러블슈팅을 `wiki-update` skill로 Vault 환원 (Vault 커밋은 사용자 지시에 따름)

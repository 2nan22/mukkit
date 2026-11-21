# 02_supabase_auth_schema — Supabase 연결 · 데이터 모델 · 카카오 로그인

## 0. 진입 전 필수
- `scripts/sync-context.sh` 실행 → 바뀐 파일이 있으면 먼저 읽는다
- 규칙: `.claude/vault/rules/coding/_common.md` · `nextjs.md` · `react.md` · `testing.md` · `git_workflow.md` · `logging.md`
- Next.js 16 은 학습 데이터와 다르다 — 코드 전에 `node_modules/next/dist/docs/` 의 해당 가이드(authentication · environment-variables · server-actions)를 읽는다
- 라이브러리 버전은 오늘 날짜 기준으로 확인 (`@supabase/ssr` · `@supabase/supabase-js` · Supabase CLI)
- `git checkout dev && git pull && git checkout -b feat/02_supabase_auth_schema`
- 꼭지마다 묻지 않고 커밋 · push, 트레일러 없음, `gh` 미사용
- **사용자 준비물** — Supabase 프로젝트 생성 · 카카오 개발자 앱 등록 · `.env.local` 값 입력 (키 이름은 `.env.example` 에만)

## 1. 세션 목표 (성공 기준)
- 로컬에서 카카오 로그인 → 세션 유지 → 로그아웃이 실제로 동작 (브라우저 확인)
- 스키마 마이그레이션이 파일로 남고 로컬 DB 에 재적용해도 같은 결과
- RLS 로 **남의 평가 · 비공개 리스트를 읽거나 쓸 수 없음**을 테스트로 고정 (무동작 치환 시 실패)
- 필수 환경변수가 비면 기동에서 실패 (조용한 기본값 금지)

## 2. 추상화 전략
- 서버 · 브라우저 Supabase 클라이언트 생성은 `src/lib/supabase/` 한 곳 — 화면 코드는 클라이언트를 직접 만들지 않는다
- 환경변수는 `src/config/env.ts` 한 곳에서 zod 로 읽고 필수 누락 시 throw
- 데이터 모델 (평가는 선택 · 가게 평균 점수 없음 원칙 반영)
  - `profiles` — 사용자 공개 정보
  - `places` — 장소 정규형 (출처 · 출처 ID 유일, 좌표 · 분류 코드 · 음식 종류)
  - `user_places` — 사용자별 저장 상태 · 등급(`Tier`) · 한 줄 평가 · 방문일 · 협찬 표시
  - `lists` · `list_items` — 사용자가 만든 리스트 · 공개 범위
  - `follows`
  - 가게 단위 집계 컬럼 · 뷰를 만들지 않는다 (비협상 목표 2)
- 네이버 로그인은 Supabase 커스텀 OAuth 로 다음 세션 이후 — 이번에는 인터페이스만 막지 않게 둔다

## 3. 진행 현황
```
### 1. Supabase 클라이언트 · 환경변수 → 검증: 필수 키 누락 시 기동 실패, .env.example 동기화
### 2. 스키마 마이그레이션 · RLS → 검증: 로컬 DB 재적용 동일 · RLS 테스트(남의 데이터 접근 거부)
### 3. 카카오 로그인 · 로그아웃 · 세션 갱신 → 검증: 브라우저에서 로그인 왕복, 보호 경로 미로그인 시 리다이렉트
### 4. 시작하기 화면(시안 0번) 구현 → 검증: 390px 폭에서 잘림 없음, 버튼 3개 터치 영역 44px 이상
```

## 4. 범위 밖
- 구글 · 네이버 로그인 → 03
- 가져오기 화면 연결 · 저장(01 모듈 사용) → 03
- 지도 홈 · 네이버 지도 SDK → 04
- 배포 · PWA 설치 · TWA

## 5. 종료 체크리스트
- [ ] 모든 꼭지 커밋 완료
- [ ] **주석 점검** — 3줄 넘는 주석 / 세션 번호·날짜가 박힌 주석이 없는가
- [ ] **검사 점검** — 새 검사가 무동작 치환에서 실제로 실패하는가 (`testing.md`)
- [ ] **민감 데이터 점검** — 키 · 토큰 · 실제 사용자 데이터가 커밋에 없는가
- [ ] feat → dev `git merge --no-ff` 후 push + 브랜치 정리
- [ ] 이 파일을 `prompts/_complete/`로 이동 · 다음 세션 prompt 작성
- [ ] `SESSION_LOG.md` 표 갱신 (변경 요약 **30~40자 이내 개조식 한 줄**)
- [ ] 새 스택 · 트러블슈팅을 `wiki-update` skill로 Vault 환원

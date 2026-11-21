# ADR 0001 — 스택

- 상태: 채택 (2026-11-20)
- 결정자: 사용자

## 결정

| 항목 | 선택 | 버전 (2026-11 확인) |
|---|---|---|
| 형태 | 모바일 웹(PWA) → 안드로이드 스토어(TWA) → iOS | — |
| 프론트 + 서버 | Next.js App Router · TypeScript strict | next 16.4.6 |
| DB · 로그인 | Supabase (Postgres · Auth) | supabase-js 2.119.2 · @supabase/ssr 0.12.7 |
| 지도 | 카카오맵 JavaScript SDK (2026-11-21 변경 · 아래 변경 이력) | v2 |
| 패키지 매니저 | pnpm | 11.4.0 |
| 런타임 | Node.js | 로컬 25.9.0 · Next 16 최소 20.9 |

## 근거

- **갤럭시 사용자 우선** — 안드로이드 크롬은 PWA 설치 · 푸시 · 위치 제약이 적고, 같은 웹앱을 TWA 로 플레이스토어에 올릴 수 있다
- **Next.js** — 공유 리스트 링크의 카카오톡 미리보기(OG)에 서버 렌더가 필요하고, 네이버 리스트 가져오기는 브라우저가 아니라 서버에서 호출해야 한다
- **Supabase** — 카카오 · 구글 로그인 기본 지원, Postgres 로 팔로우 · 리스트 관계를 그대로 표현. 개인 프로젝트라 서버 운영 부담을 줄인다
- **네이버 지도** — 대표 계정 기준 월 600만 건 무료. 가져오는 장소가 네이버 데이터라 좌표 · 장소 ID 가 그대로 맞는다
- **TypeScript 하나** — 화면 · 서버 · 가져오기 모듈이 같은 타입을 공유한다

## 변경 이력

- 2026-11-21 지도 네이버 → 카카오맵 — 네이버 클라우드는 결제수단 등록 전엔 Maps 사용 불가. 카카오는 계정의 첫 활성화 앱(마이슐랭)에 무료 쿼터가 붙어 카드 없이 사용. 지도는 `PlaceMap` 하나가 감싸 다시 바꿀 때 그 파일만 고친다

## 버린 대안

- Vite + React — Vault 검증 규칙(`react.md`)이 있으나 SPA 라 공유 미리보기 · 가져오기용 서버를 따로 둬야 한다
- FastAPI + Postgres — Vault 검증 규칙(`python.md` · `fastapi.md`)이 있으나 언어가 둘로 나뉘고 로그인 3종 · 호스팅을 직접 구성해야 한다
- 카카오맵 — 2026-07 정책으로 계정당 첫 앱만 무료 쿼터, 장소 데이터 출처가 네이버라 좌표 맞춤이 한 단계 더 든다
- 처음부터 네이티브 앱(Expo) — 스토어 심사 · 배포가 먼저 필요하고, 공유받은 사람용 웹 페이지를 따로 만들어야 한다

## 확인이 남은 것

- 네이버 로그인 — Supabase 기본 제공이 아니라 커스텀 OAuth(호스팅 프로젝트당 최대 3개)로 연결. 실제 로그인 · 프로필 필드 동작은 로그인 세션에서 확인
- Vault 의 `nextjs.md` 는 미검증 보관본 — 이 프로젝트에서 쓰며 검증하고 결과를 Vault 로 환원

## 출처

- https://nextjs.org/blog/next-16-2
- https://supabase.com/docs/guides/auth/social-login/auth-kakao
- https://supabase.com/docs/guides/auth/custom-oauth-providers
- https://m.ncloud.com/charge
- https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222

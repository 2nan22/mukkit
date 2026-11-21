# ADR 0002 — 네이버 로그인

- 상태: 채택 (2026-11-20) · 로컬 실제 왕복 확인 (2026-11-20)
- 결정자: 사용자 요청 → 구현 판단

## 결정

네이버 로그인은 Supabase **커스텀 OIDC 공급자 `custom:naver`** 로 붙이고, 사용자 정보는 **id_token** 에서 읽는다.

- issuer `https://nid.naver.com` (디스커버리 문서 기준 scope `openid` · `profile`, PKCE S256, `client_secret_post`)
- 이메일은 요청 · 저장하지 않음 (`email_optional`)
- 공급자는 설정 파일이 아니라 관리 API 로 등록 → `scripts/register-naver-provider.sh` (`pnpm auth:naver`, `pnpm db:reset` 에 포함)
- 키는 `supabase/.env` 의 `NAVER_LOGIN_CLIENT_ID` · `NAVER_LOGIN_CLIENT_SECRET`

## 근거 (Supabase Auth v2.189.0 소스 확인)

- 기본 공급자에 네이버가 없다
- **커스텀 OAuth2(userinfo 방식)는 안 된다** — 네이버 `v1/nid/me` 는 값을 `response` 안에 감싸 주는데,
  인증 서버가 응답을 고정된 필드 구조로 읽어 `response` 를 버린다. `attribute_mapping` 도 최상위 키만 옮긴다
- **userinfo 를 펴 주는 중계 주소도 로컬에선 안 된다** — 공급자 주소 검사가 HTTPS · 공개 주소만 허용(로컬 · 사설 주소 거부)
- 네이버 OIDC 를 쓰면 id_token 경로를 타므로 위 두 문제가 없다

## 버린 대안

- 커스텀 OAuth2 + userinfo 중계 라우트 — 운영(공개 HTTPS)에선 되지만 로컬 개발이 막히고 경로가 하나 더 생김
- 네이버 OAuth 를 앱 서버에서 직접 처리하고 Supabase 세션을 따로 발급 — 관리자 키 · 세션 발급 코드가 늘어남

## 확인이 남은 것

- ~~일반 네이버 개발자 앱에서 OIDC 지원 여부~~ — 개발 중 앱 + 테스트 ID 로 로컬 왕복 성공
- id_token 에 닉네임 · 프로필 사진이 없음 (sub · iss · aud · iat · exp 만) — 첫 로그인 닉네임 정하기 화면으로 해결
- 검수 후 일반 사용자 로그인에서도 OIDC 가 같은지는 운영 전환 때 확인
- 운영 Supabase(호스팅)에서는 무료 플랜 커스텀 공급자 3개 제한 안에 든다

## 출처

- https://nid.naver.com/.well-known/openid-configuration
- https://supabase.com/docs/guides/auth/custom-oauth-providers
- supabase/auth v2.189.0 `internal/api/provider/custom_oauth.go` · `internal/utilities/url_validator.go`
- https://github.com/naver/naveridlogin-API/issues/118

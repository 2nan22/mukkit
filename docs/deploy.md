# 배포 절차 (비공개 배포)

Vercel(앱) + Supabase 호스팅(DB · 인증 · 사진). 둘 다 **서울** — 처리방침 제7조와 맞춘다.

## 1. Supabase 호스팅 프로젝트

1. supabase.com 에서 새 프로젝트 — Region **Northeast Asia (Seoul)**, 무료 플랜
2. 로컬에서 연결하고 마이그레이션 적용
   ```bash
   supabase login
   supabase link --project-ref <프로젝트 ref>
   supabase db push
   ```
   - 마이그레이션에 `rating-media` 버킷 · 정책이 들어 있어 Storage 도 함께 만들어진다
3. Authentication › URL Configuration
   - Site URL: `https://<배포 주소>`
   - Redirect URLs: `https://<배포 주소>/**`
4. Authentication › Providers
   - Kakao: Client ID = 카카오 REST API 키, Secret = 카카오 Client Secret
   - Google: 웹 클라이언트 ID · Secret
   - 네이버(커스텀 OIDC): 로컬과 같은 스크립트를 호스팅 주소로
     ```bash
     NAVER_TARGET_URL=https://<프로젝트 ref>.supabase.co NAVER_TARGET_SECRET=<service_role 키> pnpm auth:naver
     ```
     - 인증 관리 API 는 새 `sb_secret_` 키를 Bearer 로 받지 않는다 — API Keys › Legacy 의 **service_role** 키를 쓴다 (401 no_authorization)

## 2. 로그인 · 지도 콘솔에 운영 주소 등록

| 콘솔 | 넣을 곳 | 값 |
|---|---|---|
| 카카오 개발자 | 카카오 로그인 › Redirect URI | `https://<프로젝트 ref>.supabase.co/auth/v1/callback` |
| 카카오 개발자 | 플랫폼 › Web 사이트 도메인 (지도 JavaScript SDK) | `https://<배포 주소>` |
| Google Cloud | OAuth 클라이언트 › 승인된 리디렉션 URI | `https://<프로젝트 ref>.supabase.co/auth/v1/callback` |
| 네이버 개발자 | API 설정 › Callback URL | `https://<프로젝트 ref>.supabase.co/auth/v1/callback` |

## 3. Vercel

1. vercel.com › Add New › Project › GitHub `2nan22/mychelin` 가져오기
2. Production Branch: `main` (Settings › Git)
3. Environment Variables (Production)

   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<프로젝트 ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase › API Keys › publishable |
   | `SUPABASE_SECRET_KEY` | Supabase › API Keys › secret (서버 전용) |
   | `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 JavaScript 키 |
   | `KAKAO_REST_API_KEY` | 카카오 REST API 키 |
   | `CRON_SECRET` | 임의의 긴 문자열 (`openssl rand -hex 32`) |
   | `NEXT_PUBLIC_CONTACT_EMAIL` · `NEXT_PUBLIC_OPERATOR_NAME` | 공개 출시 전에 |

4. `vercel.json` 이 함수 지역(서울 `icn1`)과 크론(매일 18:00 UTC = 새벽 3시)을 정한다

## 4. 배포 뒤 확인

- 로그인 3종 · 가져오기 · 지도 · 장소 검색 · 공유 링크 카카오톡 미리보기 (실제 휴대폰)
- 크론 수동 실행
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<배포 주소>/api/cron/closure-check
  ```
  → `{"ok":true,...}` 그리고 Supabase `job_runs` 에 한 줄
- 새벽 크론이 매일 DB 에 쓰므로 무료 플랜 7일 비활성 정지가 생기지 않는다

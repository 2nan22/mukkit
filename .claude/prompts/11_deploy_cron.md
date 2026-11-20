# 11_deploy_cron — 배포 · 새벽 폐업 확인 작업

## 0. 진입 전 필수
- `scripts/sync-context.sh` · 규칙 파일(`github-actions.md` 포함 — 배포 자동화)
- Vercel · Supabase 호스팅 · 카카오 / 구글 / 네이버 콘솔 최신 문서 (날짜 기준 검색)
- **사용자 준비물** — Supabase 호스팅 프로젝트, Vercel 계정, 도메인(선택), 각 로그인 앱의 운영 주소 등록
- `git checkout dev && git pull && git checkout -b feat/11_deploy_cron`

## 1. 세션 목표 (성공 기준)
- 호스팅 Supabase 에 마이그레이션 적용 · 네이버 OIDC 등록 · Storage 버킷
- Vercel 배포 (main 기준) · 환경 변수 · 카카오맵 JavaScript SDK 도메인 · OAuth 리다이렉트 주소 등록
- 매일 새벽 크론: 폐업 여부 확인(네이버 · 카카오 원문 다시 읽기) → places.available · source_checked_at 갱신 → job_runs 에 실행 기록
    - Supabase 무료 플랜 비활성 정지 방지 겸용 · 서비스 키는 서버 크론에만
- 실제 휴대폰에서 로그인 · 가져오기 · 지도 · 공유 링크 카카오톡 미리보기 확인

## 2. 추상화 전략
- 폐업 확인은 PlaceSource 에 상세 다시 읽기 하나 추가 — 크론 라우트는 출처를 모른다
- 크론 라우트는 비밀 헤더로만 실행 · 한 번에 N곳씩 나눠 처리

## 3. 진행 현황
```
### 1. job_runs · 폐업 확인 서비스 · 로컬 검사
### 2. 크론 라우트 · Vercel Cron(또는 GitHub Actions) 설정
### 3. 호스팅 Supabase · Vercel 배포 · 콘솔 주소 등록 (사용자와 함께)
### 4. 실기기 확인 · 캡처 아티팩트
```

## 4. 범위 밖
- 플레이스토어(TWA) 올리기 · 좋아요 · 댓글

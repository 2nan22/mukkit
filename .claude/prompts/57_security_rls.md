# 57_security_rls — 링크 리스트 RLS · 오픈 리다이렉트 · 차단 · 온보딩 우회

## 0. 진입 전 필수
- `.claude/rules/`: `coding/_common.md` · `nextjs.md` · `react.md` · `testing.md` · `git_workflow.md`
- 근거: `docs/qa/56/findings.json` 의 Q01 · Q04 · Q05 · Q06 · Q28 · Q31 · Q32 · Q35 · Q36 · 보고서 https://claude.ai/artifact/2crd8N8pfXchmANpiLxhKA
- `git checkout dev && git pull && git checkout -b fix/57_security_rls`
- 시험 데이터: `node scripts/qa-seed.mjs <폴더>` (머리 주석의 환경변수) · 새 마이그레이션은 `supabase migration up --local` (db:reset 은 사용자에게 먼저)

## 1. 세션 목표 (성공 기준)
- 비로그인 · 남이 공개 키로 `lists?visibility=eq.link` 를 조회하면 **0행** · /l/{id} 는 그대로 열림
- `safeNextPath` 가 제어 문자 · 다른 origin 으로 풀리는 값을 모두 `/home` 으로 — 단위 시험으로 고정
- 차단한 사이에는 lists · list_items · follows · profile_lists 가 서로 0행 · is_blocked 는 본인이 낀 쌍만
- 닉네임 · 약관 전 계정은 보호 화면 어디서든 온보딩으로 (초대 링크 참여 포함)

## 2. 추상화 전략
- 읽기 권한은 RLS 한 곳에서 — link 는 직접 읽기를 막고 id 를 아는 security definer 함수(public_list 등)로만
- 이동 허용 판정은 `safeNextPath` 하나 · 온보딩 확인은 proxy(또는 공용 레이아웃) 하나에 — 화면마다 흩지 않음

## 3. 진행 현황 (꼭지 = 커밋 단위)
```
### 1. 링크 리스트 RLS (Q01) → 검증: 비로그인 REST 0행 · /l 정상 · pgTAP 시험
### 2. 차단 RLS · is_blocked · join_meetup · 댓글 푸시 대상 (Q05 · Q31) → 검증: 차단 계정 claims 로 0행 · 시험
### 3. safeNextPath · 보호 경로 목록 (Q04 · Q28) → 검증: '/\t/x.com' 등 시험 · /meet/new 비로그인 리다이렉트
### 4. 온보딩 우회 막기 (Q06) → 검증: 계정 b 로 /map · /m/{token} 참여 시 온보딩으로
### 5. profiles 공개 칸 · 숨긴 기능 액션 · 크론 인증 공용화 · 시험 정리 (Q32 · Q35 · Q36) → 검증: 비로그인 profiles 칸 · 액션 거절
```

## 4. 범위 밖
- 1000행 · 큰 리스트(58) · 흐름(59) · 디자인(60)

## 5. 종료 체크리스트
- [ ] 꼭지별 커밋 · fix/57 → dev no-ff 머지 · push · 브랜치 정리
- [ ] 이 파일 `_complete/` · SESSION_LOG 한 줄 · 운영 반영은 사용자 요청 시(main push = 배포)

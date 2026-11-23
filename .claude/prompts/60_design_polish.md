# 60_design_polish — 선택 색 · 아이콘 · 줄바꿈 · 대비 · 용어 · 알림 묶기

## 0. 진입 전 필수
- `.claude/rules/`: `coding/_common.md` · `nextjs.md` · `react.md` · `testing.md` · `git_workflow.md`
- 근거: `docs/qa/56/findings.json` 의 Q20 ~ Q25 · Q33 · Q37 ~ Q44 · 디자인 시안 https://claude.ai/artifact/WNsn9Zu7nGyQxdQxpUXc2n
- `git checkout dev && git pull && git checkout -b feat/60_design_polish`

## 1. 세션 목표 (성공 기준)
- 주황은 화면당 주 버튼 하나 · 선택(라디오 · 세그먼트)은 모두 검정 — 화면 63장 다시 캡처해 대조
- 등급 버튼 전부 TierIcon · 390px 에서 단어 가운데 줄바꿈 0
- 보조 글자 대비 4.5:1 이상 (토큰 한 곳)
- **사용자 결정 필요**: Q37 용어 통일안(취향 겹침/일치 · 수정/고치기 · 리스트 섹션 이름) — 표로 묻고 시작

## 2. 추상화 전략
- 색 · 글자는 globals.css 토큰 한 층에서 · 세그먼트 · 스위치 · 버튼은 components/ui 공용 하나씩 — 화면은 가져다 쓰기만

## 3. 진행 현황 (꼭지 = 커밋 단위)
```
### 1. 토큰 · 전역 (대비 · keep-all · color-scheme) (Q22 · Q23 · Q44) → 검증: 대비 계산 · 캡처
### 2. 선택 표시 · 세그먼트 · 버튼 · 스위치 통일 (Q20 · Q42) → 검증: 해당 화면 캡처
### 3. 등급 아이콘 · 약관 화면 · 지도 핀 · 칩 줄 (Q21 · Q24 · Q25 · Q43) → 검증: C01 · C07 · C08 · A05
### 4. 문구 · 용어 · 알림 묶기 · 순위 화면 (Q33 · Q37 ~ Q41) → 검증: 결정한 용어 grep 0건
```

## 4. 범위 밖
- 다크 모드 전체 지원(color-scheme 명시까지만) · 보안 · 큰 데이터 · 흐름

## 5. 종료 체크리스트
- [ ] 꼭지별 커밋 · feat/60 → dev no-ff 머지 · push · 브랜치 정리
- [ ] 화면 캡처를 구현 화면 아티팩트에 · 이 파일 `_complete/` · SESSION_LOG 한 줄

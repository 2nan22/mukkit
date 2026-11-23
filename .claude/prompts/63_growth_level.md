# 63_growth_level — 평가 · 사람 관계로 자라는 캐릭터 · 레벨

## 0. 진입 전 필수
- `.claude/rules/`: `coding/_common.md` · `nextjs.md` · `react.md` · `testing.md` · `git_workflow.md`
- 설계안: https://claude.ai/artifact/VMZawLZaEzFu5oU7bnoSVX (원본 docs/growth/level_design.html)
- **사용자 결정 먼저** (설계안 '정해 주실 것'): 캐릭터 A 숟이 · B 쌀톨 · C 깃발 / 남에게 보이기 / 팔로워 반영 / 진화 갈래
- `git checkout dev && git pull && git checkout -b feat/63_growth_level`

## 1. 세션 목표 (성공 기준)
- 점수는 쌓지 않고 지금 기록에서 다시 계산 — 평가를 지우거나 신고 3건으로 숨겨지면 바로 빠짐 · 협찬 0점 (pgTAP)
- 점수표 그대로: 평가 10(50개 넘으면 3) · 한 줄 평가 +5 · 사진 +5 · 새 동네 +20 · 새 세부 업종 +15 · 순위 +10(10위까지) · 받은 좋아요 +2(사람 · 평가마다 1번, 평가당 20) · 리스트 저장됨 +10 · 함께 방문 수락 +10 · 첫 가져오기 +30
- 레벨 L 누적 = 25·L·(L−1), 1 ~ 30, 6레벨마다 단계
- MY 맨 위 카드: 캐릭터 · 레벨 막대 · 다음 할 일 한 줄 · 평가 저장 뒤 작은 점수 알림 · 레벨 오름 시트 한 번
- 레벨은 평가 옆 · 정렬 · 추천에 쓰지 않음 (비협상 목표)

## 2. 추상화 전략
- DB 함수 `my_growth()` 하나(security definer, 본인만) → 점수 항목별 합 · 레벨 · 다음 단계까지 · 갈래 업종
- 점수 규칙 수치는 `domain/growth.ts` 한 곳 + DB 함수와 같은 시험 표본으로 대조
- 캐릭터 그림은 단계 × 갈래 파일(public/growth/) — 교체 지점 `components/growth/Character.tsx`

## 3. 진행 현황 (꼭지 = 커밋 단위)
```
### 1. my_growth() + pgTAP (지우기 · 숨김 · 협찬 · 상한) → 검증: 시험 통과
### 2. domain/growth.ts 레벨 · 다음 할 일 + 단위 시험 → 검증: 경계값
### 3. MY 카드 · 다음 할 일 · 점수 알림 · 레벨 오름 시트 → 검증: 시드 계정 A · D 캡처
### 4. 캐릭터 그림 5단계 × 갈래 → 검증: 디자인 검토 · 다크 아님 확인
```

## 4. 범위 밖
- 공개 리더보드 · 리그 · 스트릭 · 방치 벌칙 (원칙상 안 함)
- 레벨 보상(기능 잠금 해제)

## 5. 종료 체크리스트
- [ ] 꼭지별 커밋 · feat/63 → dev no-ff · push
- [ ] 이 파일 `_complete/` · SESSION_LOG 한 줄 · CLAUDE.md 결정 기록

# 05_kakao_import — 카카오맵 즐겨찾기 폴더 가져오기

## 0. 진입 전 필수
- `scripts/sync-context.sh` 실행 → 바뀐 파일이 있으면 먼저 읽는다
- 규칙: `.claude/vault/rules/coding/_common.md` · `nextjs.md` · `react.md` · `testing.md` · `git_workflow.md` · `logging.md`
- `pnpm db:start` · `pnpm test:db` 통과 확인. **`pnpm db:reset` 은 사용자에게 먼저 묻는다**
- `git checkout dev && git pull && git checkout -b feat/05_kakao_import`
- 꼭지마다 묻지 않고 커밋 · push, 트레일러 없음, `gh` 미사용

## 1. 세션 목표 (성공 기준)
- 카카오맵 공개 폴더 링크 → 가져오기 화면에서 네이버와 같은 흐름으로 저장
    - 저장 수 = 폴더 장소 수 (형식이 깨진 항목은 건너뜀 수로 설명), 재실행 중복 0
- 좌표가 실제 위치와 맞음 (카카오맵 화면 좌표와 오차 10m 이내)
- 음식점은 음식 종류(한식 등)로 분류, 미분류 5% 미만
- 비공개 · 없는 폴더는 공개로 바꾸는 법 안내
- 세션 끝에 화면 캡처 아티팩트 갱신

## 2. 추상화 전략
- `PlaceSource` 구현체 `KakaoFolderSource` 추가 — 비공식 주소 · 헤더는 `kakao/config.ts` 한 곳
- 링크로 출처를 고르는 `sourceForLink` 하나 — 화면 · 서버 함수는 출처를 모른다
- 음식 종류는 출처가 정해 `ImportedPlace.cuisine` 에 담는다 (저장 함수는 출처 무관)

## 3. 진행 현황
```
### 1. 카카오 폴더 · 장소 · 업종 응답 조사, 좌표 변환 검증 → 검증: 알려진 장소 3곳 좌표 오차
### 2. KakaoFolderSource · 음식 종류 매핑 → 검증: 익명 고정 응답 단위 검사
### 3. 출처 무관 가져오기 (sourceForLink · 화면 문구) → 검증: 네이버 회귀 없음, 카카오 링크 미리보기
### 4. 실제 공개 폴더로 저장 · 재실행 · 오류 화면 → 검증: 개수 일치 · 중복 0 · 캡처 아티팩트
```

## 4. 범위 밖
- 같은 가게의 네이버 · 카카오 장소를 하나로 합치기
- 구글 테이크아웃 파일 가져오기
- 지도 홈 → 06

## 5. 종료 체크리스트
- [ ] 모든 꼭지 커밋 완료
- [ ] **주석 점검** — 3줄 넘는 주석 / 세션 번호·날짜가 박힌 주석이 없는가
- [ ] **검사 점검** — 새 검사가 무동작 치환에서 실제로 실패하는가 (`testing.md`)
- [ ] **민감 데이터 점검** — 키 · 토큰 · 실제 공유 링크 · 장소 메모가 커밋에 없는가
- [ ] 화면 캡처 아티팩트 갱신
- [ ] feat → dev `git merge --no-ff` 후 push + 브랜치 정리
- [ ] 이 파일을 `prompts/_complete/`로 이동 · 다음 세션 prompt 작성
- [ ] `SESSION_LOG.md` 표 갱신 (변경 요약 **30~40자 이내 개조식 한 줄**)
- [ ] 새 스택 · 트러블슈팅을 `wiki-update` skill로 Vault 환원 (Vault 커밋은 사용자 지시에 따름)

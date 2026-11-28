# 97 서비스 전체 QA · QC 와 남은 P2

> 2026-11-28 세션에서 넘김 — 토큰이 모자라 전체 QA 를 중간에 멈춤. 다음 세션에서 이어서 한다.
> 먼저 읽기: `.claude/CLAUDE.md` · `vault/rules/coding/_common.md` · `nextjs.md` · `react.md` · `testing.md`

## 목표
1. 서비스 전체 QA · QC — 발견 목록 `docs/qa/97/findings.json`(56 과 같은 형식) · 보고서 아티팩트
2. 아래 P2 중 고칠 것 고치기 → dev → 사용자 요청 시 운영

## 1. 전체 QA (멈춘 상태에서 다시)
- 범위: 전 화면 · 기능 (CLAUDE.md 마일스톤 · 결정 기록이 기대 동작). 56 결과(docs/qa/56/findings.json, https://claude.ai/artifact/2crd8N8pfXchmANpiLxhKA) 회귀도 함께
- 팀: 보안 · 데이터 / 기능 흐름 / 디자인 · 문구 / 성능 · 코드 — 병렬, 팀장이 걸러 P0 · P1 · P2
- 멈춘 시점 중간물(git 밖): `.playwright-mcp/qa97/`
    - 디자인 375px 캡처 약 180장 · `des-sweep-1~4.json`(화면별 점검 결과, 아직 안 걸러짐)
    - 기능 흐름 스크립트 `flow-*.js` — 세션 · 환경 파일은 지움, 쓰려면 shot2.js 첫 7줄로 다시
    - 이어서 할 때 des-sweep json 을 먼저 걸러 발견으로 옮기고 나머지 팀만 돌린다
- 지킬 것: 코드 수정 없이 발견만 · 외부 전송(카카오 공유 · 실제 가져오기 · 푸시) 금지 · db reset 금지 · 세션 값 파일에 남기지 않기

## 2. 96 QA 에서 남긴 P2 (팀장 보고 2026-11-28)
- [ ] 끝난 약속도 이름 바꾸기 가능 — 막을지 사용자 결정 (meet/[meetupId]/page.tsx editable, RLS 상태 조건 없음)
- [ ] 같은 약속 자동 이름이 홈 · 상세 · 목록에서 다름 — homeMeetup.homeTiles · MeetupCalendar.title() · 상세 title 한 곳으로
- [ ] 홈 미니 지도 첫 자리와 지도 탭 첫 자리가 다름 — HomeMiniMap 링크에 좌표(at) 넘기기
- [ ] 홈 미니 지도 묶음 핀이 위 가장자리 · 동네 이름표에 가림
- [ ] 많이 저장된 리스트 카드 'N곳' 배지가 썸네일 아이콘과 겹침 (ListThumb card)
- [ ] 지도 '이 화면에 N곳'이 새로 고침 앞뒤로 다름 — 원인 미확인 (qa96/map-3-zoomed*.png)
- [ ] 지도 마지막 자리가 계정과 안 묶임 — 키에 사용자 id
- [ ] DB 제약이 폭 없는 공백뿐인 약속 이름을 못 막음(API 직접 호출 때만)
- [ ] 오늘 변경 밖: 약속 목록 시간 '오후 7:00'(다른 화면 '저녁') · MeetupResults key 경고 · 링크 복사 뒤 반응 안 보임
- [ ] 정리: domain/meetup.ts 주석 위치 · MyHomeSections MyMap 설명 주석 · HomeSections 빈 줄
- [ ] 시험 빠진 곳: renameMeetup 액션 · getHomeMeetup 고르기 · readLastView 와 /map?list= 첫 자리

## 완료 기준
- findings.json · 보고서 아티팩트 · 사용자 검토
- 고친 P2 마다 커밋 · 단위 / DB 시험 통과(closure 1건은 원래 실패)

## 후보 작업 (사용자 요청 2026-11-28, 97 이후 별도 세션 가능)
- [ ] 약속 코스에 내 장소 밖의 가게도 담기
    - 지금: 코스 후보가 내 장소(가고 싶은 곳 · 다녀온 곳)와 추천 가게뿐
    - 바라는 것: 그 밖의 가게도 검색해 코스에 넣기
    - 실마리
        - 장소 만들기는 지금처럼 서버가 카카오에 다시 찾아 같은 가게일 때만 (upsertPlaces, 32) · 업종 FD6 · CE7
        - 약속 화면에는 이미 searchMeetupPlace(만날 곳 검색)가 있음 — 같은 검색 재사용 검토
        - set_meetup_course 의 장소 조건(내 장소 여부 등) 확인, 참여자 아무나 넣을 수 있게 할지
        - 담은 가게를 내 장소에 자동 저장할지는 사용자 결정 (기본은 저장 안 함 제안)
    - 화면: 코스 카드 · /meet/[id]/course 에 '가게 검색해서 담기' · 최대 5곳 규칙 그대로

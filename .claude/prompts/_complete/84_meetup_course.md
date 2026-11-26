# 84 약속 코스 — 1차 › 2차 순서 · 실제 걷는 길

> 먼저 읽기: `.claude/vault/rules/coding/_common.md` · `nextjs.md` · `react.md` · `testing.md`
> 시안: https://claude.ai/artifact/JT6PAim86nCVjsNALfMDT5 (가게 담기 · 코스 순서와 동선 · 함께 보는 약속 화면)

## 배경 (사용자 2026-11-27 '트리플처럼 순서 정해 동선을 지도에', '실제 이동거리로 되나' › '해봐')
- 약속은 지금 지역 하나만 제안한다. 가게 여러 곳을 순서대로 정하는 단계가 없다
- 카카오맵 REST `GET https://dapi.kakao.com/v2/routing/walk` (2026-07-21 공개, 하루 1,000건 무료, KakaoAK REST 키)
    - start_x/y · end_x/y · via_x/via_y 쉼표로 최대 5곳 · X 가 경도
    - 응답 status(OK · SAME_POINT · TOO_FAR_AWAY 등) · route.properties.totalDistance(m)/totalTime(s) · route.legs[].properties.distance/time · legs[].steps[].path.points [[x,y],…]

## 성공 기준
- 약속 가게 목록에서 '+ 코스'로 담으면 담은 순서대로 1차 › 2차 (최대 5곳), 같은 약속의 모두가 같은 코스를 보고 고친다 (RLS · 멤버만)
- 코스 화면: 번호 핀 + 실제 걷는 길 선 · 구간마다 '걸어서 9분 650m' · 끌어서(키보드 포함) 순서 바꾸기 · 빼기
- 길 조회는 코스가 바뀔 때만 서버가 한 번 (한 번에 전체 · 경유지) 부르고 약속에 저장 — 화면 열 때 부르지 않음
- 조회 실패 · 쿼터 · 키 없음이면 직선 어림(점선) + '직선거리로 어림한 시간이에요'
- 약속 화면에 코스 카드(미니 지도 · 1차 2차 · 코스 고치기 · 길찾기), 코스가 있으면 아래 버튼은 '이 코스로 제안하기'
- 390px 캡처 · 디자인 · 코드 검토

## 추상화
- `domain/course.ts` — 직선 어림(걷기 분 · m) · 경로 점 줄이기 · 응답 해석 (순수 함수, 시험)
- `features/meetup/walkRoute.ts` — 카카오 호출 한 곳 (교체 지점: 다른 길찾기로 바꿀 때 이 파일만) · timedFetch 10초
- DB: `meetup_course`(약속 · 장소 · 순서 · 담은 사람) + `meetups.course_route` jsonb(키 · 구간 · 선). 고치기는 `set_meetup_course` 함수(멤버 확인 · 5곳 · 통째로 바꿈 · 경로 지움), 경로 저장은 서버 서비스 키만
- `PlaceMap` — `route`(선) · 핀 번호 표시 추가, 기존 쓰임은 그대로

## 꼭지
1. DB · 도메인 · 길 조회 → 검증: DB 시험(멤버만 · 5곳 · 남은 못 씀) · 도메인 시험 · 실제 호출 한 번(로컬)
2. 지도 번호 핀 · 선 → 검증: 캡처
3. 가게 담기 · 코스 화면(/meet/[id]/course) · 순서 바꾸기 → 검증: 캡처 · 키보드
4. 약속 화면 코스 카드 · 제안하기 문구 → 검증: 캡처
5. 검토 · 아티팩트 · dev 머지

## 범위 밖 (84-2)
- 다녀온 곳 기록의 1차 · 2차를 코스로 미리 채우기
- 코스 바뀜 알림(푸시 · 알림함)
- 약속 화면 이동 시간을 대중교통 경로 API 로 바꾸기

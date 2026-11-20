# coding/nextjs.md — Next.js / TypeScript 코딩 지침

> `_common.md` 를 먼저 읽고, **Next.js 를 쓰는 화면**에 추가로 본 파일을 적용.
> 공통 부분(레이아웃·토큰·상태·자산)은 `react.md` 를 따르고, 여기서는 Next.js 고유 부분만 다룬다.

## 버전 / 도구
- Next.js App Router 기준, React 함수형 컴포넌트 + Hook. 패키지 매니저는 프로젝트 합의(pnpm 권장).
- TypeScript **strict** 모드. 린트 `eslint`(next core-web-vitals) + `prettier`.

## 타입
- `any` 금지(외부 미타입 응답은 좁은 타입으로 즉시 변환). 공용 타입은 `types/`에 모은다.
- 컴포넌트 props·API 응답은 명시적 interface/type. 런타임 검증 필요 시 `zod`.

## 컴포넌트 / 구조
- **Server Component(기본) ↔ Client Component(`"use client"`) 경계를 명확히.** 상호작용·상태가 필요한 곳만 client.
- 폴더: `app/`(라우트) · `components/`(ui·layout·feature) · `hooks/` · `stores/` · `lib/` · `types/`.
- 비즈니스 로직은 컴포넌트에서 분리 → custom hook 또는 `lib/`. 컴포넌트는 렌더링에 집중.
- 전역 상태는 단일 store(Zustand 등) + slice 분리. 과도한 전역화 금지(서버 상태는 데이터 패칭 레이어).

## 스타일링
- Tailwind 기준. 디자인 토큰/유틸 우선, 임의 인라인 매직값 지양.

## 로깅 / 콘솔
- 운영 빌드에서 `console.log` 제거(디버그 잔존 금지). 에러는 Error Boundary + 리포터 경유.
- 민감정보(토큰·PII) 콘솔 출력 금지.

## 네이밍
- 컴포넌트 PascalCase(파일도 동일) / hook `useXxx` / 변수·함수 camelCase / 상수 UPPER_SNAKE_CASE / 타입 PascalCase.

## SSE / 실시간 (해당 시)
- 스트림 구독은 hook으로 캡슐화(`useSse` 등), 언마운트 시 정리(cleanup) 필수. 재연결·백프레셔 표시 분리.

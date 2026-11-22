import { describe, expect, it } from "vitest";
import { candidateQuery, extractPlaceCandidates, mergeCandidates, parseModelNames } from "./textPlaces";

describe("글에서 가게 후보 뽑기", () => {
  it("📍 이름 + 다음 줄 주소", () => {
    const text = `을지로 노포 국밥 다녀왔어요 🍲
국물이 진하고 고기가 많아요

📍을지로 영남순대국
📍서울 중구 다산로42길 19
⏰ 11:00 - 21:00

#을지로맛집 #국밥 #먹스타그램`;
    expect(extractPlaceCandidates(text)).toEqual([{ name: "을지로 영남순대국", address: "서울 중구 다산로42길 19" }]);
  });

  it("상호 · 주소 라벨", () => {
    const text = "상호: 오얏키친\n주소: 서울 마포구 성미산로 123\n메뉴: 규동";
    expect(extractPlaceCandidates(text)).toEqual([{ name: "오얏키친", address: "서울 마포구 성미산로 123" }]);
  });

  it("한 줄에 이름 | 주소", () => {
    expect(extractPlaceCandidates("📌 1.5닭갈비 본점 | 강원 춘천시 후석로 413")).toEqual([{ name: "1.5닭갈비 본점", address: "강원 춘천시 후석로 413" }]);
  });

  it("[가게] 여러 곳", () => {
    const text = "[물고기초밥]\n좋았던 곳\n[스프카레 츠바메]\n또 갈 곳";
    expect(extractPlaceCandidates(text).map((c) => c.name)).toEqual(["물고기초밥", "스프카레 츠바메"]);
  });

  it("표시가 없으면 해시태그 — 일반 태그 · 동네는 뺀다", () => {
    expect(extractPlaceCandidates("오늘 점심 #성수맛집 #성수동 #카페투어 #어니언 #내돈내산").map((c) => c.name)).toEqual(["어니언"]);
  });

  it("아무것도 없으면 빈 목록", () => {
    expect(extractPlaceCandidates("오늘 날씨 좋다")).toEqual([]);
  });

  it("검색어에 시 · 구를 붙임", () => {
    expect(candidateQuery({ name: "영남순대국", address: "서울 중구 다산로42길 19" })).toBe("서울 중구 영남순대국");
    expect(candidateQuery({ name: "어니언", address: null })).toBe("어니언");
  });
});

describe("글에서 가게 후보 뽑기 — 실제 글 형식", () => {
  it("메뉴 · 가격 · 광고 표시는 후보가 아님", () => {
    const text = "[내돈내산]\n[메뉴]\n🍴 삼겹살 18,000\n🍽️ 추천메뉴: 짚불구이\n<광고>\n📍 짚불구이집 망원점";
    expect(extractPlaceCandidates(text).map((c) => c.name)).toEqual(["짚불구이집 망원점"]);
  });

  it("번호 · 체크 목록과 괄호 지역", () => {
    const list = extractPlaceCandidates("1. 어니언 성수\n2) 대림창고\n✔️ 영남순대국 (을지로)");
    expect(list.map((c) => c.name)).toEqual(["어니언 성수", "대림창고", "영남순대국"]);
    expect(candidateQuery(list[2])).toBe("을지로 영남순대국");
  });

  it("주소 변형 — 층 · 호 · 번길 · 시 · 도 없는 주소, 이름보다 먼저 온 주소", () => {
    expect(extractPlaceCandidates("📍 한남동 카페\n서울 용산구 대사관로5길 12 1층 102호 (한남동)")[0].address).toBe("서울 용산구 대사관로5길 12");
    expect(extractPlaceCandidates("상호: 판교 국밥\n주소: 경기 성남시 분당구 판교역로 146번길 20")[0].address).toBe("경기 성남시 분당구 판교역로 146번길 20");
    expect(extractPlaceCandidates("중구 다산로 149\n📍 동대문 닭한마리")[0]).toEqual({ name: "동대문 닭한마리", address: "중구 다산로 149" });
  });

  it("긴 주소 라벨은 잘라서", () => {
    const [c] = extractPlaceCandidates(`상호: 한옥국수집\n주소: ${"가".repeat(200)}`);
    expect(c.address!.length).toBeLessThanOrEqual(80);
  });

  it("해시태그는 일반 · 동네 · 영문 태그 빼고 3개까지", () => {
    expect(extractPlaceCandidates("#용산 #우대갈비 #jmt #먹스타 #맛집탐방 #서울고기집 #몽탄 #삼각지역").map((c) => c.name)).toEqual(["우대갈비", "몽탄"]);
  });

  it("위치 안내 문구는 검색어 지역으로 쓰지 않음", () => {
    const [c] = extractPlaceCandidates("상호: 몽탄\n위치: 삼각지역 8번 출구");
    expect(candidateQuery(c)).toBe("몽탄");
  });
});

describe("목록 줄 · 영상 설명", () => {
  it("번호 줄 뒤 설명은 뗀다", () => {
    const text = "성수 하루 코스\n1. 어니언 성수 - 빵 맛집\n2. 대림창고 - 분위기 최고";
    expect(extractPlaceCandidates(text).map((c) => c.name)).toEqual(["어니언 성수", "대림창고"]);
  });

  it("대시 목록 · 콜론 설명", () => {
    const text = "안국 카페 투어\n- 카페 레이어드 안국점: 스콘 필수\n- 런던베이글뮤지엄: 오픈런 추천";
    expect(extractPlaceCandidates(text).map((c) => c.name)).toEqual(["카페 레이어드 안국점", "런던베이글뮤지엄"]);
  });

  it("영상 시간표 줄 · 괄호 지역", () => {
    const text = "오늘 다녀온 곳\n00:42 진미평양냉면 (학동)\n05:10 필동면옥 (충무로)";
    expect(extractPlaceCandidates(text)).toEqual([
      { name: "진미평양냉면", address: null, area: "학동" },
      { name: "필동면옥", address: null, area: "충무로" },
    ]);
  });

  it("줄 중간 📌", () => {
    expect(extractPlaceCandidates("춘천 오면 무조건 📌 1.5닭갈비 본점 | 강원 춘천시 후석로 413")).toEqual([
      { name: "1.5닭갈비 본점", address: "강원 춘천시 후석로 413" },
    ]);
  });

  it("대시 줄이라도 영업 · 가격 줄은 아니다", () => {
    expect(extractPlaceCandidates("- 영업시간 11:00 - 21:00\n- 주차 가능")).toEqual([]);
  });
});

describe("기기 안 모델 답 합치기", () => {
  it("코드 블록 · 앞뒤 말이 붙은 답", () => {
    expect(parseModelNames('네\n```json\n{"places":[{"name":"몽탄"},{"name":"몽탄"},{"name":"우래옥"}]}\n```')).toEqual(["몽탄", "우래옥"]);
  });

  it("깨진 답은 빈 목록", () => {
    expect(parseModelNames("모르겠어요")).toEqual([]);
    expect(parseModelNames('{"places":"몽탄"}')).toEqual([]);
  });

  it("동네 이름만 있는 답은 뺀다", () => {
    expect(mergeCandidates([], ["을밀대", "염리동", "합정역"]).map((c) => c.name)).toEqual(["을밀대"]);
  });

  it("규칙 후보와 같은 가게는 주소가 있는 쪽을 남기고 새 이름만 붙인다", () => {
    const rule = [{ name: "을지로 영남순대국", address: "서울 중구 다산로42길 19" }];
    expect(mergeCandidates(rule, ["영남순대국", "필동면옥 (충무로)"])).toEqual([
      { name: "을지로 영남순대국", address: "서울 중구 다산로42길 19" },
      { name: "필동면옥", address: null, area: "충무로" },
    ]);
  });
});

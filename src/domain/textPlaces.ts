// 인스타그램 · 블로그 · 유튜브 설명 글에서 가게 후보 뽑기 — 브라우저에서 돌고, 서버에는 뽑은 이름 · 주소만 보낸다
// 맛집 글에 흔한 모양: '📍가게이름', '상호: …', '주소: …', '[가게이름]', '1. 가게', '✔️ 가게 (지역)', 주소 줄, 해시태그

// area: '영남순대국 (을지로)'처럼 이름 옆 괄호의 지역 — 주소가 없을 때 검색어에 쓴다
export type PlaceCandidate = { name: string; address: string | null; area?: string | null };

const MAX = 8;
const NAME_MAX = 30;
const ADDR_MAX = 80;
const TAG_MAX = 3;
// 장소 표시 이모지 — 음식 · 식기 이모지(🍴 🍽 🥢)는 메뉴 · 가격 줄에 흔해 쓰지 않는다
const MARKER = /^[\s•\-*·>]*(?:📍|📌|🏠|🏪|🗺️?)\s*/u;
// 번호 · 체크 · 대시 목록 줄, 영상 설명의 시간표('00:42 가게')
const LISTED = /^\s*(?:\d{1,2}(?:\.\s|\)\s*)|\d{1,2}:\d{2}(?::\d{2})?\s+|[-–•]\s+|[①-⑳]|✔️?|✅|☑️?|▶️?|►|■|□|◾️?)\s*/u;
// 목록 줄 뒤 설명 — '어니언 성수 - 빵 맛집' · '카페 레이어드 안국점: 스콘 필수'
const TRAILING_NOTE = /\s+[-–—]\s+.*$|\s*[:：]\s+.*$/;
// 줄 중간 위치 표시 — '춘천 오면 무조건 📌 1.5닭갈비 본점'
const MID_MARKER = /📍|📌/u;
const NAME_LABEL = /^(?:상호명?|가게명?|가게 이름|식당|매장|업체명?|장소|place|name)\s*[:：\-]\s*/i;
const ADDR_LABEL = /^(?:주소|위치|address|addr)\s*[:：\-]\s*/i;
const BRACKET = /^[[『「<〈【](.{2,30}?)[\]』」>〉】]/;
const SIDO = "서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주";
// 도로명: (시 · 도) 시 · 군 · 구 … 로 · 길 번호 ('다산로42길 19', '판교역로 146번길 20' 포함)
const ROAD = new RegExp(`(?:(?:${SIDO})[가-힣]*\\s+)?(?:[가-힣]+(?:시|군|구)\\s+){1,2}[가-힣0-9]+(?:로|길)(?:\\s*\\d+\\s*번?길)?\\s*\\d+(?:-\\d+)?`);
// 지번: (시 · 도) 구 … 동 번지
const LOT = new RegExp(`(?:(?:${SIDO})[가-힣]*\\s+)?[가-힣]+(?:시|군|구)\\s+[가-힣0-9]+(?:동|읍|면|리)\\s*\\d+(?:-\\d+)?`);
// 이름이 아닌 줄 — 메뉴 · 영업 · 가격 · 시간 · 광고 표시 등
const NOT_NAME = /(메뉴|영업|주차|가격|전화|광고|협찬|내돈내산|예약|휴무|라스트\s?오더|웨이팅|후기|리뷰|가는\s?길|tip|팁|위치|주소|오시는|안내|공지|이벤트|할인|쿠폰)/i;
const PRICE_OR_TIME = /(\d{1,3}(,\d{3})+\s*원?|\d+\s*원|\d{1,2}:\d{2}|₩)/;
// 가게 이름이 아닌 흔한 해시태그 — 포함만 해도 뺀다
const GENERIC_TAG = /(맛집|스타그램|먹스타|그램|추천|투어|탐방|데이트|먹방|일상|존맛|jmt|맛있|여행|핫플|데일리|daily|food|yummy|좋아요|팔로우|선팔|맞팔|광고|협찬|내돈내산|고기집|술집|카페$)/i;
const ONLY_REGION = /^(서울|부산|대구|인천|광주|대전|울산|세종|제주|용산|강남|홍대|성수|을지로|종로|여의도|이태원|합정|망원|연남|[가-힣]{1,4}(동|구|역|시))$/;

function clean(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findAddress(s: string): string | null {
  const m = s.match(ROAD) ?? s.match(LOT);
  return m ? clean(m[0]).slice(0, ADDR_MAX) : null;
}

function okName(n: string): boolean {
  return n.length >= 2 && n.length <= NAME_MAX && !NOT_NAME.test(n) && !PRICE_OR_TIME.test(n) && !/^[\d\s.,-]+$/.test(n);
}

// '을지로 ○○집 | 서울 중구 …' · '영남순대국 (을지로)' — 이름 · 주소 · 괄호 지역을 나눈다
function parseNameLine(line: string): PlaceCandidate | null {
  const address = findAddress(line);
  let rest = address ? line.replace(address, " ") : line;
  rest = rest.split(/\s*[|/]\s*|\s{2,}/).find((p) => p.trim().length >= 2) ?? "";
  const paren = rest.match(/\(([^)]{1,12})\)\s*$/);
  const name = clean(rest.replace(/\([^)]*\)\s*$/, ""));
  if (!okName(name)) return address ? { name: "", address } : null;
  return paren ? { name, address, area: clean(paren[1]) } : { name, address };
}

export function extractPlaceCandidates(text: string): PlaceCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: PlaceCandidate[] = [];
  // 이름보다 먼저 나온 주소는 다음 후보에 붙인다
  let pendingAddress: string | null = null;
  const push = (c: PlaceCandidate | null) => {
    if (!c) return;
    if (!c.name) {
      if (!c.address) return;
      const last = out[out.length - 1];
      if (last && !last.address) last.address = c.address;
      else pendingAddress = c.address;
      return;
    }
    if (out.some((o) => o.name === c.name)) return;
    out.push({ ...c, address: c.address ?? pendingAddress });
    pendingAddress = null;
  };

  for (const whole of lines) {
    const at = whole.search(MID_MARKER);
    const raw = at > 0 ? whole.slice(at) : whole;
    const marked = MARKER.test(raw);
    const listed = !marked && LISTED.test(raw);
    const body = clean(marked ? raw.replace(MARKER, "") : listed ? raw.replace(LISTED, "") : raw);
    if (!body) continue;
    if (ADDR_LABEL.test(body)) {
      const rest = body.replace(ADDR_LABEL, "");
      push({ name: "", address: findAddress(rest) ?? (clean(rest).slice(0, ADDR_MAX) || null) });
      continue;
    }
    if (NAME_LABEL.test(body)) {
      push(parseNameLine(body.replace(NAME_LABEL, "")));
      continue;
    }
    const bracket = body.match(BRACKET);
    if (bracket) {
      const name = clean(bracket[1]);
      // '[서울 합정 맛집]' 같은 블로그 머리말은 가게가 아니다
      if (okName(name) && !GENERIC_TAG.test(name)) push({ name, address: findAddress(body) });
      continue;
    }
    if (marked || listed) {
      push(parseNameLine(findAddress(body) ? body : body.replace(TRAILING_NOTE, "")));
      continue;
    }
    // 주소만 있는 줄 (건물 · 층 · 호 · 괄호 동네가 붙어도)
    const addr = findAddress(body);
    if (addr) {
      const rest = body.replace(addr, "").replace(/\([^)]*\)|\d+\s*층|\d+\s*호|[가-힣]*빌딩|[가-힣]*타워/g, "").trim();
      if (rest.length < 6) push({ name: "", address: addr });
    }
  }

  // 표시가 하나도 없으면 해시태그에서 (일반 태그 · 동네 · 영문 소문자 태그는 뺀다)
  if (out.length === 0) {
    let n = 0;
    for (const m of text.matchAll(/#([^\s#]{2,30})/g)) {
      const tag = m[1].replace(/_/g, " ");
      if (GENERIC_TAG.test(tag) || ONLY_REGION.test(tag) || /^[a-z0-9 ]+$/.test(tag)) continue;
      push({ name: tag, address: null });
      if (++n >= TAG_MAX) break;
    }
  }
  return out.filter((c) => c.name.length >= 2).slice(0, MAX);
}

// 카카오 검색어 — 주소의 시 · 구(주소 모양일 때만) 또는 괄호 지역을 붙여 엉뚱한 지점이 덜 나오게
export function candidateQuery(c: PlaceCandidate): string {
  const addr = c.address ? findAddress(c.address) : null;
  const region = addr ? addr.split(/\s+/).slice(0, 2).join(" ") : (c.area ?? "");
  return region ? `${region} ${c.name}` : c.name;
}

// 기기 안 모델의 답 — {"places":[{"name":"…"}]} (코드 블록 · 앞뒤 말이 붙어도) → 가게 이름들
export function parseModelNames(raw: string): string[] {
  const json = raw.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  let places: unknown;
  try {
    places = (JSON.parse(json) as { places?: unknown }).places;
  } catch {
    return [];
  }
  if (!Array.isArray(places)) return [];
  const names = places
    .map((p) => clean(typeof p === "string" ? p : typeof p?.name === "string" ? p.name : ""))
    .filter(okName);
  return [...new Set(names)].slice(0, MAX);
}

const compact = (s: string) => s.replace(/\s+/g, "").toLowerCase();

// 규칙 후보에 모델이 더 찾은 이름을 붙인다 — 같은 가게(한쪽이 다른 쪽을 포함)는 주소가 있는 규칙 후보를 남긴다
export function mergeCandidates(rule: PlaceCandidate[], modelNames: string[]): PlaceCandidate[] {
  const out = [...rule];
  for (const n of modelNames) {
    const c = parseNameLine(n);
    if (!c?.name) continue;
    const k = compact(c.name);
    if (out.some((o) => compact(o.name).includes(k) || k.includes(compact(o.name)))) continue;
    out.push(c);
  }
  return out.slice(0, MAX);
}

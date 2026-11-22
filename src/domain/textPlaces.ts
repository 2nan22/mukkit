// 인스타그램 · 블로그 · 유튜브 설명 글에서 가게 후보 뽑기 — 브라우저에서 돌고, 서버에는 뽑은 이름만 보낸다
// 맛집 글에 흔한 모양: '📍가게이름', '상호: …', '주소: …', '[가게이름]', 주소 줄, 해시태그

export type PlaceCandidate = { name: string; address: string | null };

const MAX = 8;
const NAME_MAX = 30;
// 줄 앞 표시 — 이모지 · 기호
const MARKER = /^[\s•\-*·>]*(?:📍|📌|🏠|🍴|🍽️?|🥢|📮|🗺️?|🏪)\s*/u;
const NAME_LABEL = /^(?:상호명?|가게명?|가게 이름|식당|매장|업체명?|장소|place|name)\s*[:：\-]\s*/i;
const ADDR_LABEL = /^(?:주소|위치|address|addr)\s*[:：\-]\s*/i;
const BRACKET = /^[[『「<〈【](.{2,30}?)[\]』」>〉】]/;
// 시 · 도로 시작하고 구 · 군 · 시 · 로 · 길 다음에 번지
// '다산로42길 19' 처럼 로 · 길 뒤에 붙은 번호 길까지
const ADDRESS = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣]*\s+[가-힣0-9\s]{1,40}?(로|길|동|읍|면)(\d+(번?길))?\s*\d+(-\d+)?/;
// 가게 이름이 아닌 흔한 해시태그 꼬리 · 통째
const GENERIC_TAG = /(맛집|스타그램|그램|추천|투어|데이트|먹방|일상|존맛|맛있|여행|핫플|카페투어|술집추천|데일리|daily|food|foodie|instafood|yummy|럽|좋아요|팔로우|선팔|맞팔|광고|협찬|내돈내산)$/i;
const ONLY_REGION = /^(서울|부산|대구|인천|광주|대전|울산|세종|제주|[가-힣]{1,4}(동|구|역|시))$/;

function clean(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// '을지로 ○○집 | 서울 중구 …' 처럼 한 줄에 이름 · 주소가 함께면 나눈다
function splitNameAddress(line: string): PlaceCandidate | null {
  const parts = line.split(/\s*[|/·,]\s*|\s{2,}/).filter(Boolean);
  const addr = line.match(ADDRESS)?.[0] ?? null;
  const name = parts.find((p) => !ADDRESS.test(p) && p.length >= 2) ?? "";
  const n = clean(name).slice(0, NAME_MAX);
  if (n.length < 2 && !addr) return null;
  return { name: n, address: addr ? clean(addr) : null };
}

export function extractPlaceCandidates(text: string): PlaceCandidate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: PlaceCandidate[] = [];
  const push = (c: PlaceCandidate | null) => {
    if (!c) return;
    // 이름이 비어 있고 주소만 있으면 바로 앞 후보의 주소로
    if (!c.name && c.address) {
      const last = out[out.length - 1];
      if (last && !last.address) last.address = c.address;
      return;
    }
    if (out.some((o) => o.name === c.name)) return;
    out.push(c);
  };

  for (const raw of lines) {
    const line = raw.replace(MARKER, (m) => (m.trim() ? "\u0000" : ""));
    const marked = line.startsWith("\u0000");
    const body = clean(line.replace("\u0000", ""));
    if (!body) continue;
    if (ADDR_LABEL.test(body)) {
      const addr = clean(body.replace(ADDR_LABEL, ""));
      push({ name: "", address: addr || null });
      continue;
    }
    if (NAME_LABEL.test(body)) {
      push(splitNameAddress(body.replace(NAME_LABEL, "")));
      continue;
    }
    const bracket = body.match(BRACKET);
    if (bracket) {
      push({ name: clean(bracket[1]).slice(0, NAME_MAX), address: body.match(ADDRESS)?.[0] ?? null });
      continue;
    }
    if (marked) {
      // 📍 뒤가 주소면 앞 후보의 주소, 아니면 이름(+같은 줄 주소)
      if (ADDRESS.test(body) && splitNameAddress(body)?.name === "") push({ name: "", address: body.match(ADDRESS)![0] });
      else push(splitNameAddress(body));
      continue;
    }
    // 주소만 있는 줄 — 앞 후보에 붙인다
    const addr = body.match(ADDRESS)?.[0];
    if (addr && body.replace(addr, "").trim().length < 4) push({ name: "", address: addr });
  }

  // 표시가 하나도 없으면 해시태그에서 (일반 태그 · 동네 이름은 뺀다)
  if (out.length === 0) {
    for (const m of text.matchAll(/#([^\s#]{2,30})/g)) {
      const tag = m[1].replace(/[_]/g, " ");
      if (GENERIC_TAG.test(tag) || ONLY_REGION.test(tag)) continue;
      push({ name: tag, address: null });
    }
  }
  return out.filter((c) => c.name.length >= 2).slice(0, MAX);
}

// 카카오 검색어 — 이름에 주소의 시 · 구를 붙여 엉뚱한 지점이 덜 나오게
export function candidateQuery(c: PlaceCandidate): string {
  const region = c.address?.split(/\s+/).slice(0, 2).join(" ") ?? "";
  return region ? `${region} ${c.name}` : c.name;
}

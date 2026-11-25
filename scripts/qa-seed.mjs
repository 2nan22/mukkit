// 로컬 QA 시험 데이터 — 가짜 계정 5명 · 가짜 가게 약 1150곳. 로컬 Supabase 에서만 돈다
// 쓰는 법: SUPABASE_URL=… SUPABASE_SECRET_KEY=… SUPABASE_PUBLISHABLE_KEY=… node scripts/qa-seed.mjs <쿠키 저장 폴더>
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const URL_ = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;
const OUT = process.argv[2];
if (!URL_ || !SECRET || !PUBLISHABLE || !OUT) throw new Error("SUPABASE_URL · SUPABASE_SECRET_KEY · SUPABASE_PUBLISHABLE_KEY · 저장 폴더 필요");
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_)) throw new Error("로컬 Supabase 에서만 실행한다");

const db = createClient(URL_, SECRET, { auth: { persistSession: false } });
const TERMS_VERSION = "2026-11-25-memo";
const ACCOUNTS = {
  a: { email: "qa-a@example.test", nickname: "큐에이많이", bio: "성수 · 을지로 위주로 다녀요", onboarded: true },
  b: { email: "qa-b@example.test", nickname: null, onboarded: false },
  c: { email: "qa-c@example.test", nickname: "큐에이친구", bio: "국물 좋아해요", onboarded: true },
  d: { email: "qa-d@example.test", nickname: "큐에이빈손", onboarded: true },
  e: { email: "qa-e@example.test", nickname: "큐에이차단", onboarded: true },
};

// 가짜 가게 이름 — 업종 낱말을 넣어 세부 업종 그림이 정해지게
const KINDS = [
  ["korean", "음식점 > 한식 > 국밥", ["돼지국밥", "순댓국", "설렁탕"]],
  ["korean", "음식점 > 한식 > 국수", ["칼국수", "콩국수"]],
  ["korean", "음식점 > 한식 > 육류,고기", ["삼겹살", "숯불갈비", "한우"]],
  ["korean", "음식점 > 한식 > 찌개,전골", ["김치찌개", "부대찌개"]],
  ["korean", "음식점 > 한식 > 해물,생선", ["횟집", "해물탕"]],
  ["korean", "음식점 > 한식 > 백반", ["백반", "한정식"]],
  ["japanese", "음식점 > 일식 > 라멘", ["라멘", "돈코츠라멘"]],
  ["japanese", "음식점 > 일식 > 돈까스", ["돈까스", "카츠"]],
  ["japanese", "음식점 > 일식 > 초밥", ["스시", "초밥"]],
  ["chinese", "음식점 > 중식 > 중국요리", ["반점", "짬뽕"]],
  ["chinese", "음식점 > 중식 > 양꼬치", ["양꼬치"]],
  ["western", "음식점 > 양식 > 이탈리안", ["파스타", "트라토리아"]],
  ["western", "음식점 > 양식 > 피자", ["피자"]],
  ["western", "음식점 > 양식 > 햄버거", ["버거"]],
  ["asian", "음식점 > 아시아음식 > 베트남음식", ["쌀국수"]],
  ["snack", "음식점 > 분식", ["떡볶이", "김밥"]],
  ["chicken", "음식점 > 치킨", ["치킨"]],
  ["bar", "음식점 > 술집 > 호프", ["호프", "맥주"]],
  ["bar", "음식점 > 술집 > 와인바", ["와인바"]],
  ["cafe", "음식점 > 카페 > 커피전문점", ["커피", "로스터스"]],
  ["cafe", "음식점 > 카페 > 베이커리", ["베이커리", "빵집"]],
];
const AREAS = [
  ["성수", 37.5446, 127.0557], ["을지로", 37.5662, 126.9910], ["망원", 37.5560, 126.9019],
  ["여의도", 37.5219, 126.9245], ["강남", 37.4979, 127.0276], ["연남", 37.5627, 126.9255],
  ["종로", 37.5704, 126.9922], ["잠실", 37.5133, 127.1001], ["부산 서면", 35.1578, 129.0600],
];
const PREFIX = ["가람", "나루", "다온", "마루", "바다", "새벽", "소담", "온기", "하늘", "한결", "푸른", "들꽃"];

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

function fakePlaces(n) {
  return Array.from({ length: n }, (_, i) => {
    const [cuisine, path, words] = KINDS[i % KINDS.length];
    const [area, lat, lng] = AREAS[i % AREAS.length];
    const parts = path.split(" > ");
    return {
      source: "kakao",
      source_place_id: `qa-${String(i).padStart(5, "0")}`,
      name: `${pick(PREFIX)} ${pick(words)} ${area}${i % 7 === 0 ? " 본점" : ""}`,
      lat: lat + (rand() - 0.5) * 0.03,
      lng: lng + (rand() - 0.5) * 0.03,
      address: `${area} 가짜로 ${i + 1}`,
      category_path: parts,
      category_name: parts.at(-1),
      cuisine,
      available: i % 97 !== 5,
    };
  });
}

// 단색 PNG — 평가 사진 자리 채우기용
function solidPng(w, h, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function insertChunks(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) await must(db.from(table).insert(rows.slice(i, i + size)), table);
}

async function resetQa() {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((x) => x.email?.endsWith("@example.test") && x.email.startsWith("qa-"))) {
    const { data: files } = await db.storage.from("rating-media").list(u.id, { limit: 1000 });
    for (const dir of files ?? []) {
      const { data: inner } = await db.storage.from("rating-media").list(`${u.id}/${dir.name}`);
      if (inner?.length) await db.storage.from("rating-media").remove(inner.map((f) => `${u.id}/${dir.name}/${f.name}`));
    }
    await must(db.auth.admin.deleteUser(u.id), "deleteUser");
  }
  await must(db.from("places").delete().like("source_place_id", "qa-%"), "places reset");
}

async function createAccounts() {
  const ids = {};
  for (const [key, acc] of Object.entries(ACCOUNTS)) {
    const user = await must(db.auth.admin.createUser({ email: acc.email, email_confirm: true }), "createUser");
    ids[key] = user.user.id;
    const now = new Date().toISOString();
    const patch = acc.onboarded
      ? { nickname: acc.nickname, bio: acc.bio ?? null, nickname_set_at: now, terms_agreed_at: now, terms_version: TERMS_VERSION }
      : {};
    if (acc.onboarded) await must(db.from("profiles").update(patch).eq("id", ids[key]), "profile");
  }
  return ids;
}

const TIER_PLAN = [["three", 12], ["two", 80], ["one", 120], ["not_recommended", 25], ["want_to_go", 300]];
const REVIEWS = ["국물이 진하고 깔끔해요", "웨이팅이 길지만 갈 만해요", "혼밥하기 편해요", "면이 쫄깃해요", "사장님이 친절해요", ""];

function userPlacesFor(userId, placeIds, plan, { offsetDays = 0 } = {}) {
  let i = 0;
  const rows = [];
  for (const [tier, count] of plan) {
    for (let k = 0; k < count && i < placeIds.length; k++, i++) rows.push(row(placeIds[i], tier, k));
  }
  for (; i < placeIds.length; i++) rows.push(row(placeIds[i], "unrated", i));
  return rows;

  function row(placeId, tier, k) {
    const rated = !["unrated", "want_to_go"].includes(tier);
    const at = new Date(Date.now() - (i + offsetDays) * 3600_000 * 5).toISOString();
    return {
      user_id: userId,
      place_id: placeId,
      tier,
      visibility: rated ? (k % 5 === 4 ? "followers" : k % 7 === 6 ? "private" : "public") : "private",
      review: rated ? REVIEWS[k % REVIEWS.length] : "",
      note: k % 9 === 0 ? "다음엔 저녁에" : "",
      menus: rated && k % 3 === 0 ? ["대표 메뉴", "곁들임"] : [],
      sponsored: tier === "two" && k === 3,
      visited_on: rated ? at.slice(0, 10) : null,
      tier_rank: tier === "three" ? k : null,
      saved_at: at,
      updated_at: at,
    };
  }
}

async function seedA(ids, places) {
  const a = ids.a;
  const mine = places.slice(0, 1120).map((p) => p.id);
  await insertChunks("user_places", userPlacesFor(a, mine, TIER_PLAN));

  const sources = [
    { source: "naver", source_list_id: "qa-naver-1", mode: "plain", tier: null, list_name: "성수 맛집 모음", range: [300, 520] },
    { source: "naver", source_list_id: "qa-naver-2", mode: "tier", tier: "two", list_name: "또 갈 곳", range: [12, 92] },
    { source: "kakao", source_list_id: "qa-kakao-1", mode: "plain", tier: null, list_name: "회사 근처", range: [520, 640] },
  ];
  for (const s of sources) {
    const { range, ...src } = s;
    await must(db.from("import_sources").insert({ ...src, user_id: a, last_synced_at: new Date().toISOString(), last_hash: "qa" }), "import_sources");
    await insertChunks("imported_items", mine.slice(...range).map((placeId, k) => ({
      user_id: a, source: s.source, source_list_id: s.source_list_id, source_place_id: `qa-src-${s.source_list_id}-${k}`,
      place_id: placeId, list_name: s.list_name, memo: k % 10 === 0 ? "주차 가능" : "", category_name: "음식점",
    })));
    if (s.mode === "plain") {
      const list = await must(db.from("lists").insert({ owner_id: a, name: s.list_name, source: s.source, source_list_id: s.source_list_id, visibility: "link" }).select("id").single(), "lists");
      await insertChunks("list_items", mine.slice(...range).map((place_id) => ({ list_id: list.id, place_id })));
    }
  }

  const own = [
    { name: "주말 데이트", description: "분위기 좋은 곳", visibility: "public", range: [0, 15] },
    { name: "비 오는 날 국물", description: "", visibility: "public", range: [92, 117] },
    { name: "아직 빈 리스트", description: "", visibility: "private", range: [0, 0] },
  ];
  const listIds = [];
  for (const l of own) {
    const list = await must(db.from("lists").insert({ owner_id: a, name: l.name, description: l.description, visibility: l.visibility }).select("id").single(), "lists");
    listIds.push(list.id);
    if (l.range[1] > l.range[0]) await insertChunks("list_items", mine.slice(...l.range).map((place_id) => ({ list_id: list.id, place_id })));
  }

  const colors = [[200, 65, 11], [42, 120, 90], [60, 90, 160], [150, 110, 60]];
  for (let k = 0; k < 10; k++) {
    const placeId = mine[k];
    const path = `${a}/${placeId}/${randomUUID()}.png`;
    await must(db.storage.from("rating-media").upload(path, solidPng(64, 64, colors[k % colors.length]), { contentType: "image/png" }), "upload");
    await must(db.from("rating_media").insert({ user_id: a, place_id: placeId, path, kind: "image" }), "rating_media");
  }
  return { mine, publicListId: listIds[0], soupListId: listIds[1] };
}

async function seedC(ids, places, aSeed) {
  const c = ids.c;
  const shared = aSeed.mine.slice(0, 20);
  const extra = places.slice(1120, 1140).map((p) => p.id);
  await insertChunks("user_places", userPlacesFor(c, [...shared, ...extra], [["three", 4], ["two", 10], ["one", 8], ["not_recommended", 2], ["want_to_go", 8]], { offsetDays: 2 }));
  await insertChunks("follows", [{ follower_id: c, followee_id: ids.a }, { follower_id: ids.a, followee_id: c }, { follower_id: ids.d, followee_id: ids.a }]);

  const { data: aPublic } = await db.from("user_places").select("place_id").eq("user_id", ids.a).eq("visibility", "public").in("tier", ["three", "two", "one"]).order("saved_at", { ascending: false }).limit(6);
  await insertChunks("rating_likes", aPublic.map((r) => ({ user_id: c, owner_id: ids.a, place_id: r.place_id })));
  const target = aPublic[0].place_id;
  await insertChunks("rating_comments", [
    { owner_id: ids.a, place_id: target, author_id: c, body: "여기 저도 가 봤는데 국물이 정말 좋더라고요" },
    { owner_id: ids.a, place_id: target, author_id: ids.a, body: "맞아요 다음에 같이 가요" },
    { owner_id: ids.a, place_id: target, author_id: c, body: "주말 점심 어때요?" },
  ]);
  await insertChunks("saved_lists", [{ user_id: c, list_id: aSeed.publicListId }, { user_id: ids.d, list_id: aSeed.publicListId }, { user_id: c, list_id: aSeed.soupListId }]);

  const open = await must(db.from("meetups").insert({ host_id: c, purpose: "meal", starts_at: new Date(Date.now() + 3 * 86400_000).toISOString() }).select("id").single(), "meetups");
  await must(db.from("meetup_members").insert({ meetup_id: open.id, user_id: ids.a }), "meetup_members");
  await must(db.from("meetup_invites").insert({ meetup_id: open.id, user_id: ids.d }), "meetup_invites");
  await insertChunks("meetup_points", [
    { meetup_id: open.id, user_id: c, kind: "origin", label: "회사", lat: 37.5446, lng: 127.0557 },
    { meetup_id: open.id, user_id: ids.a, kind: "origin", label: "집", lat: 37.5560, lng: 126.9019 },
  ]);
  const done = await must(db.from("meetups").insert({ host_id: c, purpose: "drinks", status: "done", starts_at: new Date(Date.now() - 5 * 86400_000).toISOString() }).select("id").single(), "meetups done");
  await must(db.from("meetup_members").insert({ meetup_id: done.id, user_id: ids.a }), "meetup_members done");
  const visit = await must(db.from("visits").insert({ place_id: shared[1], created_by: c, meetup_id: done.id, meetup_seq: 1, visited_on: new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10) }).select("id").single(), "visits");
  await insertChunks("visit_members", [
    { visit_id: visit.id, user_id: ids.a, status: "accepted", responded_at: new Date().toISOString() },
    { visit_id: visit.id, guest_name: "동기 민수", status: "accepted" },
  ]);
  const pending = await must(db.from("visits").insert({ place_id: shared[2], created_by: c, visited_on: new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10) }).select("id").single(), "visits pending");
  await must(db.from("visit_members").insert({ visit_id: pending.id, user_id: ids.a }), "visit_members pending");
  return { openMeetupId: open.id, doneMeetupId: done.id };
}

async function seedE(ids, places) {
  await insertChunks("user_places", userPlacesFor(ids.e, places.slice(1140, 1150).map((p) => p.id), [["two", 5], ["one", 5]]));
  await must(db.from("blocks").insert({ blocker_id: ids.a, blocked_id: ids.e }), "blocks");
}

// 매직 링크 토큰을 서버 쪽 클라이언트로 확인해 브라우저 쿠키를 그대로 얻는다
async function sessionCookies(email) {
  const link = await must(db.auth.admin.generateLink({ type: "magiclink", email }), "generateLink");
  const jar = new Map();
  const client = createServerClient(URL_, PUBLISHABLE, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)) },
  });
  await must(client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token }), "verifyOtp");
  return [...jar].map(([name, value]) => ({ name, value, domain: "localhost", path: "/" }));
}

await resetQa();
const ids = await createAccounts();
const places = await must(db.from("places").insert(fakePlaces(1150)).select("id, source_place_id").order("source_place_id"), "places");
const aSeed = await seedA(ids, places);
const cSeed = await seedC(ids, places, aSeed);
await seedE(ids, places);

mkdirSync(OUT, { recursive: true });
const cookies = {};
for (const [key, acc] of Object.entries(ACCOUNTS)) cookies[key] = await sessionCookies(acc.email);
const { data: invite } = await db.from("meetups").select("invite_token").eq("id", cSeed.openMeetupId).single();
writeFileSync(`${OUT}/qa-cookies.json`, JSON.stringify(cookies));
writeFileSync(`${OUT}/qa-ids.json`, JSON.stringify({ ids, samplePlace: aSeed.mine[0], publicListId: aSeed.publicListId, ...cSeed, inviteToken: invite.invite_token }, null, 2));
process.stdout.write(`시험 데이터 준비: 계정 ${Object.keys(ids).length} · 가게 ${places.length}\n`);

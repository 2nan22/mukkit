// 구글 테이크아웃 파일 읽기 (76) — 기기에서만. 파일 이름 · 폴더는 계정 언어마다 달라 내용으로 알아본다
// - 저장됨(Saved): 리스트마다 CSV — 머리줄 Title, Note, URL, Tags, Comment (설명이 있으면 머리줄 위에 한 줄 + 빈 줄)
// - 지도(내 장소): Saved Places.json — GeoJSON, 좌표 [경도, 위도] (모르면 0,0) · location.name · address
// 근거: developers.google.com/data-portability/schema-reference/save · local_actions

export type GoogleItem = {
  name: string;
  note: string;
  url: string;
  lat?: number;
  lng?: number;
  address?: string;
};

export type GoogleList = {
  // 같은 리스트를 다시 올려도 같은 값 — 리스트 이름 기준
  key: string;
  name: string;
  // 구글 기본 '가고 싶은 장소' — 먹킷 '가고 싶은 곳'으로
  wantToGo: boolean;
  items: GoogleItem[];
};

export type TakeoutFile = { name: string; text: string };

const MAX_ITEMS = 500;
const WANT_TO_GO = /want\s*to\s*go|가고\s*싶은/i;
const STARRED_NAME = "별표 표시한 장소";

export function readTakeoutFiles(files: TakeoutFile[]): GoogleList[] {
  const lists: GoogleList[] = [];
  for (const f of files) {
    const base = baseName(f.name);
    if (/\.csv$/i.test(f.name)) {
      const items = readSavedCsv(f.text);
      if (items) lists.push(toList(base, items));
    } else if (/\.json$/i.test(f.name) && !/review|리뷰/i.test(base)) {
      const items = readSavedPlacesJson(f.text);
      if (items) lists.push(toList(STARRED_NAME, items));
    }
  }
  // 같은 이름 리스트가 두 번 오면(파일 두 번 올림) 하나로
  const byKey = new Map<string, GoogleList>();
  for (const l of lists) {
    const prev = byKey.get(l.key);
    byKey.set(l.key, prev ? { ...prev, items: dedupe([...prev.items, ...l.items]) } : l);
  }
  return [...byKey.values()].filter((l) => l.items.length > 0);
}

// 구글 기본 리스트는 영어 계정이면 영어 이름 — 우리말로 보여 준다 (76 디자인 검토)
const DEFAULT_NAMES: [RegExp, string][] = [
  [/^want\s*to\s*go$/i, "가고 싶은 곳"],
  [/^favou?rite(s|\s*places)?$/i, "즐겨찾는 곳"],
  [/^starred\s*places$/i, STARRED_NAME],
];

function toList(name: string, items: GoogleItem[]): GoogleList {
  const raw = name.trim().slice(0, 120) || "구글 지도";
  const shown = DEFAULT_NAMES.find(([re]) => re.test(raw))?.[1] ?? raw;
  return { key: shown.toLowerCase(), name: shown, wantToGo: WANT_TO_GO.test(raw) || WANT_TO_GO.test(shown), items: dedupe(items).slice(0, MAX_ITEMS) };
}

function baseName(path: string): string {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.(csv|json)$/i, "");
}

function dedupe(items: GoogleItem[]): GoogleItem[] {
  return [...new Map(items.map((i) => [`${i.name}|${i.url}`, i])).values()];
}

// CSV — 머리줄에 Title 과 URL 이 있는 파일만 (다른 CSV 는 null)
export function readSavedCsv(text: string): GoogleItem[] | null {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const head = rows.findIndex((r) => {
    const cols = r.map((c) => c.trim().toLowerCase());
    return cols.includes("title") && cols.includes("url");
  });
  if (head < 0) return null;
  const cols = rows[head].map((c) => c.trim().toLowerCase());
  const at = (r: string[], name: string) => {
    const i = cols.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  return rows.slice(head + 1).flatMap((r) => {
    const name = at(r, "title");
    if (!name) return [];
    const url = at(r, "url");
    const note = [at(r, "note"), at(r, "comment")].filter(Boolean).join("\n");
    return [{ name: name.slice(0, 120), note: note.slice(0, 1000), url: url.slice(0, 1000), ...coordsFromUrl(url) }];
  });
}

// GeoJSON — 지금 형식(location.name)과 옛 형식(Title · Location["Business Name"]) 모두
export function readSavedPlacesJson(text: string): GoogleItem[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return null;
  }
  if (!isObject(data) || data.type !== "FeatureCollection" || !Array.isArray(data.features)) return null;
  return data.features.flatMap((f): GoogleItem[] => {
    if (!isObject(f)) return [];
    const p = isObject(f.properties) ? f.properties : {};
    const loc = isObject(p.location) ? p.location : isObject(p.Location) ? p.Location : {};
    const name = str(loc.name) || str(loc["Business Name"]) || str(p.Title);
    if (!name) return [];
    const url = str(p.google_maps_url) || str(p["Google Maps URL"]);
    const coords = isObject(f.geometry) && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : [];
    const [lng, lat] = coords.map(Number);
    const known = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
    const address = str(loc.address) || str(loc.Address);
    return [{ name: name.slice(0, 120), note: str(p.Comment).slice(0, 1000), url: url.slice(0, 1000), ...(known ? { lat, lng } : coordsFromUrl(url)), ...(address ? { address: address.slice(0, 200) } : {}) }];
  });
}

// 구글 지도 주소에 좌표가 실린 경우만 — !3d37.5!4d127.0 · /search/37.5,127.0 · @37.5,127.0
export function coordsFromUrl(url: string): { lat: number; lng: number } | Record<string, never> {
  // !3d!4d(장소 좌표)를 먼저 — @ 는 지도 화면 가운데라 장소와 다를 수 있다 (76 검토)
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? url.match(/search\/(-?\d+\.\d+),\+?\s*(-?\d+\.\d+)/) ?? url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return {};
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : {};
}

// 따옴표 안 쉼표 · 줄바꿈 · "" 를 다루는 CSV 읽기
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

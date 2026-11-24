"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { extractPlaceCandidates, mergeCandidates } from "@/domain/textPlaces";
import { findCandidatePlaces, saveFoundPlace, type CandidateResult, type FoundHit } from "./actions";
import { DeviceModelOption } from "./DeviceModelOption";
import { readPlaceNames } from "./deviceReader";
import { MetaLine } from "@/components/ui/MetaLine";

const TEXT_MAX = 5000;

// 인스타그램 · 블로그 · 유튜브 설명 글을 붙여 넣으면 가게 후보를 찾아 가고 싶은 곳으로 저장
// 글은 이 기기에서만 읽고(후보 뽑기), 서버에는 가게 이름 · 주소만 보낸다
export function TextImportFlow() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<CandidateResult[] | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  // 저장한 가게 → 먹킷 장소 (상세로 가는 링크)
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // '더 꼼꼼하게 찾기'를 받아 켜 둔 경우 — 규칙에 더해 기기 안 모델로도 읽는다
  const [useModel, setUseModel] = useState(false);
  const [reading, setReading] = useState(false);
  // 처음 한 번은 모델을 그래픽 칩에 올리느라 오래 걸린다
  const [readOnce, setReadOnce] = useState(false);
  const onModelChange = useCallback((v: boolean) => setUseModel(v), []);

  // 원문 링크 — http(s) 만, 공유 추적 꼬리(?igsh= 등)는 뗀다
  const link = (() => {
    const v = url.trim();
    if (!v) return { ok: true, value: null as string | null };
    try {
      const u = new URL(v);
      if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, value: null };
      return { ok: true, value: `${u.origin}${u.pathname}` };
    } catch {
      return { ok: false, value: null };
    }
  })();

  function find() {
    setMessage(null);
    setResults(null);
    const rule = extractPlaceCandidates(text);
    if (rule.length === 0 && !useModel) {
      setMessage({ text: "글에서 가게 이름을 찾지 못했어요. 위치 표시 뒤에 가게 이름이 적힌 줄이 있는지 확인해 주세요.", error: true });
      return;
    }
    // 전환 밖에서 바로 표시 — 처음 모델을 올리는 데 시간이 걸린다
    if (useModel) setReading(true);
    start(async () => {
      let candidates = rule;
      let fellBack = false;
      if (useModel) {
        try {
          candidates = mergeCandidates(rule, await readPlaceNames(text));
          setReadOnce(true);
        } catch {
          // 모델이 실패해도 규칙으로 찾은 것으로 계속
          fellBack = true;
        } finally {
          setReading(false);
        }
      }
      if (candidates.length === 0) {
        return setMessage({
          text: fellBack ? "이번엔 문장 속 가게를 읽지 못했어요. 잠시 뒤 다시 찾아 주세요." : "글에서 가게 이름을 찾지 못했어요. 가게 이름이 글에 적혀 있는지 확인해 주세요.",
          error: true,
        });
      }
      const res = await findCandidatePlaces(candidates);
      if (res.error) return setMessage({ text: res.error, error: true });
      setResults(res.results);
      if (fellBack) setMessage({ text: "이번엔 기본 방식으로만 찾았어요." });
    });
  }

  function save(h: FoundHit) {
    setBusy(h.kakaoId);
    setMessage(null);
    start(async () => {
      const res = await saveFoundPlace({ kakaoId: h.kakaoId, name: h.name, lat: h.lat, lng: h.lng, sourceUrl: link.value });
      setBusy(null);
      if (res.error) return setMessage({ text: res.error, error: true });
      setSaved((s) => ({ ...s, [h.kakaoId]: res.placeId! }));
      setMessage({ text: `${h.name}, 가고 싶은 곳으로 저장했어요` });
    });
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-10">
      <p className="text-body leading-relaxed text-ink-2">인스타그램, 블로그, 유튜브 설명 글을 그대로 붙여 넣어 주세요.</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-ink">글</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
          rows={7}
          placeholder={"📍을지로 영남순대국\n📍서울 중구 다산로42길 19\n#을지로맛집"}
          className="w-full resize-none rounded-[12px] bg-surface px-3.5 py-3 text-body leading-normal outline-none focus:bg-white focus:ring-1 focus:ring-ink"
        />
        <span className="text-caption text-muted">
          글은 이 기기에서만 읽고, 찾은 가게 이름과 주소만 검색에 써요.{text.length >= TEXT_MAX && ` ${TEXT_MAX}자까지만 읽어요.`}
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-ink">원문 링크 (선택)</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          placeholder="https://"
          aria-invalid={!link.ok}
          className={`h-12 rounded-[12px] bg-surface px-3.5 text-body outline-none focus:bg-white focus:ring-1 ${link.ok ? "focus:ring-ink" : "ring-1 ring-danger"}`}
        />
        <span className={`text-caption ${link.ok ? "text-muted" : "text-danger"}`}>
          {link.ok ? "넣으면 저장한 가게의 나만 보는 메모로 남아요." : "https:// 로 시작하는 링크를 넣어 주세요."}
        </span>
      </label>
      <DeviceModelOption onChange={onModelChange} busy={reading} />
      <button
        type="button"
        disabled={pending || text.trim().length < 2 || !link.ok}
        onClick={find}
        className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand disabled:bg-surface disabled:text-subtle disabled:shadow-none"
      >
        {reading ? "글 읽는 중" : pending && !busy ? "찾는 중" : "가게 찾기"}
      </button>
      <p role="status" className={reading ? "-mt-2 text-caption text-muted" : "sr-only"}>
        {reading ? (readOnce ? "글을 읽고 있어요." : "글을 읽고 있어요. 처음 한 번은 20초쯤 걸려요.") : ""}
      </p>
      <p role="alert" className={message?.error ? "text-meta text-danger" : "sr-only"}>
        {message?.error ? message.text : ""}
      </p>
      {/* 저장 알림 — 아래쪽 줄에서 눌러도 보이게 화면 아래 */}
      <p role="status" className={message && !message.error ? "fixed inset-x-0 bottom-6 z-30 mx-auto w-fit max-w-[90%] rounded-full bg-ink px-4 py-2.5 text-meta text-white shadow-float" : "sr-only"}>
        {message && !message.error ? message.text : ""}
      </p>

      {results && (
        <div className="flex flex-col gap-5 pt-2">
          {results.map(({ candidate, hits, failed }) => (
            <section key={candidate.name} aria-label={`${candidate.name} 후보`} className="flex flex-col">
              <h2 className="flex flex-col gap-0.5 text-meta text-muted">
                <span>글에서 찾은 이름</span>
                <MetaLine className="" items={[<b key="name" className="font-semibold text-ink">{candidate.name}</b>, candidate.address]} />
              </h2>
              {failed ? (
                <p className="flex min-h-12 items-center gap-2 text-meta text-muted">
                  지금 검색이 잠시 안 돼요.
                  <button type="button" onClick={find} className="h-11 font-semibold text-ink underline underline-offset-[3px]">
                    다시 찾기
                  </button>
                </p>
              ) : hits.length === 0 ? (
                <p className="flex min-h-12 items-center gap-2 text-meta text-muted">
                  카카오에서 찾지 못했어요.
                  <Link href={`/search?q=${encodeURIComponent(candidate.name)}`} className="flex h-11 items-center font-semibold text-ink underline underline-offset-[3px]">
                    직접 검색
                  </Link>
                </p>
              ) : (
                <ul className="flex flex-col">
                  {hits.map((h) => {
                    const inMine = Boolean(h.tier) || Boolean(saved[h.kakaoId]);
                    const placeId = h.placeId ?? saved[h.kakaoId] ?? null;
                    return (
                      <li key={h.kakaoId}>
                        <PlaceRow
                          name={h.name}
                          cuisine={h.cuisine}
                          meta={h.meta}
                          tier={h.tier}
                          href={placeId ? `/p/${placeId}` : `/search?q=${encodeURIComponent(h.name)}`}
                          action={
                            inMine ? (
                              <span role="img" aria-label="내 장소에 있음" className="flex size-11 shrink-0 items-center justify-center text-ink">
                                {flag(true)}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => save(h)}
                                aria-label={`${h.name} 가고 싶은 곳으로 저장`}
                                aria-busy={busy === h.kakaoId}
                                className="flex size-11 shrink-0 items-center justify-center text-muted disabled:opacity-50"
                              >
                                {flag(false)}
                              </button>
                            )
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function flag(filled: boolean) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 21V4h11l-2 4 2 4H6" />
    </svg>
  );
}

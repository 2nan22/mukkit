"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { extractPlaceCandidates } from "@/domain/textPlaces";
import { findCandidatePlaces, saveFoundPlace, type CandidateResult, type FoundHit } from "./actions";

const TEXT_MAX = 5000;

// 인스타그램 · 블로그 · 유튜브 설명 글을 붙여 넣으면 가게 후보를 찾아 가고 싶은 곳으로 저장
// 글은 이 기기에서만 읽고(후보 뽑기), 서버에는 가게 이름 · 주소만 보낸다
export function TextImportFlow() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<CandidateResult[] | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [saved, setSaved] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function find() {
    setMessage(null);
    setResults(null);
    const candidates = extractPlaceCandidates(text);
    if (candidates.length === 0) {
      setMessage({ text: "글에서 가게 이름을 찾지 못했어요. '📍가게이름'처럼 적힌 줄이 있는지 확인해 주세요.", error: true });
      return;
    }
    start(async () => {
      const res = await findCandidatePlaces(candidates);
      if (res.error) return setMessage({ text: res.error, error: true });
      setResults(res.results);
    });
  }

  function save(h: FoundHit) {
    setBusy(h.kakaoId);
    setMessage(null);
    start(async () => {
      const link = /^https?:\/\//.test(url.trim()) ? url.trim() : null;
      const res = await saveFoundPlace({ kakaoId: h.kakaoId, name: h.name, lat: h.lat, lng: h.lng, sourceUrl: link });
      setBusy(null);
      if (res.error) return setMessage({ text: res.error, error: true });
      setSaved((s) => ({ ...s, [h.kakaoId]: true }));
      setMessage({ text: `가고 싶은 곳으로 저장했어요 · ${h.name}` });
    });
  }

  return (
    <div className="flex flex-col gap-4 px-5 pb-10">
      <p className="text-body leading-relaxed text-ink-2">인스타그램 · 블로그 · 유튜브 설명 글을 그대로 붙여 넣어 주세요.</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-ink">글</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
          rows={7}
          placeholder={"📍을지로 영남순대국\n📍서울 중구 다산로42길 19\n#을지로맛집"}
          className="w-full resize-none rounded-[12px] bg-surface px-3.5 py-3 text-body leading-normal outline-none focus:bg-white focus:ring-1 focus:ring-ink"
        />
        <span className="text-caption text-muted">글은 이 기기에서만 읽고, 찾은 가게 이름만 검색에 써요.</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-ink">원문 링크 (선택)</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          placeholder="https://"
          className="h-12 rounded-[12px] bg-surface px-3.5 text-body outline-none focus:bg-white focus:ring-1 focus:ring-ink"
        />
        <span className="text-caption text-muted">넣으면 저장한 가게의 나만 보는 메모로 남아요.</span>
      </label>
      <button
        type="button"
        disabled={pending || text.trim().length < 2}
        onClick={find}
        className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand disabled:bg-surface disabled:text-subtle disabled:shadow-none"
      >
        {pending && !busy ? "찾는 중" : "가게 찾기"}
      </button>
      <p role={message?.error ? "alert" : "status"} className={message ? `text-meta ${message.error ? "text-danger" : "text-ink-2"}` : "sr-only"}>
        {message?.text ?? ""}
      </p>

      {results && (
        <div className="flex flex-col gap-5 pt-2">
          {results.map(({ candidate, hits }) => (
            <section key={candidate.name} aria-label={`${candidate.name} 후보`} className="flex flex-col">
              <h2 className="text-meta text-muted">
                글에서 찾은 이름 · <b className="font-semibold text-ink">{candidate.name}</b>
                {candidate.address && ` · ${candidate.address}`}
              </h2>
              {hits.length === 0 ? (
                <p className="flex min-h-12 items-center gap-2 text-meta text-muted">
                  카카오에서 찾지 못했어요.
                  <Link href="/search" className="font-semibold text-ink underline underline-offset-[3px]">
                    직접 검색
                  </Link>
                </p>
              ) : (
                <ul className="flex flex-col">
                  {hits.map((h) => {
                    const inMine = Boolean(h.tier) || saved[h.kakaoId];
                    return (
                      <li key={h.kakaoId}>
                        <PlaceRow
                          name={h.name}
                          cuisine={h.cuisine}
                          meta={h.meta}
                          tier={h.tier}
                          href={h.placeId ? `/p/${h.placeId}` : undefined}
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

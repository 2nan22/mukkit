"use client";

// 켜고 끄기 한 줄 — 왼쪽 이름 · 아래 보조 문구, 오른쪽 검정 스위치 (선택은 검정, 주황은 주 버튼만)
export function Switch({ label, hint, checked, onChange, name, size = "body" }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void; name?: string; size?: "body" | "meta" }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className={size === "body" ? "text-body" : "text-meta text-ink-2"}>{label}</span>
        {hint && <span className="text-caption text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

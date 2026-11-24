// 메모 한 칸 — 이름표는 위 작은 줄, 내용은 아래 (가운데 점으로 한 줄에 잇지 않는다, 68-5)
export function Memo({ label = "메모", text, tone = "surface" }: { label?: string; text: string; tone?: "surface" | "white" }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-btn-s px-3 py-2.5 ${tone === "white" ? "bg-white" : "bg-surface"}`}>
      <span className="text-caption font-semibold text-muted">{label}</span>
      <p className="text-meta leading-normal whitespace-pre-line text-ink-2">{text}</p>
    </div>
  );
}

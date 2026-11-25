import Link from "next/link";
import { MetaLine } from "@/components/ui/MetaLine";

// 필수 동의 체크 — 약관 · 처리방침을 새 창 없이 바로 열어 볼 수 있게
export function AgreeCheck() {
  return (
    <label className="flex items-start gap-2.5 rounded-[14px] bg-surface p-4">
      <input type="checkbox" name="agree" required className="mt-0.5 size-5 shrink-0 accent-brand" />
      <span className="flex flex-col gap-1">
        <span className="text-body font-semibold">[필수] 이용약관 및 개인정보 처리방침 동의</span>
        <MetaLine
          wrap
          items={[
            "만 14세 이상이에요",
            <Link key="terms" href="/terms" className="underline underline-offset-2">
              이용약관
            </Link>,
            <Link key="privacy" href="/privacy" className="underline underline-offset-2">
              개인정보 처리방침
            </Link>,
          ]}
        />
      </span>
    </label>
  );
}

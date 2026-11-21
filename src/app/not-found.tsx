import Link from "next/link";
import { StatusScreen } from "@/components/ui/StatusScreen";

export default function NotFound() {
  return (
    <StatusScreen title="페이지를 찾을 수 없어요" body="주소가 바뀌었거나 삭제된 페이지예요.">
      <Link href="/home" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
        홈으로
      </Link>
    </StatusScreen>
  );
}

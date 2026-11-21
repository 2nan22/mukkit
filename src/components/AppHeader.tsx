import type { ReactNode } from "react";
import { BackButton } from "./BackButton";

type Props = { title: ReactNode; right?: ReactNode } & (
  | { kind: "tab" }
  | { kind: "back" | "close"; fallback: string }
);

// 탭 첫 화면은 제목만 왼쪽에, 들어온 화면은 뒤로, 작업 화면은 닫기
export function AppHeader(props: Props) {
  if (props.kind === "tab") {
    return (
      <header className="flex h-14 shrink-0 items-center justify-between pr-2 pl-5">
        <h1 className="text-[20px] font-bold tracking-tight">{props.title}</h1>
        <div className="flex items-center">{props.right}</div>
      </header>
    );
  }
  if (props.kind === "close") {
    return (
      <header className="flex h-14 shrink-0 items-center justify-between pr-2 pl-5">
        <h1 className="truncate text-section font-bold">{props.title}</h1>
        <BackButton fallback={props.fallback} kind="close" />
      </header>
    );
  }
  return (
    <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
      <BackButton fallback={props.fallback} />
      <h1 className="truncate text-center text-section font-bold">{props.title}</h1>
      <div className="flex justify-end">{props.right}</div>
    </header>
  );
}

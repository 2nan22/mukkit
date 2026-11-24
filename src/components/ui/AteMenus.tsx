// 먹은 메뉴 한 줄 — 3개를 넘으면 'A, B, C 외 n개'
export function AteMenus({ menus }: { menus: string[] }) {
  if (menus.length === 0) return null;
  const shown = menus.slice(0, 3).join(", ");
  return (
    <p className="truncate text-meta text-ink-2">
      <span className="mr-1.5 text-muted">먹은 메뉴</span>
      {menus.length > 3 ? `${shown} 외 ${menus.length - 3}개` : shown}
    </p>
  );
}

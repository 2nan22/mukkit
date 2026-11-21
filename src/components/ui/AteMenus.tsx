// 먹은 메뉴 한 줄
export function AteMenus({ menus }: { menus: string[] }) {
  if (menus.length === 0) return null;
  return (
    <p className="text-meta text-ink-2">
      <span className="text-muted">먹은 메뉴</span> · {menus.join(" · ")}
    </p>
  );
}

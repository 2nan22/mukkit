// 앱 안에서 지나온 경로 — 뒤로가기가 앱 밖으로 나가지 않게 판단하는 데만 쓴다
const KEY = "nav-stack";

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function write(stack: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-50)));
  } catch {
    // 저장소를 못 쓰면 뒤로가기는 대체 경로로 간다
  }
}

export function recordPath(path: string) {
  const stack = read();
  if (stack.at(-1) === path) return;
  if (stack.at(-2) === path) stack.pop();
  else stack.push(path);
  write(stack);
}

export function canGoBack(): boolean {
  return read().length > 1;
}

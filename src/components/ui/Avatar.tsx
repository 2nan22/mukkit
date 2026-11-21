// 닉네임마다 정해진 파스텔 색 — 회색 원보다 사람을 구분하기 쉽다
const PALETTE = [
  "bg-[#ffe8d9] text-[#9a3b0b]",
  "bg-[#e3f1ff] text-[#1d4f8a]",
  "bg-[#e6f6ea] text-[#24683a]",
  "bg-[#f3e8ff] text-[#6232a0]",
  "bg-[#fff3c9] text-[#7a5800]",
  "bg-[#ffe3e8] text-[#a02a45]",
];

const SIZE = {
  24: "size-6 text-[11px]",
  40: "size-10 text-[15px]",
  56: "size-14 text-[20px]",
} as const;

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h;
}

export function Avatar({ name, size = 40 }: { name: string; size?: keyof typeof SIZE }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZE[size]} ${PALETTE[hash(name) % PALETTE.length]}`}>
      {name.slice(0, 1)}
    </span>
  );
}

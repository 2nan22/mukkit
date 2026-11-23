import { CHOPSTICKS, MARK, SPOON_HEAD, SPOON_STICK, SYMBOL_VIEWBOX, TAGLINE } from "./Wordmark";

// 처음 들어올 때 한 번 — 가운데에 수저가 놓이고, 심볼이 비켜서며 '먹킷 / MUKKIT' 이 펼쳐지고, 아래에 태그라인이 떠오른다 (약 2.7초 · 누르면 바로 넘어감)
// 보일지는 그리기 전에 아래 스크립트가 정한다: 홈 화면 앱으로 열었거나 시작 · 홈 화면으로 들어온 세션의 첫 화면만
export const SPLASH_SCRIPT = `try{var d=document.documentElement,s=sessionStorage;if(!s.getItem("mk_splash")&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&(matchMedia("(display-mode: standalone)").matches||location.pathname==="/"||location.pathname==="/home")){s.setItem("mk_splash","1");d.dataset.splash="1";addEventListener("pointerdown",function(){delete d.dataset.splash},{once:true})}}catch(e){}`;

const m = MARK.lg;
const symbolWidth = Math.round(m.h * 0.7);

export function LaunchSplash() {
  return (
    <div className="launch-splash" aria-hidden="true">
      {/* 글자 로고(Wordmark) 와 같은 비율 — 심볼 높이 56 */}
      <div className="launch-lockup" style={{ gap: m.gap }}>
        <svg className="launch-symbol" height={m.h} width={symbolWidth} viewBox={SYMBOL_VIEWBOX}>
          <g className="launch-spoon">
            <path d={SPOON_STICK} />
            <ellipse {...SPOON_HEAD} />
          </g>
          {CHOPSTICKS.map((d, i) => (
            <path key={d} d={d} className="launch-chopstick" style={{ animationDelay: `${280 + i * 140}ms` }} />
          ))}
        </svg>
        <span className="launch-word" style={{ height: m.h }}>
          <span className="launch-ko" style={{ fontSize: m.ko, marginTop: m.nudge }}>
            먹킷
          </span>
          <span className="launch-en" style={{ fontSize: m.en }}>
            MUKKIT
          </span>
        </span>
      </div>
      <span className="launch-tagline">
        <span className="launch-tagline-ko">{TAGLINE.ko}</span>
        <span className="launch-tagline-en">{TAGLINE.en}</span>
      </span>
    </div>
  );
}

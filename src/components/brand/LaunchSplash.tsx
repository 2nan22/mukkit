// 처음 들어올 때 한 번 — 숟가락이 내려앉고 젓가락이 따라 붙은 뒤 글자가 떠오르고 사라진다 (CSS 만, 0.8초)
// 보일지는 그리기 전에 아래 스크립트가 정한다: 홈 화면 앱으로 열었거나 시작 · 홈 화면으로 들어온 세션의 첫 화면만
export const SPLASH_SCRIPT = `try{var d=document.documentElement,s=sessionStorage;if(!s.getItem("mk_splash")&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&(matchMedia("(display-mode: standalone)").matches||location.pathname==="/"||location.pathname==="/home")){s.setItem("mk_splash","1");d.dataset.splash="1"}}catch(e){}`;

export function LaunchSplash() {
  return (
    <div className="launch-splash" aria-hidden="true">
      <svg className="launch-symbol" width="64" height="91" viewBox="220 120 548 780">
        <g className="launch-spoon">
          <path d="M336 470C356 496 372 522 374 554L358 850a42 42 0 0 0 84 0L426 554C428 522 444 496 464 470Z" />
          <ellipse cx="400" cy="312" rx="172" ry="184" />
        </g>
        <g className="launch-chopsticks">
          <path d="M596 170a30 30 0 0 1 60 0L647 870a21 21 0 0 1 -42 0Z" />
          <path d="M700 170a30 30 0 0 1 60 0L751 870a21 21 0 0 1 -42 0Z" />
        </g>
      </svg>
      <span className="launch-word">
        <span className="launch-ko">먹킷</span>
        <span className="launch-en">MUKKIT</span>
      </span>
    </div>
  );
}

# 업종 기본 그림 v2 — 디자인 검토 반영 (외곽 2.4 · 내부 2.0 · 점 r≥2 · 3/4 시점 · 그릇마다 다른 색과 림 위 소품)
import math, os
O = '#2b2d33'
OUT, IN = 2.4, 2.0
# 팔레트
RED, RED_D = '#e5553b', '#c7321f'
LEAF, LIME, SOJU = '#6aa84f', '#a8d080', '#4caf6a'
YOLK, NOODLE, CHEESE = '#f5b72e', '#f0c85a', '#f7d36b'
FRY, FRY_D = '#e3a24c', '#c9802e'
WHITE, RICE = '#ffffff', '#fffdf7'
STEEL = '#c9ced6'
WOOD = '#c9a37a'

def g(fill, body, sw=OUT): return f'<g fill="{fill}" stroke="{O}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round">{body}</g>'
def ln(body, c=O, sw=IN): return f'<g fill="none" stroke="{c}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{body}</g>'
def nf(fill, body): return f'<g fill="{fill}">{body}</g>'
def duo(d, c, w=2.4): return ln(f'<path d="{d}"/>', O, w + 2.2) + ln(f'<path d="{d}"/>', c, w)
def shadow(cx, cy, rx): return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{max(2, rx * .14):.1f}" fill="{O}" opacity=".12"/>'
def steam(xs, y0=8, y1=18): return ln(''.join(f'<path d="M{x} {y1}c-2-3 2-5 0-{y1 - y0}"/>' for x in xs), O, 2.2)
def bowl(fill, cx=32, y=30, w=46, h=21): return g(fill, f'<path d="M{cx - w / 2} {y}h{w}a{w / 2} {h} 0 0 1-{w} 0z"/>')
def rim(fill, cx=32, y=30, rx=23, ry=5.5, sw=OUT): return g(fill, f'<ellipse cx="{cx}" cy="{y}" rx="{rx}" ry="{ry}"/>', sw)
def plate(y=46, rx=25, ry=7): return shadow(32, y + 6, rx * .9) + g(WHITE, f'<ellipse cx="32" cy="{y}" rx="{rx}" ry="{ry}"/>') + ln(f'<ellipse cx="32" cy="{y - 1}" rx="{rx - 7}" ry="{ry - 2.6}"/>', '#d9d6d0', IN)
def leaf(x, y, rot=0, s=1, c=LEAF): return f'<g transform="translate({x} {y}) rotate({rot}) scale({s})">' + g(c, '<path d="M-5 0c2-4 8-4 10 0-2 4-8 4-10 0z"/>', IN) + '</g>'
def bumpy(cx, cy, rx, ry, n=20, amp=1.0):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + (amp / max(rx, ry)) * (1 if i % 2 else -.4)
        pts.append((cx + rx * r * math.cos(a), cy + ry * r * math.sin(a)))
    d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f}'
    for i in range(1, n + 1):
        x, y = pts[i % n]; px, py = pts[i - 1]
        d += f' Q{(px + x) / 2 + (x - cx) * .08:.1f} {(py + y) / 2 + (y - cy) * .08:.1f} {x:.1f} {y:.1f}'
    return d + 'z'

A = {}
# 국밥 — 갈색 뚝배기 + 나무 받침 + 숟가락
A['gukbap'] = (shadow(32, 55, 20) + g(WOOD, '<ellipse cx="32" cy="51" rx="21" ry="4.5"/>')
  + g('#5a4136', '<path d="M10 28h44c0 14-7 23-22 23S10 42 10 28z"/>') + rim('#5a4136', y=28, rx=22, ry=5.5)
  + rim('#f1e6d2', y=28.4, rx=18.5, ry=3.8, sw=IN) + g('#c9805a', '<ellipse cx="25" cy="28.5" rx="5" ry="1.8"/>', IN)
  + g(LEAF, '<ellipse cx="34" cy="28" rx="4" ry="1.8"/>', IN)
  + duo('M41 28L53 9', STEEL, 2.6) + steam([20, 27], 9, 20))
# 찌개 — 검정 양수 냄비 + 두부 + 김
A['jjigae'] = (shadow(32, 54, 20) + g('#3a3c42', '<ellipse cx="9" cy="32" rx="4.5" ry="3.2"/><ellipse cx="55" cy="32" rx="4.5" ry="3.2"/>')
  + g('#3a3c42', '<path d="M11 29h42l-2 15a8 8 0 0 1-8 7H21a8 8 0 0 1-8-7z"/>') + rim('#3a3c42', y=29, rx=21, ry=5.5)
  + rim(RED, y=29.4, rx=17.5, ry=3.8, sw=IN) + g(RICE, '<rect x="19" y="24" width="9" height="7" rx="1.6"/><rect x="33" y="25.5" width="9" height="7" rx="1.6"/>', IN)
  + g(LEAF, '<circle cx="45" cy="29" r="2.4"/>', IN) + steam([24, 31], 7, 18))
# 마라탕 · 훠궈 — 스텐 원앙솥 반반 + 마른 고추 + 연근
A['mala'] = (shadow(32, 53, 22) + g(STEEL, '<ellipse cx="7" cy="33" rx="3.5" ry="2.6"/><ellipse cx="57" cy="33" rx="3.5" ry="2.6"/>')
  + g(STEEL, '<path d="M8 32h48l-3 12a7 7 0 0 1-7 6H18a7 7 0 0 1-7-6z"/>') + rim(STEEL, y=32, rx=24, ry=7)
  + rim(RED_D, y=32.5, rx=20.5, ry=5, sw=IN) + g('#f1e6d2', '<path d="M32 27.5A20.5 5 0 0 1 32 37.5c3-3-3-7 0-10z"/>', IN)
  + g('#8f1f14', '<path d="M14 31c3-4 9-4 11-1-4 0-7 1-11 1z"/><path d="M18 35c3-3 8-3 10 0-4 1-7 1-10 0z"/>', IN) + ln('<path d="M25 30l2-2"/>', LEAF, 2.2)
  + g(WHITE, '<ellipse cx="44" cy="32" rx="6" ry="3.6"/>', IN) + nf(O, '<circle cx="42" cy="31.6" r="1.1"/><circle cx="46" cy="31.6" r="1.1"/><circle cx="44" cy="33.6" r="1.1"/>'))
# 냉면 — 스텐 대접 + 메밀면 타래 + 달걀 반쪽 + 오이 + 얼음
A['naengmyeon'] = (shadow(32, 54, 20) + bowl('#d5dae1', y=30, h=20) + ln('<path d="M13 37c12 4 26 4 38 0"/>', WHITE, 2.4)
  + rim('#e9eef0', y=30) + g('#8c7560', '<path d="M17 30c1-12 29-12 30 0z"/>')
  + ln('<path d="M22 27c3-4 7-5 10-5M27 29c3-5 9-6 13-4M35 28c2-2 5-3 7-2"/>', '#6e5b4b', IN)
  + g(WHITE, '<path d="M27 19a6 5.5 0 0 1 12 0z"/>', IN) + g(YOLK, '<path d="M30 19a3 3 0 0 1 6 0z"/>', IN)
  + g(LEAF, '<rect x="40" y="23" width="9" height="3.4" rx="1.4" transform="rotate(-20 44 24)"/>', IN)
  + g('#e8f4fb', '<rect x="13" y="25" width="6.5" height="6.5" rx="1.4" transform="rotate(12 16 28)"/><rect x="45" y="27" width="6" height="6" rx="1.4"/>', IN))
# 칼국수 — 베이지 도자기 + 젓가락이 든 넓은 면 + 애호박
A['noodle'] = (shadow(32, 54, 20) + bowl('#e7d3b0', y=31, h=20) + ln('<path d="M11 36c13 4 29 4 42 0"/>', '#a8794a', 2.6)
  + rim('#ead9a8', y=31) + duo('M33 30c-2-3 2-6 0-9', '#f6e7b8', 3.6) + duo('M38 30c-2-3 2-6 0-10', '#f6e7b8', 3.6)
  + duo('M50 4L35 21', '#c9a06a', 2.4) + duo('M56 7L40 22', '#c9a06a', 2.4)
  + g(LIME, '<path d="M15 31a5 5 0 0 1 10 0z"/>', IN) + g(LIME, '<path d="M43 32a4.5 4.5 0 0 1 9 0z"/>', IN) + nf(O, '<rect x="25" y="29" width="5" height="2.4" rx=".8"/>'))
# 우동 — 검정 칠기(안쪽 빨강) + 굵은 면 + 새우튀김 + 나루토
A['udon'] = (shadow(32, 54, 20) + bowl('#2f3036', y=31, h=20) + rim('#b8322a', y=31) + rim('#e8d5ae', y=31.3, rx=19.5, ry=4, sw=IN)
  + duo('M15 32c4-2 7 2 11 0', RICE, 4) + duo('M22 34c4-2 7 2 11 0', RICE, 4)
  + f'<g transform="rotate(-35 42 24)">' + g(FRY, f'<path d="{bumpy(42, 24, 11, 4.6, 18, .9)}"/>') + g('#f2875c', '<path d="M52 24l6-4v8z"/>', IN) + '</g>'
  + g(WHITE, '<circle cx="24" cy="29.5" r="4.2"/>', IN) + ln('<path d="M24 29.5a1.6 1.6 0 1 1 1.6 1.6"/>', '#e886a6', 2))
# 라멘 — 빨강 그릇 + 달걀 + 김 + 나루토 + 젓가락 (김 없음)
A['ramen'] = (shadow(32, 54, 20) + bowl(RED, y=31, h=20) + rim('#efc27a', y=31) + duo('M14 32c4 2 7-2 11 0s7-2 11 0', NOODLE, 2.4)
  + g(WHITE, '<circle cx="42" cy="29.5" r="5.4"/>', IN) + g(YOLK, '<circle cx="42" cy="29.5" r="2.8"/>', IN)
  + g('#2f3b33', '<rect x="16" y="20" width="8" height="11" rx="1"/>', IN) + g(WHITE, '<circle cx="31" cy="28.5" r="3.6"/>', IN)
  + ln('<path d="M31 28.5a1.4 1.4 0 1 1 1.4 1.4"/>', '#e886a6', 2) + duo('M50 4L36 27', '#c9a06a', 2.4) + duo('M56 7L40 28', '#c9a06a', 2.4))
# 쌀국수 — 흰 그릇 + 파란 띠 + 맑은 국물 + 소고기 + 바질 + 라임
A['pho'] = (shadow(32, 54, 20) + bowl(WHITE, y=31, h=20) + ln('<path d="M11 36c13 4 29 4 42 0"/>', '#3f6fb0', 3)
  + rim('#e2c48a', y=31) + duo('M15 32c4 1.5 7-1.5 11 0s7-1.5 11 0', WHITE, 1.8)
  + g('#e08a7a', '<path d="M20 27l9-2 1.5 3.5-9 2z"/><path d="M31 26.5l9 .5-.6 3.6-9-.5z"/>', IN)
  + leaf(19, 22, -40, 1.1) + leaf(26, 20, -70, 1.1) + g(LIME, '<path d="M44 30a7 7 0 0 1 12-5l-6 6z"/>', IN) + g(RED, '<circle cx="38" cy="31" r="2.2"/>', IN))
# 짜장면 — 흰 그릇 + 노란 면 1/3 + 검은 소스 돔 + 오이 + 단무지 종지
A['jjajang'] = (shadow(30, 54, 18) + bowl(WHITE, cx=28, y=31, w=42, h=19) + rim(NOODLE, cx=28, y=31, rx=21, ry=5)
  + ln('<path d="M11 31c2-1.5 4 1.5 6 0M12 33c2-1.5 4 1.5 6 0"/>', '#c9962e', 2) + g('#3b2f2a', '<path d="M18 31c1-10 26-11 28-1z"/>')
  + ln('<path d="M27 25c2-2 5-2 7-1"/>', '#6b5a50', 2.4) + g(LEAF, '<rect x="30" y="19" width="10" height="3.2" rx="1.4" transform="rotate(-15 35 20)"/>', IN)
  + g('#e8f0d0', '<circle cx="24" cy="24" r="2"/>', IN) + g(WHITE, '<ellipse cx="52" cy="50" rx="9" ry="3.4"/>', IN)
  + g(YOLK, '<path d="M46 49a3.5 3 0 0 1 7 0z"/><path d="M51 49.5a3.5 3 0 0 1 7 0z"/>', IN))
# 덮밥 — 남색 그릇 + 흰 물결 띠 + 밥 돔 + 고기 + 달걀 + 초생강
A['donburi'] = (shadow(32, 54, 20) + bowl('#34507a', y=31, h=20) + ln('<path d="M13 38c4-2 6 2 10 0s6 2 10 0 6 2 10 0 6 2 8 0"/>', WHITE, 2)
  + rim('#34507a', y=31) + g(RICE, '<path d="M11 31c1-13 41-13 42 0z"/>') + g('#b8742f', '<path d="M14 30c2-7 13-9 18-5 2 2 1 5-1 5z"/>', IN)
  + g(WHITE, '<ellipse cx="40" cy="24" rx="7" ry="5"/>', IN) + g(YOLK, '<circle cx="40" cy="24" r="3.2"/>', IN)
  + g(LEAF, '<circle cx="27" cy="20" r="2"/><circle cx="31" cy="24" r="2"/>', IN) + g('#f19aa6', '<circle cx="49" cy="28" r="2.2"/>', IN))
# 초밥 — 나무판 + 연어 · 참치(김 띠)
A['sushi'] = (shadow(32, 53, 23) + g(WOOD, '<path d="M7 42h50v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/>')
  + g(RICE, '<rect x="9" y="31" width="21" height="12" rx="5.5"/><rect x="34" y="31" width="21" height="12" rx="5.5"/>')
  + g('#f2875c', '<path d="M7 33c2-8 23-9 25-1 0 2-2 3-4 3H10c-2 0-3-1-3-2z"/>') + ln('<path d="M16 28l3 5M23 27l2 6"/>', '#ffd6bf', IN)
  + g('#d9443a', '<path d="M32 33c2-8 23-9 25-1 0 2-2 3-4 3H35c-2 0-3-1-3-2z"/>') + g('#26302a', '<rect x="42" y="27" width="5" height="16" rx="1"/>', IN))
# 딤섬 — 대나무 찜통 + 만두 둘(꼭지에서 방사 주름) + 김
A['dimsum'] = (shadow(32, 54, 22) + g('#d8b47c', '<path d="M8 33h48v13a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6z"/>') + ln('<path d="M8 39h48M8 45h48"/>', '#b89159', IN)
  + g(WHITE, '<path d="M11 33c0-9 6-13 10-13s10 4 10 13z"/><path d="M33 33c0-9 6-13 10-13s10 4 10 13z"/>')
  + ln('<path d="M21 21l-4 6M21 21v7M21 21l4 6M43 21l-4 6M43 21v7M43 21l4 6"/>', O, IN) + steam([27, 37], 4, 14))
# 양꼬치 — 이중선 꼬치 + 큰 고기 · 비계 + 큐민
def cube(x, y, c='#a8452d'): return g(c, f'<rect x="{x - 4.5}" y="{y - 4.5}" width="9" height="9" rx="2" transform="rotate(-45 {x} {y})"/>')
A['yangkkochi'] = (duo('M9 55L49 15', WOOD, 2.2) + duo('M17 59L57 19', WOOD, 2.2)
  + cube(21, 43) + cube(29, 35, '#f6dcc4') + cube(37, 27) + cube(29, 47) + cube(37, 39) + cube(45, 31, '#f6dcc4')
  + nf(YOLK, '<circle cx="22" cy="42" r="2"/><circle cx="37" cy="26" r="2"/><circle cx="37" cy="39" r="2"/>'))
# 피자 — 위로 3
A['pizza'] = (shadow(32, 55, 9) + g(CHEESE, '<path d="M32 52L12 13c12-6 28-6 40 0z"/>') + g('#d99a4a', '<path d="M12 13c12-6 28-6 40 0l-2 5c-11-5-25-5-36 0z"/>')
  + g(RED, '<circle cx="28" cy="25" r="4.4"/><circle cx="38" cy="31" r="4"/><circle cx="31" cy="40" r="3.4"/>', IN))
# 버거
A['burger'] = (shadow(32, 54, 21) + g(FRY, '<path d="M12 28a20 14 0 0 1 40 0z"/>') + nf('#fff3d6', '<ellipse cx="25" cy="20" rx="2" ry="1.3"/><ellipse cx="33" cy="17" rx="2" ry="1.3"/><ellipse cx="40" cy="21" rx="2" ry="1.3"/>')
  + g('#7cbf5a', '<path d="M10 30c3 3 6-1 9 1s6-2 9 0 6-2 9 0 6-2 9 0 6-1 8-1v-2H10z"/>', IN) + g(CHEESE, '<path d="M12 32h40l-6 5H18z"/>', IN)
  + g('#6b3f2a', '<rect x="11" y="34" width="42" height="7" rx="3.5"/>') + g(FRY, '<path d="M12 42h40v3a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z"/>'))
# 스테이크 — 불규칙 고기 + 지방 띠 + 격자 자국 + 분홍 단면 + 버터
A['steak'] = (plate() + g('#9c4a32', '<path d="M12 40c-1-9 8-14 16-12 4 1 6-2 11-1 5 1 6 5 5 9-1 6-9 9-19 9-8 0-13-1-13-5z"/>')
  + ln('<path d="M14 40c1-6 6-10 12-10"/>', '#f6dcc4', 3) + ln('<path d="M22 33l8 9M29 31l8 9M24 41l9-9"/>', '#6b2e1e', IN)
  + g('#e88a7a', '<path d="M44 44l4-14 5 1-3 14z"/><path d="M49 44l4-13 5 1-3 13z"/>', IN) + g(CHEESE, '<rect x="30" y="25" width="7" height="5" rx="1.4"/>', IN))
# 돈카츠 — 양배추 산 + 썬 조각 + 소스 + 레몬
def cut(x):
    return g(FRY, f'<path d="M{x} 44l5-14h7l-5 14z"/>') + g('#f6e3c6', f'<path d="M{x} 44h7l1.5 3.5h-7z"/>', IN)
A['donkatsu'] = (plate() + g('#d9ecb8', '<path d="M38 40c0-9 6-14 12-14s9 6 7 14z"/>', IN) + ln('<path d="M44 30c2 2 4 4 5 8M50 29c1 3 2 6 2 10"/>', '#9cc47a', IN)
  + cut(10) + cut(17) + cut(24) + cut(31) + ln('<path d="M14 34l4-3 3 3 4-3 3 3 4-3"/>', '#6b3f2a', 3)
  + g(CHEESE, '<path d="M50 44a5 5 0 0 1 8 2z"/>', IN))
# 파스타 — 높은 면 타래 + 꽂힌 포크 + 토마토 소스 + 바질
A['pasta'] = (plate() + g(NOODLE, '<path d="M13 44c-1-13 9-20 19-20s20 7 19 20z"/>') + ln('<path d="M18 40c4-8 22-8 26 0M22 34c4-5 14-5 18 0M20 44c6-4 18-4 24 0"/>', '#c9962e', IN)
  + g(RED, '<path d="M24 28c2-5 14-5 16 0-3 3-13 3-16 0z"/>', IN) + leaf(37, 24, -20, 1.1)
  + g(STEEL, '<rect x="30" y="6" width="4" height="22" rx="2"/>', IN) + ln('<path d="M29 6v-1M32 6v-1M35 6v-1"/>', O, 2.4))
# 브런치 — 식빵(봉긋한 윗변 · 껍질 테) + 달걀 + 베이컨
A['brunch'] = (plate() + g('#f0d3a0', '<path d="M11 44V32c-3-1-3-7 2-7 1-4 9-4 10 0 5 0 5 6 2 7v12z"/>') + ln('<path d="M13 43V33c-2-1-2-5 1-5 1-3 7-3 8 0 3 0 3 4 1 5v10"/>', FRY_D, IN)
  + g(WHITE, '<path d="M30 40c0-6 5-10 11-9 6 1 9 6 7 11-3 4-12 5-16 2-1-1-2-2-2-4z"/>') + g(YOLK, '<circle cx="40" cy="38" r="5"/>', IN)
  + duo('M44 47c2-2 4 2 6 0s4 2 6 0', '#d9705a', 2.4))
# 태국 — 팟타이 면 돔 + C자 새우 둘 + 라임 + 땅콩
def shrimp(x, y, rot):
    return f'<g transform="translate({x} {y}) rotate({rot})">' + g('#f2875c', '<path d="M-7 2a7 7 0 1 1 13 1l-4 1a3.5 3.5 0 1 0-6-1z"/>', IN) + g('#f2875c', '<path d="M-7 2l-3 3 4 1z"/>', IN) + ln('<path d="M-2-4.5l1 3M3-4l-1 3"/>', '#c9603a', IN) + '</g>'
A['thai'] = (plate() + g(FRY, '<path d="M13 44c-1-10 9-16 19-16s20 6 19 16z"/>') + ln('<path d="M18 40c4-6 22-6 26 0M22 34c4-4 14-4 18 0"/>', FRY_D, IN)
  + shrimp(24, 29, -10) + shrimp(38, 27, 15) + g(LIME, '<path d="M46 40a6 6 0 0 1 11-3l-6 4z"/>', IN)
  + nf('#c9802e', '<circle cx="18" cy="40" r="2"/><circle cx="32" cy="41" r="2"/><circle cx="44" cy="40" r="2"/>') + leaf(31, 21, 30, .9))
# 커리 — 기울여 세운 난 + 구리 카레 볼 + 크림 소용돌이 + 고수
A['curry'] = (shadow(30, 54, 22) + g('#f0d9a8', '<path d="M10 40c-2-14 8-30 18-30 8 0 8 10 4 18-4 9-12 16-22 12z"/>')
  + nf('#c9802e', '<ellipse cx="17" cy="30" rx="2.4" ry="1.6"/><ellipse cx="24" cy="21" rx="2" ry="1.4"/><ellipse cx="15" cy="38" rx="2" ry="1.4"/>')
  + g('#c98a4a', '<ellipse cx="22" cy="44" rx="3" ry="2.4"/><ellipse cx="56" cy="44" rx="3" ry="2.4"/>') + bowl('#c98a4a', cx=39, y=38, w=34, h=14)
  + rim('#d9822b', cx=39, y=38, rx=17, ry=4.5) + ln('<path d="M32 38c3-2 8-2 10 0s-3 2-5 1"/>', WHITE, 2) + leaf(46, 37, 10, .9))
# 김밥 — 뒤에 안 썬 통 + 앞에 썬 조각 둘 (3/4)
def gim(x, y):
    return (g('#26302a', f'<ellipse cx="{x}" cy="{y}" rx="10" ry="9"/>') + nf(RICE, f'<ellipse cx="{x}" cy="{y}" rx="7.2" ry="6.4"/>')
      + nf(YOLK, f'<rect x="{x - 4.4}" y="{y - 4.4}" width="4.2" height="4.2" rx=".8"/>') + nf('#f28c3c', f'<rect x="{x + .2}" y="{y - 4.4}" width="4.2" height="4.2" rx=".8"/>')
      + nf(LEAF, f'<rect x="{x - 4.4}" y="{y + .2}" width="4.2" height="4.2" rx=".8"/>') + nf('#f19aa6', f'<rect x="{x + .2}" y="{y + .2}" width="4.2" height="4.2" rx=".8"/>'))
A['gimbap'] = (shadow(32, 54, 22) + g('#26302a', '<path d="M24 14l32 8-4 13-32-8z"/>') + g('#26302a', '<ellipse cx="54" cy="28.5" rx="3.6" ry="6.6" transform="rotate(14 54 28.5)"/>')
  + nf(WHITE, '<circle cx="34" cy="20" r="1.2"/><circle cx="42" cy="22.5" r="1.2"/><circle cx="37" cy="26" r="1.2"/>') + gim(19, 41) + gim(40, 44))
# 떡볶이 — 초록 멜라민 접시 + 양념 떡 원통 + 어묵 + 달걀
def tteok(x, y, rot):
    return f'<g transform="rotate({rot} {x} {y})">' + g(RED, f'<rect x="{x - 7}" y="{y - 3.2}" width="14" height="6.4" rx="3.2"/>') + ln(f'<path d="M{x - 4} {y - 1.2}h7"/>', '#f7b8a8', 2) + '</g>'
A['tteokbokki'] = (shadow(32, 53, 23) + g('#7fbf8f', '<ellipse cx="32" cy="45" rx="26" ry="8"/>') + nf(WHITE, '<circle cx="12" cy="45" r="1.4"/><circle cx="52" cy="44" r="1.4"/><circle cx="32" cy="51" r="1.4"/>')
  + g(RED_D, '<path d="M12 42c0-7 9-11 20-11s20 4 20 11-9 6-20 6-20-1-20-6z"/>', IN)
  + tteok(21, 37, -12) + tteok(33, 33, 8) + tteok(27, 42, 4) + tteok(41, 40, -6) + tteok(36, 45, 12)
  + g('#f0c98a', '<path d="M42 26l12 2-6 9z"/>', IN) + g(WHITE, '<path d="M12 33a5 5 0 0 1 10 0z"/>', IN) + g(YOLK, '<path d="M14.5 33a2.5 2.5 0 0 1 5 0z"/>', IN))
# 고기구이 — 3/4 불판(놋쇠 테) + 화로 + 불꽃 + 줄무늬 삼겹살 + 마늘 · 상추
def belly(x, y, rot):
    return (f'<g transform="rotate({rot} {x} {y})">' + g('#f2a0a0', f'<rect x="{x - 11}" y="{y - 4.5}" width="22" height="9" rx="2.5"/>')
      + nf('#fff6ee', f'<rect x="{x - 10}" y="{y - 1.2}" width="20" height="2.6"/>') + '</g>')
A['gogi'] = (shadow(32, 56, 18) + g('#3a3c42', '<path d="M15 38l3 14h28l3-14z"/>') + g('#f28c3c', '<path d="M20 50c-2-3 1-6 3-8 0 3 3 4 1 8z"/><path d="M42 50c-2-3 1-6 3-8 0 3 3 4 1 8z"/>', IN)
  + g('#c9a15a', '<ellipse cx="32" cy="34" rx="25" ry="10"/>') + g('#4a4d55', '<ellipse cx="32" cy="33.5" rx="21" ry="7.6"/>', IN)
  + belly(24, 32, -8) + belly(39, 34, 6) + g(WHITE, '<ellipse cx="47" cy="29" rx="3" ry="2.4"/>', IN) + leaf(16, 27, -30, 1.1, '#7cbf5a'))
# 곱창 — 3/4 무쇠판 + C자로 휜 원통 곱창(구멍) + 부추 + 마늘
def gop(x, y, rot):
    return (f'<g transform="rotate({rot} {x} {y})">' + duo(f'M{x - 7} {y + 2}c3-6 11-6 14 0', '#f3c9a0', 6.4)
      + g('#c98a5a', f'<ellipse cx="{x + 7}" cy="{y + 2}" rx="3" ry="2.4"/>', IN) + ln(f'<path d="M{x - 2} {y - 1.5}l1 2M{x + 2} {y - 1.5}l-1 2"/>', FRY_D, IN) + '</g>')
A['gopchang'] = (shadow(32, 55, 22) + g('#3a3c42', '<path d="M6 42l9-14h43l-9 14z"/><path d="M6 42v4h43v-4"/>')
  + gop(22, 35, -6) + gop(36, 32, 10) + gop(32, 40, 2) + duo('M44 32l9-5M45 35l10-4M46 38l9-3', LEAF, 2)
  + g(WHITE, '<ellipse cx="14" cy="38" rx="3" ry="2.4"/>', IN))
# 족발 — 반달 썬 조각 넷(껍질 띠 · 살 · 비계) + 뼈 마디 + 상추 + 새우젓 종지
def jok(x, y, rot):
    return (f'<g transform="rotate({rot} {x} {y})">' + g('#e8b89a', f'<path d="M{x - 9} {y}a9 9 0 0 1 18 0z"/>')
      + ln(f'<path d="M{x - 7} {y}a7 7 0 0 1 14 0"/>', '#8a4a2e', 3.4) + ln(f'<path d="M{x - 3} {y - 1}a3 3 0 0 1 6 0"/>', '#f6dcc4', IN) + '</g>')
A['jokbal'] = (plate() + g('#fbf3e4', '<path d="M9 30l10 6"/><circle cx="8" cy="27" r="3.4"/><circle cx="11.5" cy="25" r="3.4"/>')
  + jok(18, 44, -25) + jok(28, 41, -8) + jok(38, 41, 8) + jok(47, 44, 25)
  + leaf(50, 30, -20, 1.4, '#7cbf5a') + g(WHITE, '<circle cx="54" cy="44" r="4.6"/>', IN) + nf('#f5c9b8', '<circle cx="54" cy="44" r="2.4"/>'))
# 닭요리 — 통닭 + 오른쪽 위로 모은 다리 둘 + 날개 호
A['dak'] = (plate() + g('#c9772f', '<path d="M11 40c0-10 9-16 19-16s19 6 19 15c0 4-9 7-19 7s-19-2-19-6z"/>')
  + ln('<path d="M17 37c2-5 6-7 10-7"/>', O, IN) + ln('<path d="M24 30c4-2 10-2 14 0"/>', '#f3c07a', 3)
  + g('#c9772f', '<ellipse cx="44" cy="26" rx="7" ry="4.5" transform="rotate(-40 44 26)"/><ellipse cx="38" cy="24" rx="7" ry="4.5" transform="rotate(-60 38 24)"/>')
  + g('#fbf3e4', '<circle cx="49" cy="18.5" r="2.4"/><circle cx="51.5" cy="21" r="2.4"/><circle cx="41" cy="16" r="2.4"/><circle cx="44" cy="17" r="2.4"/>', IN))
# 해물 · 생선 — 1.25배 + 지느러미 + 큰 눈
A['seafood'] = (shadow(32, 52, 19) + '<g transform="translate(-8 -8) scale(1.25)">' + g('#7fb3d5', '<path d="M8 34c8-12 26-14 38-4l10-7v22l-10-7c-12 10-30 8-38-4z"/><path d="M24 25l6-6 4 6z"/><path d="M26 42l5 5 3-6z"/>', 2)
  + nf(O, '<circle cx="17" cy="32" r="2.4"/>') + nf(WHITE, '<circle cx="16.3" cy="31.3" r=".9"/>') + ln('<path d="M27 26c3 4 3 10 0 14"/>', O, 1.7) + '</g>')
# 백반 · 한정식 — 3/4 밥공기(밥 돔) + 국그릇 + 반찬 종지 셋 + 수저
def side(x, y, c): return g(WHITE, f'<ellipse cx="{x}" cy="{y}" rx="6.4" ry="3.4"/>', IN) + nf(c, f'<ellipse cx="{x}" cy="{y - .3}" rx="4" ry="1.9"/>')
A['baekban'] = (shadow(30, 55, 22) + side(13, 24, LEAF) + side(26, 22, RED) + side(39, 24, YOLK)
  + bowl(WHITE, cx=18, y=38, w=22, h=13) + g(RICE, '<path d="M7.5 38c0-9 21-9 21 0z"/>') + rim(WHITE, cx=18, y=38, rx=11, ry=3, sw=IN)
  + bowl('#3a3c42', cx=40, y=38, w=22, h=13) + rim('#c98a4a', cx=40, y=38, rx=11, ry=3) + g(LEAF, '<ellipse cx="38" cy="38" rx="2.6" ry="1.2"/>', IN)
  + duo('M55 20v32', STEEL, 2.4) + duo('M59 20v32', WOOD, 2))
# 치킨 — 상자 속 튀김 조각 셋, 왼쪽 조각에 붙은 뼈
A['chicken'] = (shadow(32, 55, 19) + g(RED, '<path d="M12 36h40l-4 18H16z"/>') + ln('<path d="M20 40l2 12M32 40v12M44 40l-2 12"/>', WHITE, 2.4)
  + g('#fbf3e4', '<path d="M14 24l-5-5"/><circle cx="8" cy="17.5" r="2.6"/><circle cx="10.5" cy="15" r="2.6"/>')
  + g('#e9a548', f'<path d="{bumpy(21, 28, 10, 8)}"/>') + g('#f0b356', f'<path d="{bumpy(40, 27, 11, 9)}"/>') + g('#d9923a', f'<path d="{bumpy(31, 34, 9, 5.5)}"/>')
  + nf(FRY_D, '<circle cx="38" cy="23" r="2"/><circle cx="44" cy="29" r="2"/><circle cx="19" cy="26" r="2"/><circle cx="25" cy="31" r="2"/>'))
# 와인
A['wine'] = (shadow(32, 54, 10) + g('#e7f1f6', '<path d="M18 8h28c2 14-2 24-14 25-12-1-16-11-14-25z"/>') + g('#9b2f45', '<path d="M19 17h26c-1 8-6 14-13 14s-12-6-13-14z"/>', IN)
  + ln('<path d="M24 11c-1 5 0 10 2 13"/>', WHITE, 2.2) + ln('<path d="M32 33v17M21 52h22"/>', O, OUT))
# 칵테일
A['cocktail'] = (shadow(32, 54, 10) + g('#e7f1f6', '<path d="M11 12h42L32 35z"/>') + g('#f28c9b', '<path d="M17 16h30L32 31z"/>', IN)
  + ln('<path d="M32 35v15M22 52h20"/>', O, OUT) + duo('M41 17l8-11', WOOD, 1.8) + g('#8cc05a', '<circle cx="42" cy="15" r="4"/>', IN))
# 포차 · 소주 — 병 0.9배(안전 영역 안) + 큰 잔 하나
A['pocha'] = (shadow(30, 55, 19) + '<g transform="translate(2 6) scale(.9)">' + g(SOJU, '<path d="M23 6h8v8c0 2 3 4 4 7 1 2 1 4 1 6v24a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3V27c0-2 0-4 1-6 1-3 4-5 4-7z"/>')
  + g('#2e7d46', '<rect x="22.5" y="3" width="9" height="5" rx="1.5"/>', IN) + g('#fbf8f3', '<rect x="20" y="33" width="14" height="12" rx="2"/>', IN)
  + ln('<path d="M23 39h8"/>', '#2e7d46', 2.2) + ln('<path d="M21 26c1-3 2-4 3-5"/>', '#bfe8c9', 2.2) + '</g>'
  + g('#eef6f8', '<path d="M38 38h14l-1.6 16h-10.8z"/>') + nf('#d7eef3', '<path d="M39.2 44h11.6l-1 9h-9.6z"/>'))
# 호프 · 맥주
A['beer'] = (shadow(30, 55, 17) + g('#f2b33d', '<rect x="14" y="20" width="28" height="34" rx="4"/>') + g('#fffaf0', '<path d="M13 22c0-6 5-9 9-8 2-4 9-5 12-1 4-2 9 1 9 6 0 3-2 5-4 5H17c-2 0-4-1-4-2z"/>')
  + ln('<path d="M42 28h5a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-5"/>', O, OUT) + ln('<path d="M22 32v16M30 32v16"/>', '#c98a1a', IN))
# 아이스크림 — 위로 4
A['icecream'] = (shadow(32, 55, 6) + g('#e3b066', '<path d="M20 30h24L32 54z"/>') + ln('<path d="M25 35l10 10M39 35L29 45"/>', '#b98a3e', IN)
  + g('#f4a6b8', '<path d="M18 30a8 8 0 0 1 14-8 8 8 0 0 1 14 8z"/>') + g('#fbf3e4', '<circle cx="32" cy="16" r="8"/>') + g(RED, '<circle cx="32" cy="7.5" r="3"/>', IN))
# 베이커리 — 크루아상 마디 다섯, 양끝 아래로 말림
A['bakery'] = (shadow(32, 50, 20) + g(FRY, '<path d="M7 42c-2-5 0-10 5-11l4 9z"/><path d="M57 42c2-5 0-10-5-11l-4 9z"/>')
  + g('#e9ad5a', '<path d="M12 31c2-4 7-6 10-5l2 15c-5 2-9 1-12-2z"/><path d="M52 31c-2-4-7-6-10-5l-2 15c5 2 9 1 12-2z"/>')
  + g(FRY, '<path d="M22 26c6-4 14-4 20 0l-2 16c-5 2-11 2-16 0z"/>') + ln('<path d="M27 28l1 12M37 28l-1 12"/>', FRY_D, IN))
# 디저트 — 크림층 + 큰 딸기
A['dessert'] = (shadow(33, 54, 21) + g('#fff3e0', '<path d="M10 44l26-20 18 6v14z"/>') + g('#f4c2c2', '<path d="M10 44h44v8H10z"/>') + ln('<path d="M10 47.5h44"/>', WHITE, IN)
  + g('#fbf8f3', '<path d="M10 44l26-20 18 6-26 14z"/>') + g(RED, '<path d="M34 14c-4 0-6 4-5 7 1 3 4 4 5 4s4-1 5-4c1-3-1-7-5-7z"/>') + ln('<path d="M34 14l1-4"/>', LEAF, 2.2))
# 커피 — 큰 라떼 하트
A['coffee'] = (shadow(32, 54, 21) + g('#fbf8f3', '<ellipse cx="32" cy="50" rx="22" ry="5"/>') + g(WHITE, '<path d="M14 24h32v14a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14z"/>')
  + g('#a8714e', '<ellipse cx="30" cy="24" rx="16" ry="4"/>', IN) + nf('#f6e6d4', '<path d="M30 27c-5-2-5-5-2-5 1 0 2 1 2 1s1-1 2-1c3 0 3 3-2 5z"/>')
  + ln('<path d="M46 28h3a5 5 0 0 1 0 10h-4"/>', O, OUT) + steam([24, 34], 8, 17))
# 기타 — 탑뷰 접시 + 면으로 된 포크 · 나이프
A['other'] = (g(WHITE, '<circle cx="32" cy="32" r="15"/>') + ln('<circle cx="32" cy="32" r="10"/>', '#d9d6d0', IN)
  + g(STEEL, '<path d="M9 12v9a3 3 0 0 0 2 3v26h3V24a3 3 0 0 0 2-3v-9h-1v8h-1v-8h-1v8h-1v-8z"/>', 1.6)
  + g(STEEL, '<path d="M53 12c-3 1-4 6-4 13h3v25h3V12z"/>', 1.8))
# 음식점 아님 — 회색 핀
A['nonFood'] = shadow(32, 56, 8) + g('#8b8f98', '<path d="M32 56s-15-14-15-26a15 15 0 0 1 30 0c0 12-15 26-15 26z"/>') + g(WHITE, '<circle cx="32" cy="30" r="5.5"/>', IN)

DEF = {'korean': 'baekban', 'japanese': 'sushi', 'chinese': 'jjajang', 'western': 'pasta', 'asian': 'pho', 'snack': 'tteokbokki', 'bar': 'beer', 'cafe': 'coffee'}
for k, v in DEF.items(): A[k] = A[v]
os.makedirs('out2', exist_ok=True)
for k, v in A.items():
    open(f'out2/{k}.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{v}</svg>')
print(len(A))

# 족발 다시 — 큰 반달 조각 다섯을 부채꼴로 겹침: 굵은 갈색 껍질 띠(면) + 분홍빛 살 + 비계 선, 뒤 가운데 뼈 마디
def jok2(x, y, rot):
    return (f'<g transform="rotate({rot} {x} 46)">' + g('#7a3f26', f'<path d="M{x - 11} {y}a11 11 0 0 1 22 0z"/>')
      + g('#ecc0a4', f'<path d="M{x - 7.5} {y}a7.5 7.5 0 0 1 15 0z"/>', IN) + ln(f'<path d="M{x - 3.5} {y - .5}a3.5 3.5 0 0 1 7 0"/>', '#fbe9da', IN) + '</g>')
A['jokbal'] = (plate() + g('#fbf3e4', '<path d="M32 30V16"/><circle cx="29.5" cy="13" r="3.6"/><circle cx="34.5" cy="13" r="3.6"/>')
  + jok2(32, 44, -50) + jok2(32, 44, -25) + jok2(32, 44, 0) + jok2(32, 44, 25) + jok2(32, 44, 50)
  + leaf(12, 36, -30, 1.3, '#7cbf5a') + g(WHITE, '<circle cx="53" cy="44" r="4.6"/>', IN) + nf('#f5c9b8', '<circle cx="53" cy="44" r="2.4"/>'))
open('out2/jokbal.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{A["jokbal"]}</svg>')

# 족발 다시 2 — 조각을 왼쪽에서 오른쪽으로 펼쳐 겹침(각자 기울기), 뼈 마디는 뒤에 사선
def jok3(x, y, rot):
    return (f'<g transform="rotate({rot} {x} {y})">' + g('#7a3f26', f'<path d="M{x - 9} {y}a9 9 0 0 1 18 0z"/>')
      + g('#ecc0a4', f'<path d="M{x - 6} {y}a6 6 0 0 1 12 0z"/>', IN) + ln(f'<path d="M{x - 2.8} {y - .4}a2.8 2.8 0 0 1 5.6 0"/>', '#fbe9da', IN) + '</g>')
A['jokbal'] = (plate() + g('#fbf3e4', '<path d="M40 34L51 20"/><circle cx="51" cy="16.5" r="3.4"/><circle cx="55" cy="19.5" r="3.4"/>')
  + jok3(15, 45, -22) + jok3(24, 42, -10) + jok3(33, 41, 0) + jok3(42, 42, 10) + jok3(50, 45, 22)
  + leaf(13, 33, -30, 1.3, '#7cbf5a'))
open('out2/jokbal.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{A["jokbal"]}</svg>')

# 족발 뼈를 굵은 뼈 모양(면)으로
BONE = '<g transform="translate(45 27) rotate(-35)">' + g('#fbf3e4', '<rect x="-10" y="-3.2" width="20" height="6.4" rx="3"/><circle cx="-10" cy="-3" r="3.6"/><circle cx="-10" cy="3" r="3.6"/><circle cx="10" cy="-3" r="3.6"/><circle cx="10" cy="3" r="3.6"/>') + nf('#fbf3e4', '<rect x="-9" y="-2" width="18" height="4"/>') + '</g>'
A['jokbal'] = (plate() + BONE + jok3(15, 45, -22) + jok3(24, 42, -10) + jok3(33, 41, 0) + jok3(42, 42, 10) + jok3(50, 45, 22) + leaf(13, 33, -30, 1.3, '#7cbf5a'))
open('out2/jokbal.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{A["jokbal"]}</svg>')

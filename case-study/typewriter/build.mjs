// Voice typewriter for the case-study hero, drawn with the anatomy kit.
// Spoken words stream into the left of the machine; each character presses its key,
// the carriage steps left one character, and the line lands on the paper in the platen.
// At a line end the carriage returns and the paper feeds up one line.
//   node build.mjs            → writes preview.html and injects the hero into ../index.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../../.claude/skills/anatomy/kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------- world (units ≈ px; x right, y toward the typist, z up) ----------
const FIG_W = 720, FIG_H = 600;
const PLATE = { x: -124, y: -66, w: 248, d: 184, r: 10 };
const PLATE_H = 8, FOOT_H = 4;
const CHASSIS = { x: -92, y: -44, w: 184, d: 140, r: 14 };
const CH_Z0 = 4, CH_Z1 = 24;
const FRONT = CHASSIS.y + CHASSIS.d;                     // chassis front face (y)
const HOUSING = { x: -82, y: -44, w: 164, d: 62, r: 10 };
const HO_Z1 = 58;
const HO_FRONT = HOUSING.y + HOUSING.d;                  // housing front face (y)
const WINDOW = { x0: -27, x1: 27, z0: 32, z1: 50, r: 9, depth: 3 };

const RAIL = { x: -104, y: -42, w: 208, d: 16, r: 3 };
const RAIL_Z0 = HO_Z1, RAIL_Z1 = HO_Z1 + 4;
const PLATEN = { y: -30, z: 74, r: 11, x0: -86, x1: 86 };
const PAPER = { x0: -60, x1: 60, y: -37, t: 0.8, z0: 66, z1: 160 };
const PAPER_FACE = PAPER.y + PAPER.t;
const BAIL = { y: -18, z: 90, r: 1.3 };
const TEXT = { size: 8, adv: 8 * 0.6, base: 99, lh: 11, x0: -55 };

const LINES = ["The keeper never opened", "the first letter. He", "read it every night,", "then put it in a tin."];
const ROWS = ["zxcvbnm,./", "asdfghjkl;'", "qwertyuiop-", "1234567890"];  // front row first

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners({ x: -134, y: -44, w: 268, d: 20, r: 2 }, 0, PAPER.z1)],
  FIG_W, FIG_H, { pad: 18, azimuth: 52 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);

// A window set into a vertical face at y, with its recess walls drawn (from the desk-computer example).
let clips = 0;
function recess({ x0, x1, z0, z1, r, depth }, y, back = "", backClass = "tw-well") {
  const id = `tw-clip-${clips++}`;
  const ring = k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 6);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const { sinA } = k.cameraOf(P);
  const tops = [], sides = [[], [], [], []];
  ring.forEach(([ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / len, -(bx - ax) / len];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    if (nx <= 0 && nz <= 0) return;
    const quad = k.pathOf([at([ax, y, az]), at([bx, y, bz]), at([bx, y - depth, bz]), at([ax, y - depth, az])], true);
    if (nz >= nx) tops.push(quad);
    else sides[Math.min(3, Math.max(0, Math.floor(((nx * -sinA + 1) / 2) * 4)))].push(quad);
  });
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, s) => (d.length ? `<path class="iso-shade" data-shade="${s}" d="${d.join("")}"/>` : "")),
    `<g transform="${planeOf(y - depth)}"><path class="${backClass}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    `</g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

// ---------- base ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 6.5, -PLATE_H - FOOT_H, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.1, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge: one tick per character pitch
  const strip = { x: -80, y: PLATE.y + PLATE.d - 12, w: 160, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(-76, 76, TEXT.adv * 2, 5, strip.y, 0.6, [2, 3.6], P, "x");
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // label plate with three rule lines
  const label = { x: 92, y: PLATE.y + PLATE.d - 20, w: 22, d: 12, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L([14, 10, 12].map((w, i) => k.lineOnTop([label.x + 3, label.y + 3 + i * 3], [label.x + 3 + w, label.y + 3 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
  return out.join("");
}

// ---------- body ----------
function body() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CHASSIS, CH_Z0, 6, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(CHASSIS, 14))) out.push(S(k.cylinder(x, y, 4.2, 0, CH_Z0, P, 18), { tone: "lo" }));
  out.push(S(k.slabOf(CHASSIS, CH_Z0, CH_Z1 - CH_Z0, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(CHASSIS, CH_Z0 + 7, P, 8), { tone: "faint" }) }));
  // key-deck groove and corner screws on the chassis top
  const deck = { x: -84, y: HO_FRONT + 4, w: 168, d: FRONT - HO_FRONT - 10, r: 6 };
  out.push(L(k.planOutline(deck, CH_Z1, P, 6), { tone: "lo" }));
  out.push(D(k.corners(deck, 4).map(([x, y]) => at([x, y, CH_Z1])), { size: 0.45 }));
  // engraved Flow mark on the chassis front face (the one label in the drawing)
  const bars = [[0, 1], [1, 0.44], [2, 0.67], [3, 0.44], [4, 1]].map(([i, h]) => flat(-7 + i * 3, 12 - h * 3.2, -5.6 + i * 3, 12 + h * 3.2, 0.7, 3)).join("");
  out.push(`<g transform="${planeOf(FRONT)}"><path class="tw-mark" d="${bars}"/></g>`);
  // typebar housing with its ribbon window (Flow's waveform lives in it)
  out.push(S(k.slabOf(HOUSING, CH_Z1, HO_Z1 - CH_Z1, P, 8, 1.2), { tone: "mid", inner: L(k.sideSeam(HOUSING, HO_Z1 - 6, P, 8), { tone: "faint" }) }));
  const fan = k.radialTicks(0, HOUSING.y + 30, 22, 36, 6, HO_Z1, [3, 7], P, -Math.PI / 2, Math.PI);  // minors grow in from the r=22 ring; majors run ring to ring (r=15)
  out.push(L(k.ring(0, HOUSING.y + 30, 22, HO_Z1, P, 48), { tone: "lo" }) + L(k.ring(0, HOUSING.y + 30, 15, HO_Z1, P, 40), { tone: "faint" }));
  out.push(L(fan.minor, { tone: "faint" }), L(fan.major, { tone: "lo" }));
  const wave = [8, 14, 6, 18, 11, 16, 9, 13, 7, 15, 10, 5].map((h, i) =>
    `<rect class="tw-bar" x="${(-19 + i * 3.4).toFixed(1)}" y="${-(41 + h / 2)}" width="1.5" height="${h}" rx=".75" style="animation-delay:${((i * 0.13) % 1).toFixed(2)}s"/>`).join("");
  out.push(recess(WINDOW, HO_FRONT, `<g class="tw-wave">${wave}</g>`));
  out.push(D([at([WINDOW.x1 + 6, HO_FRONT, 41]), at([WINDOW.x0 - 6, HO_FRONT, 41])], { size: 0.5, tone: "mid" }));
  return out.join("");
}

// ---------- carriage (moves along x as a group) ----------
function carriage() {
  const out = [];
  out.push(S(k.slabOf(RAIL, RAIL_Z0, RAIL_Z1 - RAIL_Z0, P, 3, 0.6), { tone: "lo" }));
  const scale = { x: -98, y: RAIL.y + 4, w: 196, d: 3, r: 1 };
  out.push(L(k.planOutline(scale, RAIL_Z1, P, 3), { tone: "lo" }));
  const t = k.topTicks(-94, 94, TEXT.adv * 2, 5, scale.y + scale.d, RAIL_Z1, [1.6, 2.8], P, "x");
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // paper rest behind the sheet
  out.push(S(k.slabOf({ x: -72, y: -44, w: 144, d: 3, r: 1 }, RAIL_Z1, 70, P, 3, 0.4), { tone: "lo" }));
  // the paper and what has been typed on it
  out.push(S(k.slabOf({ x: PAPER.x0, y: PAPER.y, w: PAPER.x1 - PAPER.x0, d: PAPER.t, r: 0.2 }, PAPER.z0, PAPER.z1 - PAPER.z0, P, 2), { tone: "hi", className: "tw-paper" }));
  const lines = LINES.map((_, i) => `<text class="tw-type" data-line="${i}" x="${TEXT.x0}" y="${-TEXT.base + i * TEXT.lh}" font-size="${TEXT.size}"></text>`).join("");
  out.push(`<clipPath id="tw-sheet"><path d="${flat(PAPER.x0, PAPER.z0, PAPER.x1, PAPER.z1, 0.2, 2)}"/></clipPath>`);
  out.push(`<g transform="${planeOf(PAPER_FACE)}"><g clip-path="url(#tw-sheet)"><g data-scroll>${lines}</g></g></g>`);
  // platen: rubber roller along x, with end plates and knurled knobs
  const PF = G.frameAlong([PLATEN.x0, PLATEN.y, PLATEN.z], [1, 0, 0]);
  const len = PLATEN.x1 - PLATEN.x0;
  const knob = (s0, s1) => S(G.lathe([[s0, 0], [s0, 8.5], [s1, 8.5], [s1, 0]], PF, P, { steps: 40, bevel: 0.4 }), { tone: "mid", inner: k.fadedSvg(G.ribsOf(PF, s0 + 0.6, s1 - 0.6, 8.5, 26, P, { fade: [0.05, 0.45], seams: true }), { tone: "faint" }) });
  const plate = (s0, s1) => S(G.lathe([[s0, 0], [s0, 13], [s1, 13], [s1, 0]], PF, P, { steps: 48, bevel: 0.4 }), { tone: "mid" });
  out.push(knob(-20, -8), plate(-8, 0));
  out.push(S(G.lathe([[0, 0], [0, PLATEN.r], [len, PLATEN.r], [len, 0]], PF, P, { steps: 56 }), { tone: "lo", inner: L(G.arcOf(PF, len / 2 - 40, PLATEN.r, P) + G.arcOf(PF, len / 2 + 40, PLATEN.r, P), { tone: "faint" }) }));
  // paper bail: a rod in front of the sheet with two rollers
  const BF = G.frameAlong([-70, BAIL.y, BAIL.z], [1, 0, 0]);
  out.push(S(G.lathe([[0, 0], [0, BAIL.r], [140, BAIL.r], [140, 0]], BF, P, { steps: 20 }), { tone: "mid" }));
  for (const s of [40, 100]) out.push(S(G.lathe([[s - 3, 0], [s - 3, 3.2], [s + 3, 3.2], [s + 3, 0]], BF, P, { steps: 28, bevel: 0.3 }), { tone: "mid" }));
  out.push(plate(len, len + 8), knob(len + 8, len + 20));
  // carriage-return lever on the left
  out.push(S(k.slabOf({ x: -112, y: -34, w: 4, d: 4, r: 1 }, RAIL_Z1, 30, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -134, y: -34, w: 26, d: 4, r: 2 }, RAIL_Z1 + 26, 4, P, 4, 0.4), { tone: "mid" }));
  return `<g data-carriage>${out.join("")}</g>`;
}

// ---------- keys ----------
const keyIndex = {};
function keys() {
  const out = [];
  let n = 0;
  ROWS.map((row, r) => ({ row, r })).reverse().forEach(({ row, r }) => {     // paint the back row first
    const y = 84 - r * 12.5;
    const x0 = -((row.length - 1) * 13) / 2 + (r % 2 ? 3 : -3);
    const top = 31 + r * 4.2;
    [...row].map((ch, i) => ({ ch, x: x0 + i * 13 }))
      .sort((a, b) => k.depthOf([a.x, y, 0], P) - k.depthOf([b.x, y, 0], P))
      .forEach(({ ch, x }) => {
        keyIndex[ch] = n;
        out.push(`<g class="tw-key" data-key="${n++}">` +
          S(k.cylinder(x, y, 1.3, CH_Z1, top - 3.2 - CH_Z1, P, 12), { tone: "lo" }) +
          S(k.cylinder(x, y, 5.3, top - 3.2, 0.8, P, 28), { tone: "mid" }) +
          S(k.cylinder(x, y, 4.7, top - 2.4, 2.4, P, 28, 0.3), { tone: "hi" }) +
          L(k.ring(x, y, 3.2, top, P, 20), { tone: "faint" }) + `</g>`);
      });
  });
  // space bar on two stems
  keyIndex[" "] = n;
  const bar = { x: -46, y: 92, w: 92, d: 5.4, r: 2.7 };
  out.push(`<g class="tw-key" data-key="${n++}">` +
    [-30, 30].map((x) => S(k.cylinder(x, 94.7, 1.2, CH_Z1, 3, P, 12), { tone: "lo" })).join("") +
    S(k.slabOf(bar, CH_Z1 + 3, 2.6, P, 4, 0.4), { tone: "hi" }) + `</g>`);
  return out.join("");
}

const figure = [base(), body(), carriage(), keys()].join("");

// ---------- the hero band: spoken words stream into the machine ----------
const BAND_W = 1600, BAND_H = 440, TX = 860, TY = -250;   // the machine rises into the empty column beside the title
// words end just inside the left edge of the ribbon window, where Flow's waveform listens
const entry = at([WINDOW.x0 + 4, HO_FRONT, (WINDOW.z0 + WINDOW.z1) / 2]).map((v, i) => v + (i ? TY : TX));
const spokenPath = `M -40 400 C 160 395, 400 370, 470 265 C 540 155, 450 65, 350 80 C 235 97, 220 235, 330 285 C 470 345, ${entry[0] - 380} ${entry[1] + 40}, ${entry[0].toFixed(1)} ${entry[1].toFixed(1)}`;
const SPOKEN = "so, um, there’s this lighthouse keeper, right, and he keeps getting letters from someone who drowned, like, years ago, and he just… never opens the first one · ";

const heroSvg = `<svg class="iso-svg tw-band" viewBox="0 0 ${BAND_W} ${BAND_H}" role="img" aria-label="Rambling spoken words stream into a typewriter whose ribbon window shows Flow's waveform; each word presses its keys, the carriage steps along, and the sentence is typed onto the paper as clean book prose.">
<defs><path id="tw-spoken" d="${spokenPath}"/></defs>
<g transform="translate(${TX} ${TY})">${figure}</g>
<text class="tw-spoken" font-size="22"><textPath id="tw-spoken-tp" href="#tw-spoken">${SPOKEN}</textPath></text>
</svg>`;

const css = `<style>
.tw-hero{--anatomy-page:#1a1a1a;--anatomy-card:#1a1a1a;--anatomy-paper:#1a1a1a;--anatomy-halo:#050505}
.tw-band{display:block;width:100%;height:auto;overflow:visible}
.tw-spoken{fill:#8a8984;font-family:Figtree,system-ui,sans-serif;font-weight:500}
.tw-paper .iso-top,.tw-paper .iso-face,.tw-paper .iso-shade{fill:#fbf9f4}
.tw-paper .iso-edge{stroke:#d9d4c7}
.tw-type{fill:#1d1b17;font-family:'Google Sans Code',ui-monospace,monospace;white-space:pre}
.tw-well{fill:var(--anatomy-shade-0)}
.tw-bar{fill:#d2ace9;transform-box:fill-box;transform-origin:center}
.tw-mark{fill:var(--anatomy-lo)}
@media (prefers-reduced-motion:no-preference){.tw-bar{animation:tw-talk 1.1s ease-in-out infinite alternate}}
@keyframes tw-talk{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
</style>`;

// ---------- live ----------
const vx = k.axisVector(P, [1, 0, 0]);
const vdown = k.axisVector(P, [0, 0, -1]);
const live = `(() => {
const LINES = ${JSON.stringify(LINES)}, KEY = ${JSON.stringify(keyIndex)};
const VX = ${JSON.stringify(vx)}, VD = ${JSON.stringify(vdown)}, ADV = ${TEXT.adv}, X0 = ${TEXT.x0}, LH = ${TEXT.lh};
const root = document.querySelector(".tw-hero");
const band = root.querySelector(".tw-band");
const carriage = band.querySelector("[data-carriage]");
const scroll = band.querySelector("[data-scroll]");
const rows = [...band.querySelectorAll(".tw-type")];
const keyEls = [...band.querySelectorAll(".tw-key")];
const tp = band.querySelector("#tw-spoken-tp");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

// the carriage sits so the next character lands at the strike point (x = 0)
const place = (col) => { const dx = -(X0 + col * ADV); carriage.setAttribute("transform", "translate(" + (VX[0] * dx).toFixed(2) + " " + (VX[1] * dx).toFixed(2) + ")"); };
const feed = (line) => scroll.setAttribute("transform", "translate(0 " + (-line * LH) + ")");
if (still) { rows.forEach((r, i) => (r.textContent = LINES[i])); feed(LINES.length - 1); place(LINES.at(-1).length); return; }

// three copies, slid by exactly one copy's length: seamless, and always covering the path to the window.
// Measured after the web font loads, or the period is the fallback font's and the stream jumps each cycle.
tp.textContent = tp.textContent.repeat(3);
let loopLen = 0;
const keyAt = keyEls.map(() => 0), keyHeld = keyEls.map(() => 0);
let line = 0, col = 0, wait = 1, ret = null, visible = true, prev = 0;
place(0); feed(0);

function press(ch) {
  const i = KEY[ch.toLowerCase()];
  if (i != null) keyHeld[i] = 0.09;
}
function step(dt) {
  wait -= dt;
  if (ret) {                                         // carriage return: ease back, then feed a line
    ret.t = Math.min(1, ret.t + dt / 0.45);
    const e = 1 - Math.pow(1 - ret.t, 3);
    place(ret.from * (1 - e));
    if (ret.t === 1) { ret = null; line++; feed(line); wait = 0.35; }
    return;
  }
  if (wait > 0) return;
  if (line >= LINES.length) { line = 0; col = 0; rows.forEach((r) => (r.textContent = "")); place(0); feed(0); wait = 0.8; return; }
  const text = LINES[line];
  if (col < text.length) {
    press(text[col]); col++;
    rows[line].textContent = text.slice(0, col);
    place(col);
    wait = 0.07 + (text[col - 1] === " " ? 0.07 : 0) + ((col * 37) % 5) * 0.012;
  } else if (line < LINES.length - 1) { ret = { from: col, t: 0 }; col = 0; }
  else { line = LINES.length; wait = 2.6; }
}
function tick(now) {
  const dt = prev ? Math.min((now - prev) / 1000, 1 / 30) : 1 / 60;
  prev = now;
  step(dt);
  keyEls.forEach((el, i) => {
    if (!keyHeld[i] && !keyAt[i]) return;
    keyHeld[i] = Math.max(0, keyHeld[i] - dt);
    const want = keyHeld[i] > 0 ? 2.2 : 0;
    keyAt[i] += (want - keyAt[i]) * (1 - Math.exp(-dt / (want ? 0.02 : 0.06)));
    if (Math.abs(want - keyAt[i]) < 0.02) keyAt[i] = want;
    el.setAttribute("transform", "translate(" + (VD[0] * keyAt[i]).toFixed(2) + " " + (VD[1] * keyAt[i]).toFixed(2) + ")");
  });
  tp.setAttribute("startOffset", ((now / 1000 * 70) % loopLen) - loopLen);
  if (visible) requestAnimationFrame(tick); else prev = 0;
}
new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) requestAnimationFrame(tick); }).observe(band);
document.fonts.ready.then(() => { loopLen = tp.getSubStringLength(0, tp.textContent.length / 3); requestAnimationFrame(tick); });
})();`;

const fragment = `${css}\n<div class="iso tw-hero">${heroSvg}</div>\n<script>${live}</script>`;

// preview page for the skill's line check
writeFileSync(join(HERE, "preview.html"), `<!doctype html><html><head><meta charset="utf-8"><style>${k.ISO_CSS}
@font-face{font-family:Figtree;src:url(../../assets/figtree.ttf)}@font-face{font-family:'Google Sans Code';src:url(../../assets/googlesanscode.ttf)}
body{margin:0;background:#1a1a1a}</style></head><body>${fragment}</body></html>`);

// inject into the case study between markers
const page = join(HERE, "..", "index.html");
const html = readFileSync(page, "utf8");
const START = "<!-- TYPEWRITER:START -->", END = "<!-- TYPEWRITER:END -->";
if (!html.includes(START)) throw new Error("markers missing in index.html");
const isoCss = `<style>${k.ISO_CSS}</style>\n`;
writeFileSync(page, html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), `${START}\n${isoCss}${fragment}\n${END}`));
console.log("wrote preview.html and injected hero", { keys: Object.keys(keyIndex).length });

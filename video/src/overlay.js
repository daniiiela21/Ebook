// 2D text layer drawn on top of the 3D frame.
import { clamp, seg, easeOutBack, easeOut } from './util.js';

const FONT = '"Fredoka", "DejaVu Sans", sans-serif';
const INK = '#3d4a35';
const ACCENT = '#c9704a';
const EMOJI = {};

export async function loadOverlayAssets() {
  const faces = [
    ['Fredoka', '/node_modules/@fontsource/fredoka/files/fredoka-latin-500-normal.woff2', '500'],
    ['Fredoka', '/node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2', '600'],
    ['Fredoka', '/node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff2', '700'],
  ];
  for (const [fam, url, weight] of faces) {
    const f = new FontFace(fam, `url(${url})`, { weight });
    await f.load();
    document.fonts.add(f);
  }
  for (const code of ['1f331', '1f33f', '1f96c', '2728', '1f4c5']) {
    const img = new Image();
    img.src = `/node_modules/@twemoji/svg/${code}.svg`;
    await img.decode();
    EMOJI[code] = img;
  }
}

// Text runs: string, or {t:'MUITA', color}, or {emoji:'1f331'}
function measureRuns(ctx, runs, size) {
  let w = 0;
  const out = runs.map((r) => {
    const o = typeof r === 'string' ? { t: r } : r;
    o.w = o.emoji ? size * 1.05 : ctx.measureText(o.t).width;
    w += o.w;
    return o;
  });
  return { runs: out, w };
}

function wrapRuns(ctx, runs, size, maxW) {
  // split string runs into words so lines can wrap
  const words = [];
  for (const r of runs) {
    if (typeof r === 'string') {
      r.split(/(\s+)/).filter(Boolean).forEach((w) => words.push({ t: w }));
    } else words.push({ ...r });
  }
  const lines = [[]];
  let lw = 0;
  for (const w of words) {
    const ww = w.emoji ? size * 1.05 : ctx.measureText(w.t).width;
    const isSpace = w.t && /^\s+$/.test(w.t);
    if (lw + ww > maxW && lines[lines.length - 1].length && !isSpace) {
      lines.push([]);
      lw = 0;
    }
    if (isSpace && lines[lines.length - 1].length === 0) continue;
    lines[lines.length - 1].push(w);
    lw += ww;
  }
  return lines.map((l) => {
    while (l.length && l[l.length - 1].t && /^\s+$/.test(l[l.length - 1].t)) l.pop();
    return measureRuns(ctx, l, size);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRuns(ctx, line, x, y, size, color) {
  let cx = x;
  for (const r of line.runs) {
    if (r.emoji) {
      ctx.drawImage(EMOJI[r.emoji], cx + size * 0.04, y - size * 0.5, size * 0.95, size * 0.95);
    } else {
      ctx.fillStyle = r.color || color;
      ctx.fillText(r.t, cx, y);
    }
    cx += r.w;
  }
}

// A caption card: centered at (cx, cy); animates in with a soft pop.
export function caption(ctx, runs, { cx = 540, cy = 360, size = 64, weight = 600, maxW = 800, t, t0, t1, bg = 'rgba(255,251,242,0.94)', color = INK, pad = 38, radius = 40, lineH = 1.22 }) {
  if (t < t0 || t > t1 + 0.2) return;
  const kin = easeOutBack(seg(t, t0, t0 + 0.32));
  const kout = 1 - easeOut(seg(t, t1, t1 + 0.18));
  const a = clamp(seg(t, t0, t0 + 0.14)) * kout;
  if (a <= 0) return;
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const lines = wrapRuns(ctx, runs, size, maxW);
  const w = Math.max(...lines.map((l) => l.w)) + pad * 2;
  const h = lines.length * size * lineH + pad * 1.35;
  ctx.globalAlpha = a;
  ctx.translate(cx, cy + (1 - kin) * 26);
  const sc = 0.9 + 0.1 * kin;
  ctx.scale(sc, sc);
  if (bg) {
    ctx.shadowColor = 'rgba(110,85,40,0.16)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  lines.forEach((l, i) => {
    const y = -h / 2 + pad * 0.68 + size * lineH * (i + 0.5);
    drawRuns(ctx, l, -l.w / 2, y, size, color);
  });
  ctx.restore();
}

// Small plant label pill anchored to a screen point.
export function label(ctx, emoji, text, { x, y, t, t0, t1 }) {
  if (t < t0) return;
  const k = easeOutBack(seg(t, t0, t0 + 0.3));
  const a = clamp(seg(t, t0, t0 + 0.12)) * (1 - easeOut(seg(t, t1, t1 + 0.15)));
  if (a <= 0) return;
  const size = 42;
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  const w = tw + size * 1.25 + 44, h = size + 32;
  ctx.globalAlpha = a;
  ctx.translate(x, y - (1 - k) * 18);
  ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  ctx.shadowColor = 'rgba(110,85,40,0.18)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,251,242,0.95)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // pointer
  ctx.beginPath();
  ctx.moveTo(-12, h / 2 - 1); ctx.lineTo(0, h / 2 + 13); ctx.lineTo(12, h / 2 - 1);
  ctx.fill();
  ctx.drawImage(EMOJI[emoji], -w / 2 + 20, -size * 0.52, size * 1.04, size * 1.04);
  ctx.fillStyle = INK;
  ctx.fillText(text, -w / 2 + 22 + size * 1.2, 2);
  ctx.restore();
}

// Sequential words that pop in one by one on a single card.
export function sequence(ctx, parts, { cx = 540, cy = 360, size = 62, t, t1 }) {
  const t0 = parts[0].at;
  if (t < t0 || t > t1 + 0.2) return;
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const ws = parts.map((p) => ctx.measureText(p.t).width);
  const total = ws.reduce((a, b) => a + b, 0);
  const pad = 40, w = total + pad * 2, h = size * 1.22 + pad * 1.35;
  const kout = 1 - easeOut(seg(t, t1, t1 + 0.18));
  const kin = easeOutBack(seg(t, t0, t0 + 0.3));
  ctx.globalAlpha = kout * clamp(seg(t, t0, t0 + 0.12));
  ctx.translate(cx, cy + (1 - kin) * 24);
  ctx.shadowColor = 'rgba(110,85,40,0.16)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, -w / 2, -h / 2, w, h, 40);
  ctx.fillStyle = 'rgba(255,251,242,0.94)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  let x = -total / 2;
  parts.forEach((p, i) => {
    const k = easeOutBack(seg(t, p.at, p.at + 0.28));
    if (k > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(seg(t, p.at, p.at + 0.1));
      ctx.translate(x + ws[i] / 2, 4 + (1 - k) * 16);
      ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
      ctx.fillStyle = p.color || INK;
      ctx.textAlign = 'center';
      ctx.fillText(p.t, 0, 0);
      ctx.restore();
    }
    x += ws[i];
  });
  ctx.restore();
}

// Final CTA button.
export function button(ctx, text, { cx = 540, cy = 1400, t, t0 }) {
  if (t < t0) return;
  const k = easeOutBack(seg(t, t0, t0 + 0.35));
  const pulse = 1 + 0.025 * Math.sin((t - t0) * Math.PI * 2 * 1.1) * clamp(seg(t, t0 + 0.4, t0 + 0.6));
  const size = 50;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width + size * 1.15;
  const w = tw + 110, h = 116;
  ctx.globalAlpha = clamp(seg(t, t0, t0 + 0.12));
  ctx.translate(cx, cy);
  ctx.scale(k * pulse, k * pulse);
  ctx.shadowColor = 'rgba(120,70,40,0.28)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  gr.addColorStop(0, '#d98261');
  gr.addColorStop(1, '#c66e4d');
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // soft highlight
  roundRect(ctx, -w / 2 + 10, -h / 2 + 7, w - 20, h * 0.42, h * 0.3);
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.fillText(text, -tw / 2, 3);
  ctx.drawImage(EMOJI['1f331'], tw / 2 - size * 1.02, -size * 0.52, size * 1.02, size * 1.02);
  ctx.restore();
}

export function plainText(ctx, text, { cx, cy, size, weight = 600, color = INK, t, t0, stroke }) {
  if (t < t0) return;
  const k = easeOutBack(seg(t, t0, t0 + 0.3));
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.globalAlpha = clamp(seg(t, t0, t0 + 0.12));
  ctx.translate(cx, cy + (1 - k) * 18);
  ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  if (stroke) {
    ctx.lineWidth = stroke;
    ctx.strokeStyle = 'rgba(255,251,242,0.95)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Reels-style caption: bold white words with a dark outline, popping in one by one.
// words: array of strings / {t, color} / {emoji}
const OUTLINE = '#3b1d12';
export const HILITE = '#ffd23f';
export function reel(ctx, words, { cx = 540, cy = 380, size = 76, maxW = 860, t, t0, t1, stagger = 0.075 }) {
  if (t < t0 || t > t1 + 0.2) return;
  const out = 1 - easeOut(seg(t, t1, t1 + 0.16));
  if (out <= 0) return;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const items = [];
  for (const w of words) {
    if (typeof w === 'string') w.split(/\s+/).filter(Boolean).forEach((x) => items.push({ t: x }));
    else items.push({ ...w });
  }
  const space = ctx.measureText(' ').width + size * 0.2;
  items.forEach((it) => (it.w = it.emoji ? size * 1.05 : ctx.measureText(it.t).width));
  const lines = [[]];
  let lw = 0;
  for (const it of items) {
    if (lw + it.w > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
    lines[lines.length - 1].push(it);
    lw += it.w + space;
  }
  const lh = size * 1.18;
  let idx = 0;
  lines.forEach((line, li) => {
    const total = line.reduce((a, b) => a + b.w, 0) + space * (line.length - 1);
    let x = cx - total / 2;
    const y = cy + (li - (lines.length - 1) / 2) * lh;
    for (const it of line) {
      const ta = t0 + idx * stagger;
      idx++;
      const k = seg(t, ta, ta + 0.22);
      if (k > 0) {
        const sc = k < 1 ? 0.55 + 0.45 * easeOutBack(k) + 0.12 * Math.sin(k * Math.PI) : 1;
        ctx.save();
        ctx.globalAlpha = clamp(k * 3) * out;
        ctx.translate(x + it.w / 2, y + (1 - easeOut(k)) * 20);
        ctx.scale(sc, sc);
        if (it.emoji) {
          ctx.drawImage(EMOJI[it.emoji], -size * 0.5, -size * 0.52, size * 1.02, size * 1.02);
        } else {
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(60,25,10,0.35)';
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 8;
          ctx.lineJoin = 'round';
          ctx.lineWidth = size * 0.2;
          ctx.strokeStyle = OUTLINE;
          ctx.strokeText(it.t, 0, 0);
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = it.color || '#ffffff';
          ctx.fillText(it.t, 0, 0);
        }
        ctx.restore();
      }
      x += it.w + space;
    }
  });
  ctx.restore();
}

// Sparkle burst (✨) at a screen point.
export function sparkle(ctx, { x, y, t, t0, size = 70 }) {
  const u = seg(t, t0, t0 + 0.55);
  if (u <= 0 || u >= 1) return;
  ctx.save();
  ctx.globalAlpha = Math.sin(u * Math.PI);
  ctx.translate(x, y - u * 40);
  const s = size * (0.5 + 0.7 * easeOutBack(Math.min(1, u * 2)));
  ctx.rotate((u - 0.5) * 0.6);
  ctx.drawImage(EMOJI['2728'], -s / 2, -s / 2, s, s);
  ctx.restore();
}

// Small "dia N" counter chip for the time-lapse.
export function dayChip(ctx, day, { cx = 540, cy = 250, t, t0, t1 }) {
  if (t < t0 || t > t1 + 0.15) return;
  const k = easeOutBack(seg(t, t0, t0 + 0.25));
  const a = clamp(seg(t, t0, t0 + 0.1)) * (1 - easeOut(seg(t, t1, t1 + 0.15)));
  const size = 46;
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const txt = `dia ${day}`;
  const tw = ctx.measureText(txt).width;
  const w = tw + size * 1.2 + 60, h = size + 34;
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.shadowColor = 'rgba(60,25,10,0.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = '#e8574f';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.drawImage(EMOJI['1f4c5'], -w / 2 + 22, -size * 0.52, size * 1.02, size * 1.02);
  ctx.fillStyle = '#fffaf0';
  ctx.fillText(txt, -w / 2 + 34 + size * 1.05, 3);
  ctx.restore();
}

export { INK, ACCENT, roundRect, FONT };

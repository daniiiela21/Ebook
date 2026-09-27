// Renders frames of the Reel with headless Chromium and pipes them to ffmpeg.
// Usage:
//   node render.mjs frames <variant> <frame,frame,...> <outDir>   → PNG stills
//   node render.mjs video <variant> <out.mp4> [from] [to]          → silent H.264
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/src/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

export function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  return 'ffmpeg';
}

async function main() {
  const [mode, variant = 'base', a, b, c] = process.argv.slice(2);
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/src/index.html`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => typeof window.renderFrame === 'function');
  const info = await page.evaluate(() => window.info());
  if (info.coverIsPlaceholder) console.error('!! assets/capa.png not found – rendering a placeholder cover');

  if (mode === 'frames') {
    const frames = a.split(',').map(Number);
    fs.mkdirSync(b, { recursive: true });
    for (const f of frames) {
      const t0 = Date.now();
      const data = await page.evaluate(([f, v]) => window.renderFrame(f, v, 'image/jpeg'), [f, variant]);
      fs.writeFileSync(path.join(b, `${variant}_${String(f).padStart(3, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
      console.log('frame', f, Date.now() - t0, 'ms');
    }
  } else if (mode === 'video') {
    const outFile = a;
    const from = Number(b ?? 0), to = Number(c ?? info.FPS * info.DUR);
    const ff = spawn(ffmpegPath(), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(info.FPS), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = from; f < to; f++) {
      const data = await page.evaluate(([f, v]) => window.renderFrame(f, v, 'image/png'), [f, variant]);
      const buf = Buffer.from(data.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % 30 === 0) console.log(`${variant} frame ${f}/${to} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
  }
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });

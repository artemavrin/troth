import { init, compute, storage, draw, target, frame } from "vgpu/node";
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const N = 512, CELLS = N * N, BYTES = CELLS * 4, RES = 1024;

// ── рельеф: долинный остров с северным хребтом (§11 «северный хребет») ──
let seed = 7717 >>> 0;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const lattice = (size) => { const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rnd(); return g; };
const smooth = (t) => t * t * (3 - 2 * t);
function value(g, size, x, y) {
  const fx = x * size, fy = y * size;
  const x0 = Math.floor(fx) % size, y0 = Math.floor(fy) % size;
  const x1 = (x0 + 1) % size, y1 = (y0 + 1) % size;
  const sx = smooth(fx - Math.floor(fx)), sy = smooth(fy - Math.floor(fy));
  const a = g[y0*size+x0], b = g[y0*size+x1], c = g[y1*size+x0], d = g[y1*size+x1];
  return (a*(1-sx)+b*sx)*(1-sy) + (c*(1-sx)+d*sx)*sy;
}
const octaves = [4, 8, 16, 32, 64].map((s) => ({ s, g: lattice(s) }));
const height = new Float32Array(CELLS);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const u = x / N, v = y / N;
  let h = 0, amp = 0.5, norm = 0;
  for (const { s, g } of octaves) { h += amp * value(g, s, u, v); norm += amp; amp *= 0.5; }
  h /= norm;
  const ridge = Math.exp(-Math.pow((v - 0.23) / 0.13, 2)) * 0.46;   // северный хребет
  const dx = u - 0.5, dy = v - 0.52;
  const island = 1.0 - Math.min(1, Math.sqrt(dx*dx*1.15 + dy*dy*1.5) / 0.53);
  height[y*N+x] = Math.max(0, Math.min(1, (h * 0.72 + ridge) * (0.35 + 0.95 * smooth(Math.max(0, island)))));
}

// ── вброс шептания: «под северным хребтом что-то спит», у кузен Ember ──
const belief0 = new Float32Array(CELLS);
const sx = Math.round(N * 0.42), sy = Math.round(N * 0.34);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const d = Math.hypot(x - sx, y - sy);
  if (d < 26) belief0[y*N+x] = 0.91 * Math.exp(-(d*d) / 260);  // вера Ember 91% из §5
}

const gpu = await init();
const sim  = compute(gpu, readFileSync("./world.wgsl", "utf8"), { entryPoint: "step" });
const hBuf = storage(gpu, BYTES, "read");
const b0   = storage(gpu, BYTES, "read_write");
const b1   = storage(gpu, BYTES, "read_write");
const cfg  = storage(gpu, 16, "read");
hBuf.write(height); b0.write(belief0); b1.write(belief0);

const mapDraw = draw(gpu, { shader: readFileSync("./map.wgsl", "utf8"), vertices: 3 });
const tgt = target(gpu, { size: [RES, RES], format: "rgba8unorm" });

async function shot(showBelief, src) {
  cfg.write(new Float32Array([showBelief ? 1 : 0, 0, 0, 0]));
  mapDraw.set({ height: hBuf, belief: src, cfg });
  frame(gpu, (f) => f.pass(tgt, mapDraw));
  const px = await tgt.color.read({ mipLevel: 0, region: "all" });
  return Buffer.from(px);
}

const HOURS_PER_DAY = 24;
const panels = [];
panels.push({ title: "мир · 47 A.S.", sub: "северный хребет, жила наполовину выбрана",
              px: await shot(false, b0) });

let cur = b0, nxt = b1;
let loreDay = null, t60 = null;
const marks = new Map([[4, "сут. 4 · Ember шлёт паломников"],
                       [31, "сут. 31 · Ford начинает торг"],
                       [91, "сут. 91 · первая дрожь — ожидание сбылось"]]);
let day = 0;
for (let step = 1; step <= 91 * HOURS_PER_DAY; step++) {
  sim.set({ height: hBuf, srcB: cur, dstB: nxt });
  sim.dispatch(N / 8, N / 8);
  [cur, nxt] = [nxt, cur];
  if (step % HOURS_PER_DAY === 0) {
    day++;
    if (loreDay === null || t60 === null) {
      const chk = new Float32Array(await cur.read());
      let mx = 0; for (let q = 0; q < chk.length; q++) if (chk[q] > mx) mx = chk[q];
      if (t60 === null && mx >= 0.60) t60 = day;
      if (loreDay === null && mx >= 0.95) loreDay = day;
    }
    if (marks.has(day)) {
      const chk = new Float32Array(await cur.read());
      let mx = 0, above = 0;
      for (let q = 0; q < chk.length; q++) { if (chk[q] > mx) mx = chk[q]; if (chk[q] > 0.6) above++; }
      console.log(`  сут.${String(day).padStart(3)}  максимум веры ${mx.toFixed(3)}  ` +
                  `ячеек выше 60%: ${above} (${(100*above/CELLS).toFixed(2)}% мира)`);
      panels.push({ title: marks.get(day).split(" · ")[0],
                    sub: marks.get(day).split(" · ")[1], px: await shot(true, cur) });
    }
  }
}
gpu.dispose();

// ── склейка 2×2 ──
const GAP = 14, W = RES * 2 + GAP * 3, H = RES * 2 + GAP * 3;
const out = new PNG({ width: W, height: H });
out.data.fill(0x0d);
for (let a = 0; a < out.data.length; a += 4) {
  out.data[a] = 0x0d; out.data[a+1] = 0x0f; out.data[a+2] = 0x12; out.data[a+3] = 255;
}
panels.forEach((p, k) => {
  const ox = GAP + (k % 2) * (RES + GAP), oy = GAP + Math.floor(k / 2) * (RES + GAP);
  for (let y = 0; y < RES; y++) {
    const s = y * RES * 4, d = ((oy + y) * W + ox) * 4;
    p.px.copy(out.data, d, s, s + RES * 4);
  }
});
writeFileSync("troth-map.png", PNG.sync.write(out));
panels.forEach((p, k) => {
  const one = new PNG({ width: RES, height: RES });
  p.px.copy(one.data, 0, 0, RES * RES * 4);
  writeFileSync(`panel${k}.png`, PNG.sync.write(one));
});
writeFileSync("marks.json", JSON.stringify({ t60, loreDay }, null, 2));
console.log(`\n  вера перешла 60% (локальные эффекты) на сут. ${t60}`);
console.log(`  вера перешла 95% и стала LORE на сут. ${loreDay}`);
console.log(`  срок ожидания по §11 — сут. 91`);
console.log(loreDay !== null && loreDay < 91
  ? `  ⇒ шептание стало lore за ${91 - loreDay} суток ДО проверки ожидания. Это B'.`
  : "  ⇒ гейт ожидания успел сработать.");
console.log("панелей:", panels.length, "→ troth-map.png", W + "x" + H);
console.log(panels.map((p) => `  ${p.title} — ${p.sub}`).join("\n"));

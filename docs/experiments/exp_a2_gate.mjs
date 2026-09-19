import { init, compute, storage } from "vgpu/node";
import { readFileSync } from "node:fs";

const N = 128, CELLS = N * N, BYTES = CELLS * 4;
const src = readFileSync("./diffuse_gate.wgsl", "utf8");
const gpu = await init();
const pipe = compute(gpu, src);

// одно и то же начальное поле для обоих порядков — до бита
let seed = 12345 >>> 0;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const field = new Float32Array(CELLS);
for (let i = 0; i < CELLS; i++) field[i] = 0.08 + rnd() * 0.30;  // вокруг порога 0.6

const bufs = {
  a0: storage(gpu, BYTES, "read"),  b0: storage(gpu, BYTES, "read"),
  a1: storage(gpu, BYTES, "read_write"), b1: storage(gpu, BYTES, "read_write"),
  evt: storage(gpu, BYTES, "read_write"),
};
bufs.a0.write(field); bufs.b0.write(field);
bufs.a1.write(field); bufs.b1.write(field);

const STEPS = 3000;
let firstBitDiff = -1, firstEventDiff = -1;
const trace = [];

for (let s = 0; s < STEPS; s++) {
  const even = s % 2 === 0;
  pipe.set({
    srcA: even ? bufs.a0 : bufs.a1, srcB: even ? bufs.b0 : bufs.b1,
    dstA: even ? bufs.a1 : bufs.a0, dstB: even ? bufs.b1 : bufs.b0,
    evt: bufs.evt,
  });
  pipe.dispatch(N / 8, N / 8);

  const [ra, rb, re] = await Promise.all([
    (even ? bufs.a1 : bufs.a0).read(),
    (even ? bufs.b1 : bufs.b0).read(),
    bufs.evt.read(),
  ]);
  const fa = new Float32Array(ra), fb = new Float32Array(rb);
  const ev = new Uint32Array(re);

  let bitDiff = 0, maxAbs = 0;
  for (let i = 0; i < CELLS; i++) {
    if (fa[i] !== fb[i]) { bitDiff++; const d = Math.abs(fa[i] - fb[i]); if (d > maxAbs) maxAbs = d; }
  }
  let evDiff = 0;
  for (let i = 0; i < CELLS; i++) evDiff += ev[i];

  if (bitDiff > 0 && firstBitDiff < 0) firstBitDiff = s + 1;
  if (evDiff > 0 && firstEventDiff < 0) firstEventDiff = s + 1;
  if (s < 5 || (s + 1) % 250 === 0 || (evDiff > 0 && firstEventDiff === s + 1)) {
    trace.push({ step: s + 1, bitDiff, pct: (100 * bitDiff / CELLS), maxAbs, evDiff });
  }
  if (firstEventDiff > 0 && s + 1 >= firstEventDiff + 200) break;
}

console.log("=".repeat(76));
console.log("ЭКСПЕРИМЕНТ A2 — то же, но с гейтом самораспространения §6 (разрывным)");
console.log("=".repeat(76));
console.log("сетка 128×128, шаг диффузии §3.6, порог 0.6 = §6 «локальные эффекты»");
console.log("поля A и B стартуют побитово одинаковыми; отличается только порядок суммы\n");
console.log(" шаг | ячеек разошлось | доля поля | макс. расхождение | разных событий");
console.log("-".repeat(76));
for (const t of trace) {
  console.log(
    `${String(t.step).padStart(4)} | ${String(t.bitDiff).padStart(15)} | ` +
    `${t.pct.toFixed(2).padStart(8)}% | ${t.maxAbs.toExponential(3).padStart(17)} | ` +
    `${String(t.evDiff).padStart(14)}`
  );
}
console.log();
console.log(`первое побитовое расхождение: шаг ${firstBitDiff}`);
console.log(`первое РАЗНОЕ СОБЫТИЕ:        шаг ${firstEventDiff > 0 ? firstEventDiff : "не наступило за " + STEPS}`);
if (firstEventDiff > 0) {
  const worldHours = firstEventDiff, worldDays = (worldHours / 24).toFixed(1);
  console.log(`  = ${worldHours} шагов физики = ${worldDays} мировых суток = ` +
              `${(worldHours * 25 / 60).toFixed(0)} реальных минут`);
}
gpu.dispose();

import { init, compute, storage } from "vgpu/node";
import { readFileSync } from "node:fs";
const NPTS = 4096, BYTES = NPTS * 4;
const gpu = await init();
const pipe = compute(gpu, readFileSync("./trans.wgsl", "utf8"));
const xs = new Float32Array(NPTS);
for (let i = 0; i < NPTS; i++) xs[i] = (i + 1) / NPTS * 8.0;
const bi = storage(gpu, BYTES, "read"), bo = storage(gpu, BYTES, "read_write");
bi.write(xs);
pipe.set({ inp: bi, outp: bo });
pipe.dispatch(Math.ceil(NPTS / 64));
const got = new Float32Array(await bo.read());
gpu.dispose();

let maxUlp = 0, maxRel = 0, nDiff = 0;
const tmp = new Float32Array(1), dv = new DataView(tmp.buffer);
const bits = (f) => { tmp[0] = f; return dv.getInt32(0, true); };
for (let i = 0; i < NPTS; i++) {
  const x = xs[i];
  const ref = Math.fround(Math.exp(-x) * Math.pow(x + 1.0, 0.75));  // CPU, двойная точность → f32
  if (got[i] !== ref) {
    nDiff++;
    const u = Math.abs(bits(got[i]) - bits(ref)); if (u > maxUlp) maxUlp = u;
    const r = Math.abs(got[i] - ref) / Math.max(Math.abs(ref), 1e-30); if (r > maxRel) maxRel = r;
  }
}
console.log("=".repeat(72));
console.log("ЭКСПЕРИМЕНТ A4 — насколько GPU-трансценденты расходятся с эталоном CPU");
console.log("=".repeat(72));
console.log("функция exp(-x)·pow(x+1, 0.75) — затухание §6 и эффекты веры §3.8");
console.log(`точек: ${NPTS}, разошлось: ${nDiff} (${(100*nDiff/NPTS).toFixed(1)}%)`);
console.log(`максимум: ${maxUlp} ULP, относительная ошибка ${maxRel.toExponential(2)}`);
console.log();
console.log(`Для сравнения — расхождение от порядка суммирования (A2): ~2.4e-7`);
console.log(`Трансцендентные функции дают ${(maxRel/2.4e-7).toFixed(0)}× больше.`);
console.log();
console.log("Спецификация WGSL допускает несколько ULP на exp/pow, и допуск у каждой");
console.log("реализации свой. Это и есть главный источник межвендорного расхождения —");
console.log("не сложение, а библиотека функций.");

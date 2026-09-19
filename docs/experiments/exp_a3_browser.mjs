// Кросс-бэкендный тест: один и тот же WGSL на Dawn/llvmpipe (Node) и в Chromium (WebGPU).
import { init, compute, storage } from "vgpu/node";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const N = 128, CELLS = N * N, BYTES = CELLS * 4;
const shader = readFileSync("./diffuse.wgsl", "utf8");

// одно и то же начальное поле, побитово
let seed = 12345 >>> 0;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const field = new Float32Array(CELLS);
for (let i = 0; i < CELLS; i++) field[i] = 0.45 + rnd() * 0.35;

const STEPS = 200;

// ---------- сторона Dawn ----------
const gpu = await init();
const pipe = compute(gpu, shader);
const b = { a0: storage(gpu, BYTES, "read"), b0: storage(gpu, BYTES, "read"),
            a1: storage(gpu, BYTES, "read_write"), b1: storage(gpu, BYTES, "read_write"),
            evt: storage(gpu, BYTES, "read_write") };
for (const k of ["a0","b0","a1","b1"]) b[k].write(field);
for (let s = 0; s < STEPS; s++) {
  const even = s % 2 === 0;
  pipe.set({ srcA: even?b.a0:b.a1, srcB: even?b.b0:b.b1,
             dstA: even?b.a1:b.a0, dstB: even?b.b1:b.b0, evt: b.evt });
  pipe.dispatch(N/8, N/8);
}
const dawnOut = new Float32Array(await (STEPS % 2 === 0 ? b.a0 : b.a1).read());
gpu.dispose();
console.log("Dawn/llvmpipe: посчитано", STEPS, "шагов");

// ---------- сторона Chromium ----------
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader",
         "--enable-features=Vulkan", "--no-sandbox"],
});
const page = await browser.newPage();
const res = await page.evaluate(async ({ shader, N, STEPS, fieldArr }) => {
  if (!navigator.gpu) return { err: "navigator.gpu отсутствует" };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { err: "адаптер WebGPU недоступен" };
  const dev = await adapter.requestDevice();
  const info = adapter.info ? { vendor: adapter.info.vendor, arch: adapter.info.architecture,
                                desc: adapter.info.description } : null;
  const CELLS = N*N, BYTES = CELLS*4;
  const field = new Float32Array(fieldArr);
  const mk = (usage) => dev.createBuffer({ size: BYTES, usage });
  const ST = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
  const bufs = { a0: mk(ST), b0: mk(ST), a1: mk(ST), b1: mk(ST), evt: mk(ST) };
  for (const k of ["a0","b0","a1","b1"]) dev.queue.writeBuffer(bufs[k], 0, field);
  const mod = dev.createShaderModule({ code: shader });
  const pipeline = dev.createComputePipeline({ layout: "auto", compute: { module: mod, entryPoint: "main" } });
  const bg = (sA,sB,dA,dB) => dev.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    {binding:0,resource:{buffer:sA}},{binding:1,resource:{buffer:sB}},
    {binding:2,resource:{buffer:dA}},{binding:3,resource:{buffer:dB}},
    {binding:4,resource:{buffer:bufs.evt}}]});
  for (let s = 0; s < STEPS; s++) {
    const even = s % 2 === 0;
    const enc = dev.createCommandEncoder();
    const p = enc.beginComputePass();
    p.setPipeline(pipeline);
    p.setBindGroup(0, bg(even?bufs.a0:bufs.a1, even?bufs.b0:bufs.b1,
                         even?bufs.a1:bufs.a0, even?bufs.b1:bufs.b0));
    p.dispatchWorkgroups(N/8, N/8);
    p.end();
    dev.queue.submit([enc.finish()]);
  }
  const src = STEPS % 2 === 0 ? bufs.a0 : bufs.a1;
  const rb = dev.createBuffer({ size: BYTES, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const enc = dev.createCommandEncoder();
  enc.copyBufferToBuffer(src, 0, rb, 0, BYTES);
  dev.queue.submit([enc.finish()]);
  await rb.mapAsync(GPUMapMode.READ);
  const out = Array.from(new Float32Array(rb.getMappedRange().slice(0)));
  rb.unmap();
  return { out, info };
}, { shader, N, STEPS, fieldArr: Array.from(field) });
await browser.close();

if (res.err) { console.log("Chromium WebGPU:", res.err); process.exit(0); }
console.log("Chromium WebGPU:", JSON.stringify(res.info));
const chromeOut = new Float32Array(res.out);

let diff = 0, maxAbs = 0, maxUlp = 0;
const va = new DataView(dawnOut.buffer), vb = new DataView(chromeOut.buffer);
for (let i = 0; i < CELLS; i++) {
  if (dawnOut[i] !== chromeOut[i]) {
    diff++;
    const d = Math.abs(dawnOut[i] - chromeOut[i]); if (d > maxAbs) maxAbs = d;
    const u = Math.abs(va.getInt32(i*4, true) - vb.getInt32(i*4, true)); if (u > maxUlp) maxUlp = u;
  }
}
console.log("\n" + "=".repeat(72));
console.log("ЭКСПЕРИМЕНТ A3 — Dawn/llvmpipe против Chromium/WebGPU, один WGSL");
console.log("=".repeat(72));
console.log(`шагов: ${STEPS}, ячеек: ${CELLS}`);
console.log(`ячеек разошлось побитово: ${diff} (${(100*diff/CELLS).toFixed(2)}%)`);
console.log(`максимальное расхождение: ${maxAbs.toExponential(3)}  (${maxUlp} ULP)`);
console.log(diff === 0
  ? "\nВЫВОД: две реализации совпали побитово на этой нагрузке."
  : "\nВЫВОД: две реализации НЕ совпадают побитово — пересчёт мира на другом бэкенде даёт другое поле.");

// Шаг 6 физики (§3): диффузия поля веры. Шаг 9: порог -> событие.
// Поля A и B считают ОДНО И ТО ЖЕ, отличаясь только порядком сложения соседей.
// В вещественной арифметике результаты тождественны. В IEEE-754 — нет.

@group(0) @binding(0) var<storage, read>       srcA : array<f32>;
@group(0) @binding(1) var<storage, read>       srcB : array<f32>;
@group(0) @binding(2) var<storage, read_write> dstA : array<f32>;
@group(0) @binding(3) var<storage, read_write> dstB : array<f32>;
@group(0) @binding(4) var<storage, read_write> evt  : array<u32>;

const N : u32 = 128u;
const KEEP : f32 = 0.20;
const SPREAD : f32 = 0.20;
const THRESHOLD : f32 = 0.60;
const FLOOR : f32 = 0.20;   // §6: ниже 20% слух сам не расходится
const GAIN : f32 = 0.00005; // усиление за шаг

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x >= N || y >= N) { return; }
  let i = y * N + x;
  let xm = (x + N - 1u) % N; let xp = (x + 1u) % N;
  let ym = (y + N - 1u) % N; let yp = (y + 1u) % N;

  // порядок A: последовательно, слева направо
  let al = srcA[y*N + xm]; let ar = srcA[y*N + xp];
  let au = srcA[ym*N + x]; let ad = srcA[yp*N + x];
  let a  = (((al + ar) + au) + ad) * SPREAD + srcA[i] * KEEP;

  // порядок B: попарно — то же самое, другой порядок
  let bl = srcB[y*N + xm]; let br = srcB[y*N + xp];
  let bu = srcB[ym*N + x]; let bd = srcB[yp*N + x];
  let b  = ((bl + bu) + (br + bd)) * SPREAD + srcB[i] * KEEP;

  // §6: гейт самораспространения — РАЗРЫВНАЯ функция
  let a2 = select(a, a * (1.0 + GAIN), a > FLOOR);
  let b2 = select(b, b * (1.0 + GAIN), b > FLOOR);
  dstA[i] = a2;
  dstB[i] = b2;

  // шаг 9: порог превращает разницу в последнем бите в разное СОБЫТИЕ
  let ea = select(0u, 1u, a2 > THRESHOLD);
  let eb = select(0u, 1u, b2 > THRESHOLD);
  evt[i] = select(0u, 1u, ea != eb);
}

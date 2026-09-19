// TROTH · §3 шаг 6 (диффузия слухов) + §6 самораспространение выше порога 20%.
// Слух не сохраняющаяся величина: это фронт реакции-диффузии, а не размазывание.

@group(0) @binding(0) var<storage, read>       height : array<f32>;
@group(0) @binding(1) var<storage, read>       srcB   : array<f32>;
@group(0) @binding(2) var<storage, read_write> dstB   : array<f32>;

const N : u32 = 512u;
const FLOOR  : f32 = 0.20;    // §6: ниже 20% слух сам не расходится
const D      : f32 = 0.25;    // диффузия
const R      : f32 = 0.006;   // логистический рост

@compute @workgroup_size(8, 8)
fn step(@builtin(global_invocation_id) gid : vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x >= N || y >= N) { return; }
  let i = y * N + x;
  let xm = max(x, 1u) - 1u; let xp = min(x + 1u, N - 1u);
  let ym = max(y, 1u) - 1u; let yp = min(y + 1u, N - 1u);

  let h = height[i];
  let c = srcB[i];
  let lap = srcB[y*N+xm] + srcB[y*N+xp] + srcB[ym*N+x] + srcB[yp*N+x] - 4.0 * c;

  // хребет держит молву: через перевал слух идёт хуже
  let pass_ = 1.0 - 0.85 * smoothstep(0.60, 0.88, h);
  // над водой слуху некому ходить
  let land = smoothstep(0.28, 0.34, h);

  var b = c + D * lap * pass_ * land;
  if (b > FLOOR) { b = b + R * b * (1.0 - b); }   // §6: сам расходится
  dstB[i] = clamp(b * land, 0.0, 1.0);
}

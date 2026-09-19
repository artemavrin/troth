@group(0) @binding(0) var<storage, read>       inp : array<f32>;
@group(0) @binding(1) var<storage, read_write> outp: array<f32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&inp)) { return; }
  let x = inp[i];
  // затухание веры (§6) и эффекты веры (§3 шаг 8) — ровно эти функции
  outp[i] = exp(-x) * pow(x + 1.0, 0.75);
}

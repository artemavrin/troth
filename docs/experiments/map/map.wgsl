@group(0) @binding(0) var<storage, read> height : array<f32>;
@group(0) @binding(1) var<storage, read> belief : array<f32>;
@group(0) @binding(2) var<storage, read> cfg    : array<f32>;   // [showBelief, day, _, _]

const N : u32 = 512u;
const RES : f32 = 1024.0;

fn at(x : i32, y : i32) -> f32 {
  let cx = u32(clamp(x, 0, i32(N) - 1));
  let cy = u32(clamp(y, 0, i32(N) - 1));
  return height[cy * N + cx];
}

@vertex
fn vs(@builtin(vertex_index) i : u32) -> @builtin(position) vec4<f32> {
  var p = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  return vec4<f32>(p[i], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) fc : vec4<f32>) -> @location(0) vec4<f32> {
  let gx = i32(fc.x / RES * f32(N));
  let gy = i32(fc.y / RES * f32(N));
  let i  = u32(clamp(gy, 0, i32(N)-1)) * N + u32(clamp(gx, 0, i32(N)-1));
  let h  = height[i];

  // отмывка рельефа: свет с северо-запада
  let dx = at(gx+1, gy) - at(gx-1, gy);
  let dy = at(gx, gy+1) - at(gx, gy-1);
  let nrm = normalize(vec3<f32>(-dx * 12.0, -dy * 12.0, 1.0));
  let lit = clamp(dot(nrm, normalize(vec3<f32>(-0.6, -0.7, 0.55))), 0.0, 1.0);

  var col : vec3<f32>;
  if (h < 0.30) {
    // вода
    let d = smoothstep(0.30, 0.08, h);
    col = mix(vec3<f32>(0.10, 0.17, 0.26), vec3<f32>(0.04, 0.07, 0.13), d);
  } else {
    let low  = vec3<f32>(0.22, 0.25, 0.18);   // низины, хлеб
    let mid  = vec3<f32>(0.34, 0.31, 0.23);   // предгорья
    let high = vec3<f32>(0.52, 0.50, 0.47);   // хребет
    let t = smoothstep(0.30, 0.66, h);
    let u = smoothstep(0.62, 0.92, h);
    col = mix(mix(low, mid, t), high, u);
    col = col * (0.45 + 0.75 * lit);
    // снег на гребне
    col = mix(col, vec3<f32>(0.82, 0.83, 0.86), smoothstep(0.88, 0.96, h) * 0.8);
  }

  if (cfg[0] > 0.5) {
    let b = belief[i];
    // §6, лестница порогов: 20 расходится, 40 меняет поведение,
    // 60 локальные эффекты, 80 устойчивое чудо, 95 -> lore
    let ember = vec3<f32>(0.85, 0.36, 0.16);
    let hot   = vec3<f32>(1.00, 0.78, 0.35);
    var glow = mix(ember, hot, smoothstep(0.55, 0.95, b));
    col = mix(col, glow, clamp(b, 0.0, 1.0) * 0.72);

    // контуры порогов — где вера становится физикой
    for (var k = 0; k < 4; k = k + 1) {
      let lvl = array<f32, 4>(0.20, 0.40, 0.60, 0.80)[k];
      let d = abs(b - lvl);
      if (d < 0.008) {
        col = mix(col, vec3<f32>(1.0, 0.95, 0.85), 0.55 - f32(k) * 0.07);
      }
    }
  }

  // виньетка
  let uv = fc.xy / RES - 0.5;
  col = col * (1.0 - 0.55 * dot(uv, uv));
  return vec4<f32>(pow(col, vec3<f32>(0.85)), 1.0);
}

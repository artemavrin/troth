/**
 * TROTH · проверка несущих гипотез §5 живыми вызовами Jev.
 *
 *   node probe.mjs axes     # двухосность вес/натяг — ГЛАВНАЯ гипотеза
 *   node probe.mjs det      # детерминизм котировки (пункт D разбора)
 *   node probe.mjs kin      # различает ли модель роды
 *   node probe.mjs all
 *
 * Нужен AI_GATEWAY_API_KEY в окружении. Стоимость всего прогона — центы.
 */
import { experimental_evaluate as evaluate } from "ai";

const MODEL = "typesafe-ai/jev";

// уровни ровно из §5 архитектуры
const VES = ["шёпот", "молва", "знак", "знамение", "кара", "перелом"];
const NATYAG = ["подтверждает известное", "правдоподобно", "неожиданно",
                "противоречит виденному", "против общего знания"];
const OHVAT = ["двор", "поселение", "род", "область", "весь мир"];

const KINS = {
  Ember: "горный род, держит кузни; в Keeping — «под камнем живёт то, что старше нас»",
  Ford:  "речной род, торговля бродами; в Keeping — «верь тому, что можно измерить»",
  Root:  "земледельцы; в Keeping — «год покажет»",
  Flint: "воины предгорий; в Keeping — «знамения выдумывают слабые»",
};

const world = {
  область: "северный хребет",
  рельеф: "горы, крутые склоны, один перевал",
  жила: { железо: "богатая, наполовину выбрана", глубина: "растёт" },
  год: 47, срок: "осень",
  роды: KINS,
  живые_убеждения: [
    { claim: "перевал закрывается раньше срока", вера: { Ember: 0.6, Ford: 0.55 } },
  ],
};

const questions = (claim) => ({
  вес: {
    type: "score",
    instructions: `Насколько сильно это утверждение двигает мир, если в него поверят: ${claim}`,
    criteria: VES,
  },
  натяг: {
    type: "score",
    instructions: `Насколько это идёт против того, что сейчас известно и во что верят: ${claim}`,
    criteria: NATYAG,
  },
  охват: {
    type: "score",
    instructions: `До кого это дойдёт: ${claim}`,
    criteria: OHVAT,
  },
  ...Object.fromEntries(Object.keys(KINS).map((k) => [`верит_${k}`, {
    type: "boolean",
    instructions: `Поверит ли род ${k} в утверждение: ${claim}`,
  }])),
});

const ask = (claim) => evaluate({ model: MODEL, state: world, questions: questions(claim) });

// уровень как доля шкалы [0,1], чтобы оси были сравнимы
const norm = (a, levels) => a.score / (levels.length - 1);

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return num / Math.sqrt(dx * dy || 1e-12);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. ДВУХОСНОСТЬ. §5 ставит на то, что вес и натяг независимы:
//    «метеорит тяжёл, но в него легко поверить; интрига легка, но против течения».
//    Набор подобран так, чтобы покрыть все четыре угла.
// ─────────────────────────────────────────────────────────────────────────
const CASES = [
  ["тяжёлый / очевидный",   "с неба упал огненный камень и расколол северный склон"],
  ["тяжёлый / очевидный",   "перевал завалило обвалом, прохода нет"],
  ["лёгкий / против",       "старший Ford тайно обещал перевал роду Flint"],
  ["лёгкий / против",       "кузнец Ember подменяет железо на худшее"],
  ["тяжёлый / против",      "под хребтом спит дракон и скоро проснётся"],
  ["тяжёлый / против",      "жила иссякнет до конца года"],
  ["лёгкий / очевидный",    "в этом году осень пришла раньше"],
  ["лёгкий / очевидный",    "на перевале стало холоднее"],
];

async function axes() {
  console.log("=".repeat(76));
  console.log("1 · ДВУХОСНОСТЬ вес/натяг — несущая гипотеза §5");
  console.log("=".repeat(76));
  console.log(`${"ожидали".padEnd(22)} ${"вес".padEnd(12)} ${"натяг".padEnd(24)} утверждение`);
  console.log("-".repeat(76));
  const vs = [], ns = [];
  for (const [expect, claim] of CASES) {
    const r = await ask(claim);
    const v = norm(r.answers.вес, VES), n = norm(r.answers.натяг, NATYAG);
    vs.push(v); ns.push(n);
    console.log(
      `${expect.padEnd(22)} ${VES[Math.round(r.answers.вес.score)].padEnd(12)} ` +
      `${NATYAG[Math.round(r.answers.натяг.score)].padEnd(24)} ${claim.slice(0, 40)}`
    );
  }
  const r = pearson(vs, ns);
  console.log("\n" + "-".repeat(76));
  console.log(`корреляция вес↔натяг: r = ${r.toFixed(3)}`);
  console.log(Math.abs(r) < 0.4
    ? "✅ ОСИ НЕЗАВИСИМЫ — двухосная модель цены §5 держится."
    : `❌ ОСИ СЛИПЛИСЬ (|r| = ${Math.abs(r).toFixed(2)}) — двухосная цена схлопывается в одну шкалу.
   Это ломает §5: «игрок выбирает, за что платить» перестаёт быть выбором.`);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. ДЕТЕРМИНИЗМ. Пункт D разбора: §5 обещает воспроизводимую цену,
//    §8 велит сэмплировать. Если распределение устойчиво — цена берётся
//    из score (это уже взвешенное среднее), и сэмплинг тут не нужен.
// ─────────────────────────────────────────────────────────────────────────
async function det(n = 6) {
  console.log("=".repeat(76));
  console.log(`2 · ДЕТЕРМИНИЗМ КОТИРОВКИ — ${n} одинаковых запросов подряд`);
  console.log("=".repeat(76));
  const claim = "под хребтом спит дракон и скоро проснётся";
  const vs = [], ps = [];
  for (let i = 0; i < n; i++) {
    const r = await ask(claim);
    vs.push(r.answers.вес.score);
    ps.push(r.answers.верит_Ember.probability);
    console.log(`  ${String(i + 1).padStart(2)}  вес = ${r.answers.вес.score.toFixed(4)}   ` +
                `P(верит Ember) = ${r.answers.верит_Ember.probability.toFixed(4)}`);
  }
  const spread = (a) => Math.max(...a) - Math.min(...a);
  console.log(`\n  разброс веса:  ${spread(vs).toExponential(2)} (уровней шкалы)`);
  console.log(`  разброс веры:  ${spread(ps).toExponential(2)}`);
  console.log(spread(vs) < 0.05
    ? "\n✅ Распределение устойчиво — цену можно считать по score детерминированно.\n   Сэмплинг (§8) нужен только для решений мира, не для котировки."
    : "\n⚠️  Распределение плывёт — одинаковые шептания получат разную цену.\n   Нужен кэш по разобранной структуре и/или округление уровня.");
}

// ─────────────────────────────────────────────────────────────────────────
// 3. РОДЫ. §5 показывает Ember 91% против Flint 7%. Если приоры родов
//    не разводят вероятности — предпросмотр театр.
// ─────────────────────────────────────────────────────────────────────────
async function kin() {
  console.log("=".repeat(76));
  console.log("3 · РАЗЛИЧАЕТ ЛИ МОДЕЛЬ РОДЫ");
  console.log("=".repeat(76));
  const claim = "под хребтом спит дракон и скоро проснётся";
  const r = await ask(claim);
  const ps = [];
  for (const k of Object.keys(KINS)) {
    const p = r.answers[`верит_${k}`].probability;
    ps.push(p);
    const bar = "█".repeat(Math.round(p * 24)).padEnd(24, "░");
    console.log(`  ${k.padEnd(6)} ${bar} ${(p * 100).toFixed(0).padStart(3)}%`);
  }
  const spread = Math.max(...ps) - Math.min(...ps);
  console.log(`\n  разброс между родами: ${(spread * 100).toFixed(0)} п.п.`);
  console.log(spread > 0.25
    ? "✅ Роды разведены — предпросмотр §5 несёт информацию."
    : "❌ Роды почти не различаются — предпросмотр §5 показывает шум.\n   Приоры родов надо выносить в состояние жёстче, чем строкой Keeping.");
}

const cmd = process.argv[2] ?? "all";
if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("нет AI_GATEWAY_API_KEY в окружении");
  process.exit(1);
}
try {
  if (cmd === "axes" || cmd === "all") { await axes(); console.log(); }
  if (cmd === "det"  || cmd === "all") { await det();  console.log(); }
  if (cmd === "kin"  || cmd === "all") { await kin();  console.log(); }
} catch (e) {
  console.error("\nвызов не прошёл:", e.message);
  if (e.responseBody) console.error(String(e.responseBody).slice(0, 500));
  process.exit(1);
}

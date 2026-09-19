"""
Эксперимент B — петля веры (§6 architecture.md).

Проверяет утверждение разбора: при затухании раз в год окно настройки
коэффициента диффузии сжимается до единиц ppm, то есть мир либо застывает,
либо за пару лет верит во всё, и промежутка почти нет.

Модель по §6 буквально:
  • шаг физики = 1 час мира, 8640 шагов в мировом году (§3, проверено)
  • самораспространение: выше порога 20% слух расходится сам (лестница §6)
  • затухание: раз в год вера сползает к прежнему уровню
  • ожидание: вера укрепляется только если сбылось именно предсказанное
  • 95% → Keeping, становится lore и больше не затухает (храповик, пункт H)
"""
import numpy as np

STEPS_PER_YEAR = 8640          # §3: 24 шага × 360 суток
LORE = 0.95                    # §6: порог перехода в Keeping
SPREAD_FLOOR = 0.20            # §6: ниже этого слух сам не расходится
DEAD = 0.02

def run(g, years=30, n=600, decay_per_year=0.30, halflife_years=None,
        logistic=False, seed=0, p_fulfil=0.35, birth_per_year=20):
    """
    g                — усиление за шаг физики
    decay_per_year   — годовое затухание (вариант документа)
    halflife_years   — если задан, затухание идёт каждый шаг с этим полураспадом
                       (вариант разбора) вместо годового
    logistic         — насыщение p·(1-p) вместо чистого умножения (вариант разбора)
    p_fulfil         — доля убеждений, чьё ожидание сбывается в срок (гейт §6)
    """
    rng = np.random.default_rng(seed)
    p      = np.full(n, np.nan)          # nan = ещё не рождено
    prior  = np.zeros(n)
    born   = np.zeros(n, dtype=int)
    deadl  = np.zeros(n, dtype=int)
    fulfil = rng.random(n) < p_fulfil
    is_lore = np.zeros(n, dtype=bool)

    total_steps = years * STEPS_PER_YEAR
    birth_step = rng.integers(0, total_steps, size=n)
    birth_step.sort()
    # срок ожидания: от полугода до двух лет мира
    deadl = birth_step + rng.integers(STEPS_PER_YEAR//2, 2*STEPS_PER_YEAR, size=n)

    step_decay = None
    if halflife_years is not None:
        step_decay = 0.5 ** (1.0 / (halflife_years * STEPS_PER_YEAR))
    year_decay = 1.0 - decay_per_year

    lore_curve = []
    for s in range(total_steps):
        newborn = (birth_step == s)
        if newborn.any():
            k = newborn.sum()
            p[newborn] = rng.uniform(0.05, 0.25, size=k)   # вброшено с каким-то доверием
            prior[newborn] = rng.uniform(0.02, 0.10, size=k)

        live = ~np.isnan(p) & ~is_lore
        if live.any():
            pl = p[live]
            if logistic:
                pl = pl + g * pl * (1.0 - pl)
            else:
                grow = pl > SPREAD_FLOOR          # §6: сам расходится только выше 20%
                pl = np.where(grow, pl * (1.0 + g), pl)
            if step_decay is not None:
                pl = prior[live] + (pl - prior[live]) * step_decay
            p[live] = np.clip(pl, 0.0, 1.0)

        # ожидание: в срок — либо подтвердилось, либо подорвало веру (§6)
        due = (~np.isnan(p)) & ~is_lore & (deadl == s)
        if due.any():
            p[due & fulfil]  = np.clip(p[due & fulfil] + 0.25, 0, 1)
            p[due & ~fulfil] = np.clip(p[due & ~fulfil] * 0.4, 0, 1)

        if step_decay is None and (s + 1) % STEPS_PER_YEAR == 0:
            live = ~np.isnan(p) & ~is_lore
            p[live] = prior[live] + (p[live] - prior[live]) * year_decay

        crossed = (~np.isnan(p)) & ~is_lore & (p >= LORE)
        if crossed.any():
            is_lore |= crossed
            p[crossed] = 1.0
        if (s + 1) % STEPS_PER_YEAR == 0:
            lore_curve.append(int(is_lore.sum()))

    alive = ~np.isnan(p)
    born_n = int(alive.sum())
    lore_n = int(is_lore.sum())
    dead_n = int((alive & ~is_lore & (p < DEAD)).sum())
    mid_n  = born_n - lore_n - dead_n
    return dict(born=born_n, lore=lore_n, dead=dead_n, mid=mid_n,
                lore_f=lore_n/born_n, dead_f=dead_n/born_n, mid_f=mid_n/born_n,
                curve=lore_curve)

def band(rows, mid_min=0.15, lore_max=0.60):
    """Диапазон g, где мир ни мёртв, ни застыл."""
    ok = [g for g, r in rows if r['mid_f'] >= mid_min and r['lore_f'] <= lore_max]
    return (min(ok), max(ok)) if ok else None

if __name__ == '__main__':
    print("="*78)
    print("ВАРИАНТ ДОКУМЕНТА (§6): затухание раз в год, рост умножением")
    print("="*78)
    print(f"{'усиление за шаг':>18} {'lore':>7} {'мертво':>8} {'живо':>7}   что за мир")
    rows = []
    gs = [0, 1e-6, 5e-6, 1e-5, 2e-5, 3e-5, 5e-5, 8e-5, 1.2e-4, 2e-4, 5e-4, 1e-3]
    for g in gs:
        r = run(g)
        rows.append((g, r))
        verdict = ("всё умирает" if r['mid_f'] < 0.15 and r['lore_f'] < 0.05
                   else "застыл: всё стало законом" if r['lore_f'] > 0.60
                   else "живой")
        print(f"{g*100:>16.5f}% {r['lore_f']:>6.0%} {r['dead_f']:>8.0%} {r['mid_f']:>7.0%}   {verdict}")
    b = band(rows)
    if b:
        lo, hi = b
        print(f"\nокно живого мира: {lo*1e6:.1f} … {hi*1e6:.1f} ppm за шаг  (ширина {(hi-lo)*1e6:.1f} ppm)")
    else:
        print("\nокно живого мира: не найдено ни на одном из проверенных значений")

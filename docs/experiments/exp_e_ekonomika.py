"""
Эксперимент E — схлопывается ли выбор стратегии (§5 против §10).

§5 продаёт напряжение: «шептать то, во что мир уже наполовину верит, дёшево;
против консенсуса — дорого. Игрок выбирает, за что платить».
§10: репутация считается по доле шептаний, чьи ожидания сбылись.

Гипотеза разбора: сбывается чаще то, во что мир и так верил, значит дешёвая
стратегия поднимает репутацию, репутация делает её ещё дешевле, и два
множителя формулы §5 компаундируются в одну сторону. Тогда выбора нет.
"""
import numpy as np

BASE = 100.0
K_NATYAG = 2.0          # §5: натяг до ×3 ⇒ 1 + 2·t
REP_FLOOR, REP_CAP = 0.7, 1.4

def p_fulfil(t):
    """Шанс, что ожидание сбудется, падает с натягом: против течения сбывается редко."""
    return 0.90 * (1.0 - t) ** 1.5 + 0.03

def price(t, rep):
    return BASE * (1.0 + K_NATYAG * t) / np.clip(rep, REP_FLOOR, REP_CAP)

def simulate(strategy_t, n=400, weighted_rep=False, seed=0):
    rng = np.random.default_rng(seed)
    hits = 0.0; tries = 0.0; spent = 0.0; fulfilled = 0
    rep = 1.0
    rep_track = []
    for i in range(n):
        t = strategy_t
        spent += price(t, rep)
        ok = rng.random() < p_fulfil(t)
        fulfilled += ok
        if weighted_rep:
            # правка разбора: сбывшееся против течения весит больше
            w = 1.0 + 2.0 * t
            hits += w * ok; tries += w
        else:
            hits += ok; tries += 1
        rep = REP_FLOOR + (REP_CAP - REP_FLOOR) * (hits / max(tries, 1e-9))
        rep_track.append(rep)
    return dict(rep=rep, spent=spent, fulfilled=fulfilled,
                cost_per_hit=spent / max(fulfilled, 1),
                track=rep_track)

STRATS = [("подтверждает известное", 0.0), ("правдоподобно", 0.25),
          ("неожиданно", 0.5), ("противоречит виденному", 0.75),
          ("против общего знания", 1.0)]

for weighted, title in ((False, "ФОРМУЛА ДОКУМЕНТА (§5 + §10 как написаны)"),
                        (True,  "ПРАВКА РАЗБОРА: репутация с весом натяга")):
    print("="*84)
    print(title)
    print("="*84)
    print(f"{'стратегия (натяг)':>26} {'шанс сбыться':>13} {'репутация':>11} "
          f"{'★ за сбывшееся':>16} {'★ всего':>10}")
    print("-"*84)
    best = None
    for name, t in STRATS:
        # усредняем по seed, чтобы не ловить шум
        rs = [simulate(t, weighted_rep=weighted, seed=s) for s in range(12)]
        rep = np.mean([r['rep'] for r in rs])
        cph = np.mean([r['cost_per_hit'] for r in rs])
        spent = np.mean([r['spent'] for r in rs])
        print(f"{name:>20} ({t:.2f}) {p_fulfil(t):>12.0%} {rep:>11.2f} "
              f"{cph:>16.0f} {spent:>10.0f}")
        if best is None or cph < best[1]:
            best = (name, cph)
    print(f"\n  доминирующая стратегия: «{best[0]}» — дешевле всех за сбывшееся шептание")
    print()

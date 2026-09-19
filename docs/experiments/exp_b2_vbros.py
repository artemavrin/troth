"""
Эксперимент B2 — успевает ли гейт ожидания сработать (§6 против §4/§5).

§6 объявляет ожидание главным демпфером: «вера укрепляется только если
сбылось именно предсказанное». Но §4 вбрасывает оплаченное шептание сразу
с той верой, которую §5 показал игроку в предпросмотре (Ember 91%).

Вопрос: если убеждение рождается выше порога 20%, успевает ли оно дойти
до lore (95%) РАНЬШЕ своего срока ожидания? Если да — гейт не срабатывает
никогда, и главный демпфер §6 для оплаченных шептаний не существует.
"""
import math

STEPS_PER_YEAR = 8640
LORE = 0.95
FLOOR = 0.20

def steps_to_lore(p0, g):
    if g <= 0 or p0 >= LORE:
        return 0 if p0 >= LORE else math.inf
    if p0 <= FLOOR:
        return math.inf          # сам не расходится (§6)
    return math.log(LORE / p0) / math.log(1.0 + g)

print("="*80)
print("За сколько убеждение доезжает до lore (95%) при разной вере при вбросе")
print("Срок ожидания по §11 — до конца года, то есть 8640 шагов.")
print("="*80)
print(f"{'вера при вбросе':>16} |" + "".join(f"{g*100:>11.4f}%" for g in (1e-5, 5e-5, 2e-4, 1e-3)))
print(f"{'':>16} |" + "".join(f"{'усиление/шаг':>12}" for _ in range(4)))
print("-"*80)

GS = (1e-5, 5e-5, 2e-4, 1e-3)
# вероятности веры прямо из предпросмотра §5
for label, p0 in (("Ember  91%", 0.91), ("Ford   48%", 0.48),
                  ("Root   21%", 0.21), ("Flint   7%", 0.07)):
    cells = []
    for g in GS:
        s = steps_to_lore(p0, g)
        if s == math.inf:
            cells.append(f"{'—':>12}")
        else:
            yrs = s / STEPS_PER_YEAR
            cells.append(f"{yrs:>11.2f}г" if yrs >= 0.01 else f"{'<0.01г':>12}")
    print(f"{label:>16} |" + "".join(cells))

print()
print("«—» = ниже порога 20%, сам не расходится, гейт ожидания доживёт до срока.")
print()
print("="*80)
print("Успевает ли ожидание (срок — 1 мировой год) проверить убеждение?")
print("="*80)
for g in GS:
    early = []
    for label, p0 in (("Ember 91%", 0.91), ("Ford 48%", 0.48), ("Root 21%", 0.21)):
        s = steps_to_lore(p0, g)
        if s < STEPS_PER_YEAR:
            early.append(f"{label} за {s/STEPS_PER_YEAR:.2f}г")
    verdict = ("гейт не срабатывает: " + ", ".join(early)) if early else "гейт успевает для всех"
    print(f"  усиление {g*100:>8.4f}%/шаг  →  {verdict}")

print()
print("="*80)
print("Сколько вообще нужно усиления, чтобы 91% доехал до lore за срок ожидания")
print("="*80)
for deadline_years in (0.25, 0.5, 1.0, 2.0):
    d = deadline_years * STEPS_PER_YEAR
    g_need = (LORE/0.91) ** (1.0/d) - 1.0
    print(f"  срок {deadline_years:>4}г = {d:>6.0f} шагов  →  достаточно усиления {g_need*1e6:>7.2f} ppm/шаг "
          f"({g_need*100:.6f}%)")

# --- Такты (§3) ---
STEP_S = 25                      # реальных секунд на 1 час мира
WDAY_S = 24 * STEP_S             # мировые сутки в реальных секундах
print(f"мировые сутки = {WDAY_S} с = {WDAY_S/60:.0f} мин")
RDAY_S = 86400
WDAYS_PER_RDAY = RDAY_S / WDAY_S
print(f"мировых суток в реальных сутках = {WDAYS_PER_RDAY:.0f}")
YEAR_WD = 4 * 90
print(f"год = {YEAR_WD} мировых суток = {YEAR_WD*WDAY_S/RDAY_S:.2f} реальных суток")
print(f"шагов физики в году = {YEAR_WD*24}")

# --- Расход вызовов (§8) ---
print()
for kin in (8, 12, 16):
    print(f"роды: {kin} родов × раз в мировые сутки = {kin*WDAYS_PER_RDAY:.0f}/реальные сутки (в таблице 1730)")
print()
PLACES = 400
for period in (2, 2.5, 3):
    n = PLACES * WDAYS_PER_RDAY / period
    print(f"поселения: {PLACES} × раз в {period} мировых суток = {n:.0f}/реальные сутки (в таблице 9600)")
print(f"9600 в таблице ⇒ период = {PLACES*WDAYS_PER_RDAY/9600:.1f} мировых суток, либо {9600*2.5/WDAYS_PER_RDAY:.0f} поселений при периоде 2,5")

# --- Итог по таблице против пересчёта ---
print()
doc_total = 1730 + 9600 + 5000 + 800 + 200
print(f"итог по таблице = {doc_total}  (в документе ≈17 300)")
for period in (2, 3):
    places = PLACES * WDAYS_PER_RDAY / period
    tot = 1730 + places + 5000 + 800 + 200
    print(f"пересчёт при периоде {period}: итого {tot:.0f}/сутки = {tot/RDAY_S:.2f} выз/с, 1 вызов в {RDAY_S/tot:.1f} с")

# --- Пики против среднего ---
print()
print(f"если все {PLACES} поселений решают на одной границе шага: {PLACES} запросов за {STEP_S} с = {PLACES/STEP_S:.0f} выз/с")
print(f"лимит Jev 1200 req/min = {1200/60:.0f} выз/с")

# --- Стоимость модели ---
print()
for calls in (17300, 28800):
    for tok in (1000, 2000, 4000):
        cost_d = calls * tok / 1e6 * 0.042
        print(f"{calls} выз/сут × {tok} ток = ${cost_d:.2f}/сут = ${cost_d*30:.0f}/мес")

# --- Рост таблицы decision ---
print()
for calls in (17300, 28800):
    for kb in (5, 20):
        gb_year = calls * kb * 365 / 1e6
        print(f"{calls} выз/сут × {kb} КБ = {calls*kb/1e6:.2f} ГБ/сут = {gb_year:.0f} ГБ/реальный год")

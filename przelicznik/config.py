"""Stałe podatkowe i czasowe.

Wartości orientacyjne na 2025/2026 dla Polski. Wymagają aktualizacji
przy zmianach w prawie. Wszystkie wartości pieniężne w PLN.
"""
from typing import Final

# ----------------- Czas pracy -----------------
HOURS_PER_DAY: Final[int] = 8
DAYS_PER_WEEK: Final[int] = 5
HOURS_PER_WEEK: Final[int] = HOURS_PER_DAY * DAYS_PER_WEEK
HOURS_PER_MONTH: Final[int] = 168
WORKING_DAYS_PER_YEAR_FULL: Final[int] = 252  # po wykluczeniu weekendów i świąt

# ----------------- ZUS pracownika (UoP) -----------------
ZUS_EMERYTALNE: Final[float] = 0.0976
ZUS_RENTOWE: Final[float] = 0.015
ZUS_CHOROBOWE: Final[float] = 0.0245
ZUS_TOTAL_UOP: Final[float] = ZUS_EMERYTALNE + ZUS_RENTOWE + ZUS_CHOROBOWE  # 13.71%

# ----------------- Składka zdrowotna -----------------
HEALTH_RATE_UOP: Final[float] = 0.09

# ----------------- PIT (skala podatkowa) -----------------
PIT_FIRST_BRACKET: Final[float] = 0.12
PIT_SECOND_BRACKET: Final[float] = 0.32
PIT_THRESHOLD_ANNUAL: Final[float] = 120_000.0
KUP_MONTHLY: Final[float] = 250.0  # koszty uzyskania przychodu (UoP)
KWOTA_ZMNIEJSZAJACA_MONTHLY: Final[float] = 300.0
ULGA_MLODYCH_LIMIT_ANNUAL: Final[float] = 85_528.0

# ----------------- UZ (umowa zlecenie) -----------------
KUP_UZ_RATE: Final[float] = 0.20  # 20% KUP od (przychód - ZUS)

# ----------------- B2B - ZUS (2025, bez chorobowego) -----------------
B2B_ZUS_PREF: Final[float] = 442.90
B2B_ZUS_FULL: Final[float] = 1646.47
B2B_ZUS_ULGA: Final[float] = 0.0

# ----------------- B2B - zdrowotna (2025) -----------------
B2B_HEALTH_MIN: Final[float] = 314.96

# Ryczałt: zdrowotna jako stała kwota w progach (rocznego przychodu)
B2B_HEALTH_RYCZALT_LOW: Final[float] = 461.66    # do 60 000 zł/rok
B2B_HEALTH_RYCZALT_MID: Final[float] = 769.43    # 60 000 - 300 000 zł/rok
B2B_HEALTH_RYCZALT_HIGH: Final[float] = 1384.97  # powyżej 300 000 zł/rok

B2B_HEALTH_LINIOWY_RATE: Final[float] = 0.049
B2B_HEALTH_SKALA_RATE: Final[float] = 0.09

# ----------------- B2B - PIT -----------------
PIT_LINIOWY_RATE: Final[float] = 0.19

# ----------------- Etykiety form zatrudnienia -----------------
FORM_LABELS = {
    "uop": "Umowa o pracę",
    "uz": "Umowa zlecenie",
    "b2b_liniowy": "B2B — podatek liniowy 19%",
    "b2b_ryczalt": "B2B — ryczałt",
    "b2b_skala": "B2B — skala 12% / 32%",
}

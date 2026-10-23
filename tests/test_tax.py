"""Testy regresyjne dla obliczeń podatkowych.

Wartości referencyjne porównywane z popularnymi kalkulatorami pensji online
(np. PIT.pl, money.pl). Tolerancja ±50 zł — kalkulatory różnią się
detalami (zaokrąglenia, kwota wolna).
"""
from __future__ import annotations

import pytest

from przelicznik.tax import (
    calc_b2b_liniowy,
    calc_b2b_ryczalt,
    calc_b2b_skala,
    calc_uop,
    calc_uz,
)
from przelicznik.time_utils import format_time_breakdown, plural_pl


# ----- UoP -----

@pytest.mark.parametrize("gross,expected_net", [
    (5_000, 3_738),
    (8_000, 5_783),
    (10_000, 7_146),
    (12_000, 8_489),
    (15_000, 10_016),
])
def test_uop_netto_in_range(gross: float, expected_net: float) -> None:
    result = calc_uop(gross)
    assert abs(result.net - expected_net) < 50, f"UoP {gross} -> {result.net}, oczekiwano ~{expected_net}"
    assert result.gross == gross
    assert result.zus_social > 0
    assert result.health > 0


def test_uop_zero() -> None:
    result = calc_uop(0)
    assert result.net == 0
    assert result.gross == 0


def test_uop_second_bracket() -> None:
    """Powyżej 120k rocznie powinien działać drugi próg PIT 32%."""
    low = calc_uop(9_000)
    high = calc_uop(20_000)
    # Powyżej progu efektywna stawka jest niższa proporcjonalnie
    assert high.net / high.gross < low.net / low.gross


# ----- UZ -----

def test_uz_student_below_limit() -> None:
    """Student ≤26 lat poniżej limitu ulgi = 100% netto."""
    result = calc_uz(5_000, is_student_under_26=True)
    assert result.net == 5_000
    assert result.pit == 0
    assert result.zus_social == 0


def test_uz_standard_with_chorobowe() -> None:
    """UZ standardowe z chorobowym ~5900 z 8000 brutto."""
    result = calc_uz(8_000, is_student_under_26=False, chorobowe=True)
    assert abs(result.net - 5_900) < 100


def test_uz_without_chorobowe_higher() -> None:
    """Bez chorobowego netto jest wyższe."""
    with_ch = calc_uz(8_000, chorobowe=True)
    without_ch = calc_uz(8_000, chorobowe=False)
    assert without_ch.net > with_ch.net


# ----- B2B liniowy -----

def test_b2b_liniowy_full_zus() -> None:
    """B2B liniowy 20k przychodu, pełny ZUS ≈ 14k netto."""
    result = calc_b2b_liniowy(20_000, "pelny")
    assert abs(result.net - 14_000) < 200


def test_b2b_liniowy_zus_variants_ordering() -> None:
    """Ulga na start > preferencyjny > pełny pod względem netto."""
    ulga = calc_b2b_liniowy(15_000, "ulga")
    pref = calc_b2b_liniowy(15_000, "preferencyjny")
    pelny = calc_b2b_liniowy(15_000, "pelny")
    assert ulga.net > pref.net > pelny.net


# ----- B2B ryczałt -----

def test_b2b_ryczalt_12() -> None:
    result = calc_b2b_ryczalt(15_000, "pelny", 12)
    assert result.net > 0
    assert result.pit > 0


def test_b2b_ryczalt_lower_rate_higher_net() -> None:
    low_rate = calc_b2b_ryczalt(15_000, "pelny", 8.5)
    high_rate = calc_b2b_ryczalt(15_000, "pelny", 15)
    assert low_rate.net > high_rate.net


# ----- B2B skala -----

def test_b2b_skala_low_income() -> None:
    """Skala przy niskim dochodzie - PIT 12% lub mniej."""
    result = calc_b2b_skala(7_000, "pelny")
    assert result.net > 0


# ----- Time breakdown -----

def test_time_breakdown_basic() -> None:
    """1300 zł / 50 zł netto/h = 26h = 3 dni + 2 h."""
    r = format_time_breakdown(26.0, vacation_days=0)
    assert r["breakdown"]["days"] == 3
    assert r["breakdown"]["hours"] == 2
    assert r["total_hours"] == 26.0


def test_time_breakdown_with_vacation() -> None:
    """Urlop zmniejsza dni pracy w roku i podnosi % roku."""
    no_vacation = format_time_breakdown(168, vacation_days=0)
    with_vacation = format_time_breakdown(168, vacation_days=26)
    assert with_vacation["percent_of_year"] > no_vacation["percent_of_year"]


def test_time_breakdown_includes_years() -> None:
    """Bardzo długi czas pracy ma rozbicie na lata."""
    r = format_time_breakdown(5000, vacation_days=26)
    assert r["breakdown"]["years"] >= 2


# ----- plural -----

@pytest.mark.parametrize("n,expected", [
    (1, "rok"),
    (2, "lata"),
    (3, "lata"),
    (4, "lata"),
    (5, "lat"),
    (12, "lat"),  # wyjątek 12-14
    (13, "lat"),
    (22, "lata"),
])
def test_plural_pl(n: int, expected: str) -> None:
    assert plural_pl(n, "rok", "lata", "lat") == expected

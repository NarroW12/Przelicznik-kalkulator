"""Czyste funkcje wyliczania netto dla różnych form zatrudnienia w Polsce.

Wszystkie funkcje przyjmują kwoty *miesięczne* i zwracają netto miesięcznie.
Obliczenia są uproszczone — pomijają ulgi 4+, IP Box, PPK, autorskie 50%,
Mały ZUS Plus, drugą umowę itd.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .config import (
    B2B_HEALTH_LINIOWY_RATE,
    B2B_HEALTH_MIN,
    B2B_HEALTH_RYCZALT_HIGH,
    B2B_HEALTH_RYCZALT_LOW,
    B2B_HEALTH_RYCZALT_MID,
    B2B_HEALTH_SKALA_RATE,
    B2B_ZUS_FULL,
    B2B_ZUS_PREF,
    B2B_ZUS_ULGA,
    HEALTH_RATE_UOP,
    KUP_MONTHLY,
    KUP_UZ_RATE,
    KWOTA_ZMNIEJSZAJACA_MONTHLY,
    PIT_FIRST_BRACKET,
    PIT_LINIOWY_RATE,
    PIT_SECOND_BRACKET,
    PIT_THRESHOLD_ANNUAL,
    ULGA_MLODYCH_LIMIT_ANNUAL,
    ZUS_CHOROBOWE,
    ZUS_EMERYTALNE,
    ZUS_RENTOWE,
    ZUS_TOTAL_UOP,
)

ZusVariant = Literal["ulga", "preferencyjny", "pelny"]


@dataclass(frozen=True)
class TaxBreakdown:
    """Rozkład miesięcznej pensji brutto na składniki."""
    gross: float
    zus_social: float
    health: float
    pit: float
    net: float

    @property
    def total_deductions(self) -> float:
        return self.zus_social + self.health + self.pit

    def as_dict(self) -> dict:
        return {
            "gross": round(self.gross, 2),
            "zus_social": round(self.zus_social, 2),
            "health": round(self.health, 2),
            "pit": round(self.pit, 2),
            "net": round(self.net, 2),
            "total_deductions": round(self.total_deductions, 2),
        }


def _zus_b2b_amount(variant: ZusVariant) -> float:
    return {
        "ulga": B2B_ZUS_ULGA,
        "preferencyjny": B2B_ZUS_PREF,
        "pelny": B2B_ZUS_FULL,
    }.get(variant, B2B_ZUS_FULL)


def _ryczalt_health_amount(annual_revenue: float) -> float:
    if annual_revenue <= 60_000:
        return B2B_HEALTH_RYCZALT_LOW
    if annual_revenue <= 300_000:
        return B2B_HEALTH_RYCZALT_MID
    return B2B_HEALTH_RYCZALT_HIGH


def _pit_scale_monthly(podstawa_monthly: float) -> float:
    """PIT skala 12% / 32% z kwotą zmniejszającą podatek."""
    annual = podstawa_monthly * 12
    if annual <= PIT_THRESHOLD_ANNUAL:
        pit = podstawa_monthly * PIT_FIRST_BRACKET - KWOTA_ZMNIEJSZAJACA_MONTHLY
    else:
        m_threshold = PIT_THRESHOLD_ANNUAL / 12
        pit = (
            m_threshold * PIT_FIRST_BRACKET
            + (podstawa_monthly - m_threshold) * PIT_SECOND_BRACKET
            - KWOTA_ZMNIEJSZAJACA_MONTHLY
        )
    return max(0.0, pit)


# ----------------- UoP -----------------

def calc_uop(gross_monthly: float) -> TaxBreakdown:
    if gross_monthly <= 0:
        return TaxBreakdown(0, 0, 0, 0, 0)
    zus = gross_monthly * ZUS_TOTAL_UOP
    health = (gross_monthly - zus) * HEALTH_RATE_UOP
    podstawa = round(gross_monthly - zus - KUP_MONTHLY)
    pit = _pit_scale_monthly(podstawa)
    net = gross_monthly - zus - health - pit
    return TaxBreakdown(gross_monthly, zus, health, pit, net)


# ----------------- UZ -----------------

def calc_uz(
    gross_monthly: float,
    is_student_under_26: bool = False,
    chorobowe: bool = True,
) -> TaxBreakdown:
    """Umowa zlecenie. Zakłada że to jedyna umowa (pełne składki społeczne)."""
    if gross_monthly <= 0:
        return TaxBreakdown(0, 0, 0, 0, 0)

    if is_student_under_26:
        annual = gross_monthly * 12
        if annual <= ULGA_MLODYCH_LIMIT_ANNUAL:
            return TaxBreakdown(gross_monthly, 0, 0, 0, gross_monthly)
        excess_monthly = (annual - ULGA_MLODYCH_LIMIT_ANNUAL) / 12
        kup = excess_monthly * KUP_UZ_RATE
        pit_base = max(0.0, excess_monthly - kup)
        pit = _pit_scale_monthly(pit_base)
        return TaxBreakdown(gross_monthly, 0, 0, pit, gross_monthly - pit)

    zus_rate = ZUS_EMERYTALNE + ZUS_RENTOWE + (ZUS_CHOROBOWE if chorobowe else 0)
    zus = gross_monthly * zus_rate
    health = (gross_monthly - zus) * HEALTH_RATE_UOP
    kup = (gross_monthly - zus) * KUP_UZ_RATE
    podstawa = round(gross_monthly - zus - kup)
    pit = _pit_scale_monthly(podstawa)
    net = gross_monthly - zus - health - pit
    return TaxBreakdown(gross_monthly, zus, health, pit, net)


# ----------------- B2B -----------------

def calc_b2b_liniowy(revenue_monthly: float, zus_variant: ZusVariant) -> TaxBreakdown:
    if revenue_monthly <= 0:
        return TaxBreakdown(0, 0, 0, 0, 0)
    zus = _zus_b2b_amount(zus_variant)
    income = revenue_monthly - zus
    health = max(income * B2B_HEALTH_LINIOWY_RATE, B2B_HEALTH_MIN)
    pit = max(0.0, income) * PIT_LINIOWY_RATE
    net = revenue_monthly - zus - health - pit
    return TaxBreakdown(revenue_monthly, zus, health, pit, net)


def calc_b2b_ryczalt(
    revenue_monthly: float,
    zus_variant: ZusVariant,
    ryczalt_rate_pct: float,
) -> TaxBreakdown:
    if revenue_monthly <= 0:
        return TaxBreakdown(0, 0, 0, 0, 0)
    zus = _zus_b2b_amount(zus_variant)
    health = _ryczalt_health_amount(revenue_monthly * 12)
    pit_base = max(0.0, revenue_monthly - zus * 0.5)
    pit = pit_base * (ryczalt_rate_pct / 100.0)
    net = revenue_monthly - zus - health - pit
    return TaxBreakdown(revenue_monthly, zus, health, pit, net)


def calc_b2b_skala(revenue_monthly: float, zus_variant: ZusVariant) -> TaxBreakdown:
    if revenue_monthly <= 0:
        return TaxBreakdown(0, 0, 0, 0, 0)
    zus = _zus_b2b_amount(zus_variant)
    income = revenue_monthly - zus
    health = max(income * B2B_HEALTH_SKALA_RATE, B2B_HEALTH_MIN)
    pit = _pit_scale_monthly(max(0.0, income))
    net = revenue_monthly - zus - health - pit
    return TaxBreakdown(revenue_monthly, zus, health, pit, net)

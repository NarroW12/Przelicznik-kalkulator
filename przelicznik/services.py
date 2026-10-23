"""Logika biznesowa — łączy formularz profilu z funkcjami z tax.py."""
from __future__ import annotations

from typing import TypedDict

from .config import FORM_LABELS, HOURS_PER_MONTH
from .tax import (
    TaxBreakdown,
    calc_b2b_liniowy,
    calc_b2b_ryczalt,
    calc_b2b_skala,
    calc_uop,
    calc_uz,
)


class ProfilePayload(TypedDict, total=False):
    form: str
    mode: str  # "hourly" lub "monthly"
    is_brutto: bool
    hourly_rate: float
    monthly_salary: float
    hours_per_month: float
    vacation_days: int
    zus_variant: str
    ryczalt_rate: float
    uz_student: bool
    uz_chorobowe: bool


class ResolvedSalary(TypedDict):
    monthly_netto: float
    monthly_gross: float | None
    effective_hourly: float
    hours_per_month: float
    form_label: str
    breakdown: dict | None


class CalcError(ValueError):
    """Błąd walidacji danych profilu."""


def _parse_monthly_input(payload: ProfilePayload) -> tuple[str, float, float]:
    """Wyciąga (mode, monthly_input, hours_per_month) z walidacją."""
    mode = payload.get("mode", "monthly")
    hours_per_month = float(payload.get("hours_per_month", HOURS_PER_MONTH) or HOURS_PER_MONTH)
    if hours_per_month <= 0:
        raise CalcError("Liczba godzin pracy w miesiącu musi być większa od zera.")

    if mode == "hourly":
        rate = float(payload.get("hourly_rate", 0) or 0)
        if rate <= 0:
            raise CalcError("Stawka godzinowa musi być większa od zera.")
        monthly_input = rate * hours_per_month
    else:
        monthly_input = float(payload.get("monthly_salary", 0) or 0)
        if monthly_input <= 0:
            raise CalcError("Pensja / przychód musi być większy od zera.")

    return mode, monthly_input, hours_per_month


def _label_for(form: str, payload: ProfilePayload) -> str:
    if form == "uz":
        if payload.get("uz_student"):
            return "Umowa zlecenie (student ≤ 26)"
        return "Umowa zlecenie" + (" (z chorobowym)" if payload.get("uz_chorobowe", True) else " (bez chorobowego)")
    if form == "b2b_ryczalt":
        rate = float(payload.get("ryczalt_rate", 12) or 12)
        return f"B2B — ryczałt {rate:g}%"
    return FORM_LABELS.get(form, form)


def _compute_breakdown(form: str, monthly_input: float, payload: ProfilePayload) -> TaxBreakdown:
    if form == "uop":
        return calc_uop(monthly_input)
    if form == "uz":
        return calc_uz(
            monthly_input,
            is_student_under_26=bool(payload.get("uz_student", False)),
            chorobowe=bool(payload.get("uz_chorobowe", True)),
        )
    if form == "b2b_liniowy":
        return calc_b2b_liniowy(monthly_input, payload.get("zus_variant", "pelny"))
    if form == "b2b_ryczalt":
        rate = float(payload.get("ryczalt_rate", 12) or 12)
        return calc_b2b_ryczalt(monthly_input, payload.get("zus_variant", "pelny"), rate)
    if form == "b2b_skala":
        return calc_b2b_skala(monthly_input, payload.get("zus_variant", "pelny"))
    raise CalcError(f"Nieznana forma zatrudnienia: {form}")


def resolve_monthly_netto(payload: ProfilePayload) -> ResolvedSalary:
    """Konwertuje payload profilu na efektywne wartości netto + rozkład podatkowy."""
    form = payload.get("form", "uop")
    is_brutto = bool(payload.get("is_brutto", False))
    _mode, monthly_input, hours_per_month = _parse_monthly_input(payload)

    breakdown: TaxBreakdown | None = None
    monthly_gross: float | None = None

    if is_brutto:
        breakdown = _compute_breakdown(form, monthly_input, payload)
        monthly_gross = monthly_input
        monthly_netto = breakdown.net
    else:
        monthly_netto = monthly_input

    if monthly_netto <= 0:
        raise CalcError("Wyliczona pensja netto wyszła zerowa lub ujemna.")

    return ResolvedSalary(
        monthly_netto=round(monthly_netto, 2),
        monthly_gross=round(monthly_gross, 2) if monthly_gross is not None else None,
        effective_hourly=round(monthly_netto / hours_per_month, 2),
        hours_per_month=hours_per_month,
        form_label=_label_for(form, payload),
        breakdown=breakdown.as_dict() if breakdown else None,
    )

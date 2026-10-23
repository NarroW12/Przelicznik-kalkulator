"""Konwersja godzin pracy na rozbicie czasowe i polski format tekstowy."""
from __future__ import annotations

from .config import (
    HOURS_PER_DAY,
    HOURS_PER_MONTH,
    HOURS_PER_WEEK,
    WORKING_DAYS_PER_YEAR_FULL,
)


def plural_pl(n: int, one: str, few: str, many: str) -> str:
    """Polska odmiana liczebnikowa: 1 / 2-4 / inne (z wyjątkiem 12-14)."""
    if n == 1:
        return one
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return few
    return many


def format_time_breakdown(hours: float, vacation_days: int = 0) -> dict:
    """Zwraca rozbicie i sumy dla danego czasu pracy w godzinach."""
    working_days_per_year = max(1, WORKING_DAYS_PER_YEAR_FULL - vacation_days)
    hours_per_year = working_days_per_year * HOURS_PER_DAY

    years = int(hours // hours_per_year)
    rem = hours - years * hours_per_year
    months = int(rem // HOURS_PER_MONTH); rem -= months * HOURS_PER_MONTH
    weeks = int(rem // HOURS_PER_WEEK); rem -= weeks * HOURS_PER_WEEK
    days = int(rem // HOURS_PER_DAY); rem -= days * HOURS_PER_DAY
    full_hours = int(rem)
    minutes = int(round((rem - full_hours) * 60))
    if minutes == 60:
        full_hours += 1
        minutes = 0

    breakdown = {
        "years": years, "months": months, "weeks": weeks,
        "days": days, "hours": full_hours, "minutes": minutes,
    }

    return {
        "total_hours": round(hours, 2),
        "total_minutes": round(hours * 60, 0),
        "total_working_days": round(hours / HOURS_PER_DAY, 2),
        "total_working_weeks": round(hours / HOURS_PER_WEEK, 2),
        "total_working_months": round(hours / HOURS_PER_MONTH, 2),
        "total_working_years": round(hours / hours_per_year, 3),
        "percent_of_year": round((hours / hours_per_year) * 100, 2),
        "hours_per_year_effective": hours_per_year,
        "working_days_per_year": working_days_per_year,
        "breakdown": breakdown,
        "breakdown_text": format_breakdown_text(breakdown),
    }


def format_breakdown_text(b: dict) -> str:
    """Zwraca tekst typu „1 rok, 2 miesiące, 3 dni, 5 godzin, 30 min”."""
    parts = []
    if b["years"]:
        parts.append(f"{b['years']} {plural_pl(b['years'], 'rok', 'lata', 'lat')}")
    if b["months"]:
        parts.append(f"{b['months']} {plural_pl(b['months'], 'miesiąc', 'miesiące', 'miesięcy')}")
    if b["weeks"]:
        parts.append(f"{b['weeks']} {plural_pl(b['weeks'], 'tydzień', 'tygodnie', 'tygodni')}")
    if b["days"]:
        parts.append(f"{b['days']} {plural_pl(b['days'], 'dzień', 'dni', 'dni')}")
    if b["hours"]:
        parts.append(f"{b['hours']} {plural_pl(b['hours'], 'godzina', 'godziny', 'godzin')}")
    if b["minutes"]:
        parts.append(f"{b['minutes']} min")
    return ", ".join(parts) if parts else "0 minut"

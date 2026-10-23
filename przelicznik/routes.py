"""Routy Flask - osobne podstrony + API."""
from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from .config import HOURS_PER_MONTH, HOURS_PER_WEEK, HOURS_PER_DAY
from .services import CalcError, resolve_monthly_netto
from .time_utils import format_time_breakdown


def register_routes(app: Flask) -> None:
    # ----- Strony -----
    @app.route("/")
    def page_calculator():
        return render_template("calculator.html", active="calculator")

    @app.route("/reverse")
    def page_reverse():
        return render_template("reverse.html", active="reverse")

    @app.route("/wishlist")
    def page_wishlist():
        return render_template("wishlist.html", active="wishlist")

    @app.route("/budget")
    def page_budget():
        return render_template("budget.html", active="budget")

    @app.route("/goals")
    def page_goals():
        return render_template("goals.html", active="goals")

    @app.route("/history")
    def page_history():
        return render_template("history.html", active="history")

    @app.route("/reference")
    def page_reference():
        return render_template("reference.html", active="reference")

    @app.route("/settings")
    def page_settings():
        return render_template("settings.html", active="settings")

    @app.route("/about")
    def page_about():
        return render_template("about.html", active="about")

    # ----- API -----
    @app.post("/api/calculate")
    def api_calculate():
        data = request.get_json(silent=True) or {}
        try:
            price = float(data.get("price", 0) or 0)
            if price <= 0:
                raise CalcError("Cena musi być większa od zera.")
            vacation_days = int(data.get("vacation_days", 0) or 0)
            if not 0 <= vacation_days <= 200:
                raise CalcError("Liczba dni urlopu poza zakresem (0–200).")
            salary = resolve_monthly_netto(data)
        except CalcError as e:
            return jsonify({"error": str(e)}), 400

        hours_needed = price / salary["effective_hourly"]
        result = format_time_breakdown(hours_needed, vacation_days=vacation_days)
        result.update({
            "price": price,
            "effective_hourly_netto": salary["effective_hourly"],
            "monthly_netto": salary["monthly_netto"],
            "monthly_gross": salary["monthly_gross"],
            "form_label": salary["form_label"],
            "tax_breakdown": salary["breakdown"],
            "vacation_days": vacation_days,
        })
        return jsonify(result)

    @app.post("/api/reverse")
    def api_reverse():
        data = request.get_json(silent=True) or {}
        try:
            amount = float(data.get("amount", 0) or 0)
            if amount <= 0:
                raise CalcError("Czas musi być większy od zera.")
            salary = resolve_monthly_netto(data)
        except CalcError as e:
            return jsonify({"error": str(e)}), 400

        unit_to_hours = {
            "hours": 1,
            "days": HOURS_PER_DAY,
            "weeks": HOURS_PER_WEEK,
            "months": HOURS_PER_MONTH,
            "years": HOURS_PER_MONTH * 12,
        }
        unit = data.get("unit", "hours")
        if unit not in unit_to_hours:
            return jsonify({"error": "Nieznana jednostka czasu."}), 400

        hours = amount * unit_to_hours[unit]
        return jsonify({
            "earned": round(hours * salary["effective_hourly"], 2),
            "hours": round(hours, 2),
            "effective_hourly_netto": salary["effective_hourly"],
            "monthly_netto": salary["monthly_netto"],
            "form_label": salary["form_label"],
        })

    @app.post("/api/profile-preview")
    def api_profile_preview():
        data = request.get_json(silent=True) or {}
        try:
            info = resolve_monthly_netto(data)
        except CalcError as e:
            return jsonify({"error": str(e)}), 400
        return jsonify(info)

    @app.post("/api/whatif")
    def api_whatif():
        """Symulacja: co jeśli zarobki +/- X%?"""
        data = request.get_json(silent=True) or {}
        try:
            pct = float(data.get("delta_pct", 0) or 0)
            base = resolve_monthly_netto(data)

            modified = dict(data)
            if data.get("mode") == "hourly":
                modified["hourly_rate"] = float(data.get("hourly_rate", 0) or 0) * (1 + pct / 100)
            else:
                modified["monthly_salary"] = float(data.get("monthly_salary", 0) or 0) * (1 + pct / 100)
            after = resolve_monthly_netto(modified)
        except CalcError as e:
            return jsonify({"error": str(e)}), 400

        diff_netto = after["monthly_netto"] - base["monthly_netto"]
        diff_hourly = after["effective_hourly"] - base["effective_hourly"]
        return jsonify({
            "base": base,
            "after": after,
            "delta_pct": pct,
            "diff_monthly_netto": round(diff_netto, 2),
            "diff_hourly_netto": round(diff_hourly, 2),
            "diff_annual_netto": round(diff_netto * 12, 2),
        })

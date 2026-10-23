"""Przelicznik - pieniądze na czas pracy.

Aplikacja webowa konwertująca cenę produktu na czas pracy
potrzebny do jej zarobienia, z obsługą wielu form zatrudnienia
w Polsce (UoP, UZ, B2B liniowy/ryczałt/skala).
"""
from flask import Flask


def create_app() -> Flask:
    """Application factory."""
    app = Flask(
        __name__,
        static_folder="../static",
        template_folder="../templates",
    )

    from .routes import register_routes
    register_routes(app)

    return app

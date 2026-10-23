# Przelicznik

Aplikacja webowa zamieniająca cenę produktu na czas pracy potrzebny do jej zarobienia.
Obsługuje polskie formy zatrudnienia: UoP, UZ, B2B liniowy, B2B ryczałt, B2B skala.

## Funkcje

- **Kalkulator** — cena → czas pracy (lata, miesiące, tygodnie, dni, godziny, minuty)
- **Tryb odwrotny** — czas → zarobki na rękę
- **Lista zakupów** — łączny czas pracy na wybrane produkty
- **Cele oszczędnościowe** — postęp i prognozowana data zakupu
- **Katalog typowych produktów** — kontekst „ile pracujesz na kawę / obiad / mieszkanie”
- **Historia + statystyki** — ostatnie obliczenia z podsumowaniem
- **Wiele profili** — porównuj UoP, B2B, drugą pracę
- **Symulacja podwyżki** — co jeśli zarobki ±X%
- **Wykres rozkładu pensji** — gdzie znikają pieniądze (ZUS / zdrowotna / PIT / netto)
- **Dark mode** + zachowanie preferencji
- **Inflacja** — uwzględnij cenę produktu za X lat
- **Udostępnianie linkiem** — kopiowalny URL z parametrami
- **Backup JSON** — eksport / import wszystkich danych

## Struktura

```
przelicznik/
├── app.py                       # entry point (development server)
├── przelicznik/                 # pakiet Pythona
│   ├── __init__.py              # app factory
│   ├── config.py                # stałe podatkowe i czasowe
│   ├── tax.py                   # czyste funkcje obliczeń podatkowych
│   ├── time_utils.py            # rozbicie czasowe + polskie odmiany
│   ├── services.py              # logika biznesowa (resolve_monthly_netto)
│   └── routes.py                # routy stron + API
├── tests/
│   └── test_tax.py              # 26 testów regresyjnych
├── templates/                   # Jinja2 - po jednej podstronie
├── static/
│   ├── style.css                # design system z dark mode (CSS variables)
│   └── script.js                # frontend (vanilla JS w namespace'ach)
├── requirements.txt
└── README.md
```

## Uruchomienie

```bash
pip install -r requirements.txt
python app.py
```

Aplikacja: http://127.0.0.1:5000

## Testy

```bash
pytest tests/ -v
```

## Zastrzeżenia

Wszystkie obliczenia są uproszczone (ZUS / PIT 2025–2026, podstawowe KUP).
Pomijają ulgi 4+, IP Box, PPK, koszty autorskie 50%, Mały ZUS Plus, drugą umowę itp.
Do oficjalnych celów księgowych użyj kalkulatora z gov.pl.

#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

SOURCE = "FRED MORTGAGE30US"
SOURCE_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US"
OUTPUT_PATH = Path("public/rates/mortgage30us.json")
APP_DATA_PATH = Path("src/data/mortgage30us.json")


def fetch_csv() -> str:
    headers = {
        "Accept": "text/csv,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": (
            "Mozilla/5.0 (compatible; mortgage-calculator-rate-updater/1.0; "
            "+https://github.com/actions)"
        ),
    }

    for attempt in range(1, 4):
        try:
            response = requests.get(SOURCE_URL, headers=headers, timeout=(10, 90))
            response.raise_for_status()
            return response.text
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(attempt * 5)

    raise RuntimeError("Failed to fetch FRED CSV")


def latest_rate(csv_text: str) -> tuple[str, float]:
    rows = list(csv.DictReader(csv_text.splitlines()))

    for row in reversed(rows):
        date = row.get("observation_date", "").strip()
        value = row.get("MORTGAGE30US", "").strip()

        if not date or value == ".":
            continue

        try:
            rate = float(value)
        except ValueError:
            continue

        if rate >= 0:
            return date, rate

    raise ValueError("No valid MORTGAGE30US observation found")


def main() -> None:
    date, rate = latest_rate(fetch_csv())
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    APP_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": SOURCE,
        "sourceUrl": SOURCE_URL,
        "date": date,
        "rate": rate,
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    json_text = f"{json.dumps(payload, indent=2)}\n"

    OUTPUT_PATH.write_text(json_text, encoding="utf-8")
    APP_DATA_PATH.write_text(json_text, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} and {APP_DATA_PATH} with {SOURCE} {rate} from {date}")


if __name__ == "__main__":
    main()

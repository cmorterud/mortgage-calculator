#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = "FRED MORTGAGE30US"
SOURCE_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US"
OUTPUT_PATH = Path("public/rates/mortgage30us.json")


def fetch_csv() -> str:
    request = Request(SOURCE_URL, headers={"User-Agent": "mortgage-calculator-rate-updater"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


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
    payload = {
        "source": SOURCE,
        "sourceUrl": SOURCE_URL,
        "date": date,
        "rate": rate,
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    OUTPUT_PATH.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {SOURCE} {rate} from {date}")


if __name__ == "__main__":
    main()

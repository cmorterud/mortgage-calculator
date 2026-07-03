import type { RateLookupResult } from "./types";

const RATE_WARNING = "Could not fetch the latest national average rate. Enter a rate manually.";
const FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US";

export async function fetchLatestThirtyYearFixedRate(): Promise<RateLookupResult> {
  try {
    const response = await fetch(FRED_CSV_URL, { headers: { Accept: "text/csv" } });

    if (!response.ok) {
      throw new Error(`Rate request failed with ${response.status}`);
    }

    const latest = parseLatestFredCsvObservation(await response.text());

    if (!latest) {
      throw new Error("Rate response did not include a usable rate");
    }

    return {
      rate: latest.rate,
      source: "FRED MORTGAGE30US",
      asOf: latest.date,
      warning: null,
    };
  } catch {
    return {
      rate: null,
      source: "FRED MORTGAGE30US",
      asOf: null,
      warning: RATE_WARNING,
    };
  }
}

export function parseLatestFredCsvObservation(csv: string): { date: string; rate: number } | null {
  const rows = csv.trim().split(/\r?\n/).slice(1).reverse();

  for (const row of rows) {
    const [date, value] = row.split(",");
    const rate = Number(value);

    if (date && Number.isFinite(rate) && rate >= 0) {
      return { date, rate };
    }
  }

  return null;
}

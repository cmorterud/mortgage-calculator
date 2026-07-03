import type { RateLookupResult } from "./types";

const RATE_WARNING = "Could not fetch the latest national average rate. Enter a rate manually.";

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations?: FredObservation[];
}

export async function fetchLatestThirtyYearFixedRate(): Promise<RateLookupResult> {
  try {
    const response = await fetch(
      "https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&file_type=json&sort_order=desc&limit=1",
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      throw new Error(`Rate request failed with ${response.status}`);
    }

    const data = (await response.json()) as FredResponse;
    const latest = data.observations?.find((observation) => observation.value !== ".");
    const rate = latest ? Number(latest.value) : Number.NaN;

    if (!latest || !Number.isFinite(rate) || rate < 0) {
      throw new Error("Rate response did not include a usable rate");
    }

    return {
      rate,
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

import staticMortgageRate from "./data/mortgage30us.json";
import type { StaticRateResult } from "./types";

const RATE_WARNING = "Could not load the latest national average rate. Enter a rate manually.";

interface StaticMortgageRate {
  source: string;
  sourceUrl: string;
  date: string;
  rate: number;
  fetchedAt: string;
}


export function getStaticThirtyYearFixedRate(): StaticRateResult {
  const rateFile = validateStaticMortgageRate(staticMortgageRate);

  if (!rateFile) {
    return {
      rate: null,
      source: "FRED MORTGAGE30US",
      asOf: null,
      fetchedAt: null,
      warning: RATE_WARNING,
    };
  }

  return {
    rate: rateFile.rate,
    source: rateFile.source,
    asOf: rateFile.date,
    fetchedAt: rateFile.fetchedAt,
    warning: null,
  };
}

export function getDefaultInterestRate(fallbackRate: number): number {
  return getStaticThirtyYearFixedRate().rate ?? fallbackRate;
}

export function validateStaticMortgageRate(
  value: unknown,
): StaticMortgageRate | null {
  if (!isStaticMortgageRate(value)) {
    return null;
  }

  if (!isIsoDate(value.date) || Number.isNaN(Date.parse(value.fetchedAt))) {
    return null;
  }

  return value;
}

function isStaticMortgageRate(value: unknown): value is StaticMortgageRate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.source === "FRED MORTGAGE30US" &&
    typeof candidate.sourceUrl === "string" &&
    typeof candidate.date === "string" &&
    typeof candidate.rate === "number" &&
    Number.isFinite(candidate.rate) &&
    candidate.rate >= 0 &&
    typeof candidate.fetchedAt === "string"
  );
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

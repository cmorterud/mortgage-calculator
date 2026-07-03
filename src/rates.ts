import staticMortgageRate from "./data/mortgage30us.json";
import type { RateLookupResult } from "./types";

const RATE_WARNING = "Could not load the latest national average rate. Enter a rate manually.";
const MAX_RATE_FILE_AGE_DAYS = 14;

interface StaticMortgageRate {
  source: string;
  sourceUrl: string;
  date: string;
  rate: number;
  fetchedAt: string;
}


export function getStaticThirtyYearFixedRate(): RateLookupResult {
  const rateFile = validateStaticMortgageRate(staticMortgageRate);

  if (!rateFile) {
    return {
      rate: null,
      source: "FRED MORTGAGE30US",
      asOf: null,
      warning: RATE_WARNING,
    };
  }

  return {
    rate: rateFile.rate,
    source: rateFile.source,
    asOf: rateFile.date,
    warning: null,
  };
}

export function validateStaticMortgageRate(
  value: unknown,
  now = new Date(),
): StaticMortgageRate | null {
  if (!isStaticMortgageRate(value)) {
    return null;
  }

  if (!isIsoDate(value.date) || !isRecentIsoTimestamp(value.fetchedAt, now)) {
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

function isRecentIsoTimestamp(value: string, now: Date): boolean {
  const fetchedAt = Date.parse(value);

  if (Number.isNaN(fetchedAt) || fetchedAt > now.getTime() + 60_000) {
    return false;
  }

  const ageMs = now.getTime() - fetchedAt;
  return ageMs <= MAX_RATE_FILE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

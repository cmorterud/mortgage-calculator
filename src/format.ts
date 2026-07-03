export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return "$0";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${value.toFixed(fractionDigits).replace(/\.?0+$/, "")}%`;
}

export function formatMonthsAsYearsAndMonths(months: number): string {
  if (!Number.isFinite(months) || months <= 0) {
    return "0 months";
  }

  const roundedMonths = Math.round(months);
  const years = Math.floor(roundedMonths / 12);
  const remainingMonths = roundedMonths % 12;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  }

  if (remainingMonths > 0) {
    parts.push(`${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`);
  }

  return parts.join(", ") || "0 months";
}

export function parseNumberInput(value: string): number {
  const cleaned = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (cleaned === "") {
    return 0;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

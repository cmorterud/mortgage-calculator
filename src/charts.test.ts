import { describe, expect, it } from "vitest";
import { getYearlyChartData } from "./charts";
import type { AmortizationSummaryYear } from "./types";

describe("chart data helpers", () => {
  it("maps yearly amortization summary into chart-ready values", () => {
    const yearlySummary: AmortizationSummaryYear[] = [
      {
        year: 1,
        endingBalance: 395000,
        principalPaid: 5000,
        interestPaid: 26000,
      },
      {
        year: 2,
        endingBalance: 389500,
        principalPaid: 5500,
        interestPaid: 25500,
      },
    ];

    expect(getYearlyChartData(yearlySummary)).toEqual([
      {
        year: 1,
        endingBalance: 395000,
        principalPaid: 5000,
        interestPaid: 26000,
      },
      {
        year: 2,
        endingBalance: 389500,
        principalPaid: 5500,
        interestPaid: 25500,
      },
    ]);
  });
});

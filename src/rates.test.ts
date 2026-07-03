import { describe, expect, it } from "vitest";
import { validateStaticMortgageRate } from "./rates";

const validRateFile = {
  source: "FRED MORTGAGE30US",
  sourceUrl: "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US",
  date: "2026-06-25",
  rate: 6.43,
  fetchedAt: "2026-07-03T12:00:00.000Z",
};

describe("static mortgage rate data", () => {
  it("accepts a valid rate file", () => {
    expect(validateStaticMortgageRate(validRateFile)).toEqual(validRateFile);
  });

  it("rejects malformed rate data", () => {
    expect(
      validateStaticMortgageRate(
        { ...validRateFile, rate: "6.43" },
      ),
    ).toBeNull();
  });
});

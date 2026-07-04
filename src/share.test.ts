import { describe, expect, it } from "vitest";
import { buildShareUrl, decodeShareState, encodeShareState, SHARE_PARAM } from "./share";
import type { MortgageInput } from "./types";

const input: MortgageInput = {
  homePrice: 400000,
  downPaymentMode: "percent",
  downPaymentPercent: 20,
  downPaymentAmount: 80000,
  mortgageType: "15-year-fixed-conventional",
  manualInterestRate: 6.43,
  propertyTaxMode: "percent",
  propertyTaxPercent: 1.25,
  propertyTaxAnnualAmount: 5000,
  insuranceMode: "annualAmount",
  insurancePercent: 0.35,
  insuranceAnnualAmount: 1400,
  pmiMode: "auto",
  pmiAnnualPercent: 0.5,
  hoaAmount: 100,
  hoaFrequency: "monthly",
  extraMonthlyPrincipal: 250,
};

describe("share state", () => {
  it("round-trips calculator input through the share parameter", () => {
    expect(decodeShareState(encodeShareState(input))).toMatchObject({
      homePrice: 400000,
      mortgageType: "15-year-fixed-conventional",
      extraMonthlyPrincipal: 250,
    });
  });

  it("builds a URL that contains the encoded view state", () => {
    const url = new URL(buildShareUrl(input, "https://codymorterud.com/mortgage-calculator/?old=1"));

    expect(url.searchParams.get("old")).toBe("1");
    expect(decodeShareState(url.searchParams.get(SHARE_PARAM))?.extraMonthlyPrincipal).toBe(250);
  });
});

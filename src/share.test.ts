import { describe, expect, it } from "vitest";
import { buildShareUrl, decodeSharedView, encodeSharedView, SHARE_PARAM } from "./share";
import type { MortgageInput } from "./types";

const input: MortgageInput = {
  homePrice: 425000,
  downPaymentMode: "amount",
  downPaymentPercent: 20,
  downPaymentAmount: 85000,
  mortgageType: "15-year-fixed-conventional",
  manualInterestRate: 6.43,
  propertyTaxMode: "percent",
  propertyTaxPercent: 1.5,
  propertyTaxAnnualAmount: 6375,
  insuranceMode: "annualAmount",
  insurancePercent: 0.35,
  insuranceAnnualAmount: 1500,
  pmiMode: "auto",
  pmiAnnualPercent: 0.5,
  hoaAmount: 120,
  hoaFrequency: "monthly",
  extraMonthlyPrincipal: 300,
};

describe("shared view state", () => {
  it("round-trips calculator inputs and chart mode", () => {
    expect(decodeSharedView(encodeSharedView({ input, chartMode: "principalInterest" }))).toMatchObject({
      chartMode: "principalInterest",
      input: {
        homePrice: 425000,
        downPaymentMode: "amount",
        mortgageType: "15-year-fixed-conventional",
        extraMonthlyPrincipal: 300,
      },
    });
  });

  it("builds a URL with the encoded view parameter", () => {
    const url = new URL(buildShareUrl({ input, chartMode: "balance" }, "https://codymorterud.com/mortgage-calculator/"));

    expect(decodeSharedView(url.searchParams.get(SHARE_PARAM))?.input.homePrice).toBe(425000);
  });
});

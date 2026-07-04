import { describe, expect, it } from "vitest";
import { buildShareUrl, decodeShareState, encodeShareState, SHARE_PARAM } from "./share";
import type { AppState } from "./types";

const state: AppState = {
  activeScenarioId: "scenario-2",
  scenarios: [
    {
      id: "scenario-1",
      name: "Base",
      input: {
        homePrice: 400000,
        downPaymentMode: "percent",
        downPaymentPercent: 20,
        downPaymentAmount: 80000,
        mortgageType: "30-year-fixed-conventional",
        manualInterestRate: 6.43,
        propertyTaxMode: "percent",
        propertyTaxPercent: 1.25,
        propertyTaxAnnualAmount: 5000,
        insuranceMode: "annualAmount",
        insurancePercent: 0.35,
        insuranceAnnualAmount: 1400,
        pmiMode: "auto",
        pmiAnnualPercent: 0.5,
        hoaAmount: 0,
        hoaFrequency: "monthly",
        extraMonthlyPrincipal: 0,
      },
      validationErrors: [],
    },
    {
      id: "scenario-2",
      name: "Extra principal",
      input: {
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
      },
      validationErrors: [],
    },
  ],
};

describe("share state", () => {
  it("round-trips scenarios and active scenario through the share parameter", () => {
    expect(decodeShareState(encodeShareState(state))).toMatchObject({
      activeScenarioId: "scenario-2",
      scenarios: [
        { id: "scenario-1", name: "Base" },
        { id: "scenario-2", name: "Extra principal" },
      ],
    });
  });

  it("builds a URL that contains the encoded view state", () => {
    const url = new URL(buildShareUrl(state, "https://codymorterud.com/mortgage-calculator/?old=1"));

    expect(url.searchParams.get("old")).toBe("1");
    expect(decodeShareState(url.searchParams.get(SHARE_PARAM))?.activeScenarioId).toBe("scenario-2");
  });
});

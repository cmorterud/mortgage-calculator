import {
  amortizeLoan,
  calculateDownPayment,
  calculateMortgage,
  calculateMonthlyPrincipalAndInterest,
  calculatePmiAnnual,
  getMortgageTermYears,
  normalizeHoaToMonthly,
} from "./calculations";
import type { MortgageInput } from "./types";
import { describe, expect, it } from "vitest";

describe("mortgage calculations", () => {
  it("calculates a fixed-rate mortgage payment", () => {
    const payment = calculateMonthlyPrincipalAndInterest(320000, 6.75);
    expect(payment).toBeCloseTo(2075.51, 2);
  });

  it("handles 0% interest", () => {
    const payment = calculateMonthlyPrincipalAndInterest(360000, 0);
    expect(payment).toBe(1000);
  });

  it("maps mortgage type to term years", () => {
    expect(getMortgageTermYears("30-year-fixed-conventional")).toBe(30);
    expect(getMortgageTermYears("15-year-fixed-conventional")).toBe(15);
  });

  it("normalizes HOA dues to monthly", () => {
    expect(normalizeHoaToMonthly(300, "monthly")).toBe(300);
    expect(normalizeHoaToMonthly(900, "quarterly")).toBe(300);
    expect(normalizeHoaToMonthly(3600, "annually")).toBe(300);
  });

  it("calculates down payment percent and amount", () => {
    expect(calculateDownPayment(400000, "percent", 20)).toEqual({ amount: 80000, percent: 20 });
    expect(calculateDownPayment(400000, "amount", 100000)).toEqual({ amount: 100000, percent: 25 });
  });

  it("pays off faster and saves interest with extra payments", () => {
    const scheduledMonthlyPayment = calculateMonthlyPrincipalAndInterest(320000, 6.75);
    const baseline = amortizeLoan({
      loanAmount: 320000,
      annualInterestRate: 6.75,
      termYears: 30,
      scheduledMonthlyPayment,
      extraMonthlyPrincipal: 0,
    });
    const accelerated = amortizeLoan({
      loanAmount: 320000,
      annualInterestRate: 6.75,
      termYears: 30,
      scheduledMonthlyPayment,
      extraMonthlyPrincipal: 300,
    });

    expect(accelerated.payoffMonths).toBeLessThan(baseline.payoffMonths);
    expect(baseline.totalInterest - accelerated.totalInterest).toBeGreaterThan(0);
  });

  it("uses 180 scheduled payments for a 15-year fixed mortgage", () => {
    const input: MortgageInput = {
      homePrice: 400000,
      downPaymentMode: "percent",
      downPaymentPercent: 20,
      downPaymentAmount: 80000,
      mortgageType: "15-year-fixed-conventional",
      manualInterestRate: 0,
      propertyTaxMode: "percent",
      propertyTaxPercent: 1.25,
      propertyTaxAnnualAmount: 5000,
      insuranceMode: "percent",
      insurancePercent: 0.35,
      insuranceAnnualAmount: 1400,
      pmiMode: "off",
      pmiAnnualPercent: 0.5,
      hoaAmount: 0,
      hoaFrequency: "monthly",
      extraMonthlyPrincipal: 0,
    };

    const result = calculateMortgage(input);

    expect(result.principalAndInterest).toBeCloseTo(320000 / 180, 2);
    expect(result.payoffMonths).toBe(180);
  });

  it("returns zero auto PMI when down payment is at least 20%", () => {
    const input: MortgageInput = {
      homePrice: 400000,
      downPaymentMode: "percent",
      downPaymentPercent: 20,
      downPaymentAmount: 80000,
      mortgageType: "30-year-fixed-conventional",
      manualInterestRate: 6.75,
      propertyTaxMode: "percent",
      propertyTaxPercent: 1.25,
      propertyTaxAnnualAmount: 5000,
      insuranceMode: "percent",
      insurancePercent: 0.35,
      insuranceAnnualAmount: 1400,
      pmiMode: "auto",
      pmiAnnualPercent: 0.5,
      hoaAmount: 0,
      hoaFrequency: "monthly",
      extraMonthlyPrincipal: 0,
    };

    expect(calculatePmiAnnual(input, 320000, 20)).toBe(0);
  });
});

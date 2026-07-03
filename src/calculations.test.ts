import {
  amortizeLoan,
  calculateDownPayment,
  calculateMonthlyPrincipalAndInterest,
  normalizeHoaToMonthly,
} from "./calculations";
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
});

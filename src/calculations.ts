import type {
  AmortizationRow,
  AmortizationSummaryYear,
  HoaFrequency,
  MortgageInput,
  MortgageResult,
  ValidationError,
} from "./types";

const TERM_YEARS = 30;
const NUMBER_OF_PAYMENTS = TERM_YEARS * 12;
const AUTO_PMI_ANNUAL_PERCENT = 0.5;

export function calculateDownPayment(
  homePrice: number,
  mode: "percent" | "amount",
  value: number,
): { amount: number; percent: number } {
  if (!Number.isFinite(homePrice) || homePrice <= 0 || !Number.isFinite(value)) {
    return { amount: 0, percent: 0 };
  }

  if (mode === "percent") {
    const amount = homePrice * (value / 100);
    return { amount, percent: value };
  }

  return {
    amount: value,
    percent: (value / homePrice) * 100,
  };
}

export function calculateMonthlyPrincipalAndInterest(
  loanAmount: number,
  annualInterestRate: number,
  numberOfPayments = NUMBER_OF_PAYMENTS,
): number {
  if (loanAmount <= 0) {
    return 0;
  }

  if (annualInterestRate === 0) {
    return loanAmount / numberOfPayments;
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const factor = (1 + monthlyRate) ** numberOfPayments;
  return loanAmount * ((monthlyRate * factor) / (factor - 1));
}

export function normalizeHoaToMonthly(amount: number, frequency: HoaFrequency): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  if (frequency === "quarterly") {
    return amount / 3;
  }

  if (frequency === "annually") {
    return amount / 12;
  }

  return amount;
}

export function calculatePropertyTaxAnnual(input: MortgageInput): number {
  if (input.propertyTaxMode === "annualAmount") {
    return input.propertyTaxAnnualAmount;
  }

  return input.homePrice * (input.propertyTaxPercent / 100);
}

export function calculateInsuranceAnnual(input: MortgageInput): number {
  if (input.insuranceMode === "annualAmount") {
    return input.insuranceAnnualAmount;
  }

  return input.homePrice * (input.insurancePercent / 100);
}

export function calculatePmiAnnual(input: MortgageInput, loanAmount: number, downPaymentPercent: number): number {
  if (input.pmiMode === "off") {
    return 0;
  }

  if (input.pmiMode === "manual") {
    return loanAmount * (input.pmiAnnualPercent / 100);
  }

  return downPaymentPercent < 20 ? loanAmount * (AUTO_PMI_ANNUAL_PERCENT / 100) : 0;
}

export function amortizeLoan(params: {
  loanAmount: number;
  annualInterestRate: number;
  termYears: number;
  scheduledMonthlyPayment: number;
  extraMonthlyPrincipal: number;
}): {
  payoffMonths: number;
  totalInterest: number;
  totalPrincipal: number;
  rows: AmortizationRow[];
} {
  const monthlyRate = params.annualInterestRate / 100 / 12;
  const maxMonths = params.termYears * 12 + 1200;
  let balance = Math.max(0, params.loanAmount);
  let totalInterest = 0;
  let totalPrincipal = 0;
  const rows: AmortizationRow[] = [];

  for (let month = 1; balance > 0.005 && month <= maxMonths; month += 1) {
    const startingBalance = balance;
    const interestPaid = monthlyRate === 0 ? 0 : startingBalance * monthlyRate;
    const scheduledPrincipal = Math.max(0, params.scheduledMonthlyPayment - interestPaid);
    const requestedExtra = Math.max(0, params.extraMonthlyPrincipal);
    const totalPrincipalForMonth = Math.min(startingBalance, scheduledPrincipal + requestedExtra);
    const extraPrincipalPaid = Math.max(0, totalPrincipalForMonth - scheduledPrincipal);

    balance = Math.max(0, startingBalance - totalPrincipalForMonth);
    totalInterest += interestPaid;
    totalPrincipal += totalPrincipalForMonth;

    rows.push({
      month,
      year: Math.ceil(month / 12),
      startingBalance,
      scheduledPayment: Math.min(params.scheduledMonthlyPayment, interestPaid + totalPrincipalForMonth),
      interestPaid,
      principalPaid: totalPrincipalForMonth - extraPrincipalPaid,
      extraPrincipalPaid,
      endingBalance: balance,
    });

    if (params.scheduledMonthlyPayment <= interestPaid && requestedExtra <= 0) {
      break;
    }
  }

  return {
    payoffMonths: rows.length,
    totalInterest,
    totalPrincipal,
    rows,
  };
}

export function summarizeAmortizationByYear(rows: AmortizationRow[]): AmortizationSummaryYear[] {
  const summaries = new Map<number, AmortizationSummaryYear>();

  for (const row of rows) {
    const existing =
      summaries.get(row.year) ??
      ({
        year: row.year,
        principalPaid: 0,
        interestPaid: 0,
        endingBalance: row.endingBalance,
      } satisfies AmortizationSummaryYear);

    existing.principalPaid += row.principalPaid + row.extraPrincipalPaid;
    existing.interestPaid += row.interestPaid;
    existing.endingBalance = row.endingBalance;
    summaries.set(row.year, existing);
  }

  return Array.from(summaries.values());
}

export function validateInput(input: MortgageInput): ValidationError[] {
  const errors: ValidationError[] = [];
  const downPaymentAmount =
    input.downPaymentMode === "percent"
      ? calculateDownPayment(input.homePrice, "percent", input.downPaymentPercent).amount
      : input.downPaymentAmount;

  if (!(input.homePrice > 0)) {
    errors.push({ field: "homePrice", message: "Home price must be greater than $0." });
  }

  if (downPaymentAmount < 0 || !Number.isFinite(downPaymentAmount)) {
    errors.push({ field: "downPaymentAmount", message: "Down payment cannot be negative." });
  }

  if (downPaymentAmount > input.homePrice) {
    errors.push({ field: "downPaymentAmount", message: "Down payment cannot exceed home price." });
  }

  if (input.downPaymentMode === "percent" && input.downPaymentPercent < 0) {
    errors.push({ field: "downPaymentPercent", message: "Down payment percent cannot be negative." });
  }

  if (input.manualInterestRate < 0 || !Number.isFinite(input.manualInterestRate)) {
    errors.push({ field: "manualInterestRate", message: "Interest rate cannot be negative." });
  }

  if (input.propertyTaxPercent < 0 || input.propertyTaxAnnualAmount < 0) {
    errors.push({ field: "propertyTaxPercent", message: "Property tax cannot be negative." });
  }

  if (input.insurancePercent < 0 || input.insuranceAnnualAmount < 0) {
    errors.push({ field: "insurancePercent", message: "Home insurance cannot be negative." });
  }

  if (input.pmiAnnualPercent < 0) {
    errors.push({ field: "pmiAnnualPercent", message: "PMI cannot be negative." });
  }

  if (input.hoaAmount < 0) {
    errors.push({ field: "hoaAmount", message: "HOA cannot be negative." });
  }

  if (input.extraMonthlyPrincipal < 0) {
    errors.push({ field: "extraMonthlyPrincipal", message: "Extra principal cannot be negative." });
  }

  return errors;
}

export function calculateMortgage(input: MortgageInput): MortgageResult {
  const downPayment = calculateDownPayment(
    input.homePrice,
    input.downPaymentMode,
    input.downPaymentMode === "percent" ? input.downPaymentPercent : input.downPaymentAmount,
  );
  const loanAmount = Math.max(0, input.homePrice - downPayment.amount);
  const interestRate = input.manualInterestRate;
  const principalAndInterest = calculateMonthlyPrincipalAndInterest(loanAmount, interestRate);
  const propertyTaxMonthly = calculatePropertyTaxAnnual(input) / 12;
  const insuranceMonthly = calculateInsuranceAnnual(input) / 12;
  const pmiMonthly = calculatePmiAnnual(input, loanAmount, downPayment.percent) / 12;
  const hoaMonthly = normalizeHoaToMonthly(input.hoaAmount, input.hoaFrequency);
  const mortgagePaymentSubtotal = principalAndInterest + propertyTaxMonthly + insuranceMonthly + pmiMonthly;
  const totalMonthlyHousingCost = mortgagePaymentSubtotal + hoaMonthly;
  const totalMonthlyWithExtra = totalMonthlyHousingCost + input.extraMonthlyPrincipal;

  const baseline = amortizeLoan({
    loanAmount,
    annualInterestRate: interestRate,
    termYears: TERM_YEARS,
    scheduledMonthlyPayment: principalAndInterest,
    extraMonthlyPrincipal: 0,
  });
  const accelerated = amortizeLoan({
    loanAmount,
    annualInterestRate: interestRate,
    termYears: TERM_YEARS,
    scheduledMonthlyPayment: principalAndInterest,
    extraMonthlyPrincipal: input.extraMonthlyPrincipal,
  });

  return {
    homePrice: input.homePrice,
    downPaymentAmount: downPayment.amount,
    downPaymentPercent: downPayment.percent,
    loanAmount,
    interestRate,
    principalAndInterest,
    propertyTaxMonthly,
    insuranceMonthly,
    pmiMonthly,
    hoaMonthly,
    mortgagePaymentSubtotal,
    totalMonthlyHousingCost,
    extraMonthlyPrincipal: input.extraMonthlyPrincipal,
    totalMonthlyWithExtra,
    payoffMonths: accelerated.payoffMonths,
    monthsSaved: Math.max(0, baseline.payoffMonths - accelerated.payoffMonths),
    totalInterest: accelerated.totalInterest,
    interestSaved: Math.max(0, baseline.totalInterest - accelerated.totalInterest),
    amortizationRows: accelerated.rows,
    baselineYearlySummary: summarizeAmortizationByYear(baseline.rows),
    yearlySummary: summarizeAmortizationByYear(accelerated.rows),
  };
}

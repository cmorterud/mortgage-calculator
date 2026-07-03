export type MortgageType = "30-year-fixed-conventional";
export type DownPaymentMode = "percent" | "amount";
export type RateMode = "manual" | "online";
export type PropertyTaxMode = "percent" | "annualAmount";
export type InsuranceMode = "percent" | "annualAmount";
export type PmiMode = "auto" | "manual" | "off";
export type HoaFrequency = "monthly" | "quarterly" | "annually";

export interface MortgageInput {
  homePrice: number;
  downPaymentMode: DownPaymentMode;
  downPaymentPercent: number;
  downPaymentAmount: number;
  mortgageType: MortgageType;
  rateMode: RateMode;
  manualInterestRate: number;
  onlineInterestRate: number | null;
  propertyTaxMode: PropertyTaxMode;
  propertyTaxPercent: number;
  propertyTaxAnnualAmount: number;
  insuranceMode: InsuranceMode;
  insurancePercent: number;
  insuranceAnnualAmount: number;
  pmiMode: PmiMode;
  pmiAnnualPercent: number;
  hoaAmount: number;
  hoaFrequency: HoaFrequency;
  extraMonthlyPrincipal: number;
}

export interface MortgageResult {
  homePrice: number;
  downPaymentAmount: number;
  downPaymentPercent: number;
  loanAmount: number;
  interestRate: number;
  principalAndInterest: number;
  propertyTaxMonthly: number;
  insuranceMonthly: number;
  pmiMonthly: number;
  hoaMonthly: number;
  mortgagePaymentSubtotal: number;
  totalMonthlyHousingCost: number;
  extraMonthlyPrincipal: number;
  totalMonthlyWithExtra: number;
  payoffMonths: number;
  monthsSaved: number;
  totalInterest: number;
  interestSaved: number;
  amortizationRows: AmortizationRow[];
  yearlySummary: AmortizationSummaryYear[];
}

export interface AmortizationRow {
  month: number;
  year: number;
  startingBalance: number;
  scheduledPayment: number;
  interestPaid: number;
  principalPaid: number;
  extraPrincipalPaid: number;
  endingBalance: number;
}

export interface AmortizationSummaryYear {
  year: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
}

export interface ValidationError {
  field: keyof MortgageInput;
  message: string;
}

export interface RateLookupResult {
  rate: number | null;
  source: string;
  asOf: string | null;
  warning: string | null;
}

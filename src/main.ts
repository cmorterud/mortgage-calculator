import {
  calculateDownPayment,
  calculateMortgage,
  validateInput,
} from "./calculations";
import { formatCurrency, formatMonthsAsYearsAndMonths, formatPercent, parseNumberInput } from "./format";
import { fetchLatestThirtyYearFixedRate } from "./rates";
import "./styles.css";
import type { MortgageInput, RateLookupResult, ValidationError } from "./types";

const STORAGE_KEY = "mortgage-calculator-inputs-v1";

const defaultInput: MortgageInput = {
  homePrice: 400000,
  downPaymentMode: "percent",
  downPaymentPercent: 20,
  downPaymentAmount: 80000,
  mortgageType: "30-year-fixed-conventional",
  rateMode: "manual",
  manualInterestRate: 6.75,
  onlineInterestRate: null,
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

let state = loadInput();
let rateLookup: RateLookupResult | null = null;

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <header class="page-header">
    <div>
      <p class="eyebrow">Personal mortgage planner</p>
      <h1>Mortgage calculator</h1>
      <p class="lede">Estimate total monthly housing cost and model how extra principal payments change payoff time.</p>
    </div>
    <button class="secondary-button" type="button" data-action="reset">Reset</button>
  </header>

  <form id="calculator-form" novalidate>
    <section class="panel">
      <h2>Home & Loan</h2>
      <div class="field-grid">
        ${numberField("homePrice", "Home price", "$", "400,000")}
        <label class="field">
          <span>Down payment mode</span>
          <select name="downPaymentMode">
            <option value="percent">Percent</option>
            <option value="amount">Dollar amount</option>
          </select>
        </label>
        ${numberField("downPaymentPercent", "Down payment percent", "%", "20")}
        ${numberField("downPaymentAmount", "Down payment amount", "$", "80,000")}
        <label class="field">
          <span>Mortgage type</span>
          <select name="mortgageType">
            <option value="30-year-fixed-conventional">30-year fixed conventional</option>
          </select>
        </label>
        <label class="field">
          <span>Rate source</span>
          <select name="rateMode">
            <option value="manual">Manual</option>
            <option value="online">Online national average</option>
          </select>
        </label>
        ${numberField("manualInterestRate", "Annual interest rate", "%", "6.75")}
      </div>
      <div class="inline-actions">
        <button class="secondary-button" type="button" data-action="fetch-rate">Fetch latest national average</button>
        <p class="helper" id="rate-status">Online rates are rough national averages, not personalized quotes.</p>
      </div>
    </section>

    <section class="panel">
      <h2>Taxes, Insurance, PMI, HOA</h2>
      <div class="field-grid">
        <label class="field">
          <span>Property tax mode</span>
          <select name="propertyTaxMode">
            <option value="percent">Percent of home value per year</option>
            <option value="annualAmount">Manual annual amount</option>
          </select>
        </label>
        ${numberField("propertyTaxPercent", "Property tax percent", "%", "1.25")}
        ${numberField("propertyTaxAnnualAmount", "Property tax annual amount", "$", "5,000")}
        <label class="field">
          <span>Insurance mode</span>
          <select name="insuranceMode">
            <option value="percent">Percent of home value per year</option>
            <option value="annualAmount">Manual annual amount</option>
          </select>
        </label>
        ${numberField("insurancePercent", "Insurance percent", "%", "0.35")}
        ${numberField("insuranceAnnualAmount", "Insurance annual amount", "$", "1,400")}
        <label class="field">
          <span>PMI mode</span>
          <select name="pmiMode">
            <option value="auto">Auto</option>
            <option value="manual">Manual annual percent of loan</option>
            <option value="off">Off</option>
          </select>
        </label>
        ${numberField("pmiAnnualPercent", "Manual PMI annual percent", "%", "0.5")}
        <label class="field">
          <span>HOA frequency</span>
          <select name="hoaFrequency">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </label>
        ${numberField("hoaAmount", "HOA amount for selected frequency", "$", "0")}
      </div>
      <div class="helper-list">
        <p class="helper">Insurance is only an estimate; replace it with a real quote when evaluating an actual property.</p>
        <p class="helper">PMI is simplified for planning and may differ from lender rules.</p>
        <p class="helper">HOA is included for budgeting but may not be escrowed.</p>
      </div>
    </section>

    <section class="panel">
      <h2>Extra Payments</h2>
      <div class="field-grid compact-grid">
        ${numberField("extraMonthlyPrincipal", "Extra monthly principal", "$", "0")}
      </div>
    </section>
  </form>

  <section class="results-panel" id="results" aria-live="polite"></section>
  <section class="panel" id="amortization"></section>
`;

const form = getRequiredElement<HTMLFormElement>("#calculator-form");
const results = getRequiredElement<HTMLElement>("#results");
const amortization = getRequiredElement<HTMLElement>("#amortization");
const rateStatus = getRequiredElement<HTMLElement>("#rate-status");

form.addEventListener("input", handleFormChange);
form.addEventListener("change", handleFormChange);
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const action = target.dataset.action;

  if (action === "reset") {
    localStorage.removeItem(STORAGE_KEY);
    state = { ...defaultInput };
    rateLookup = null;
    render();
  }

  if (action === "fetch-rate") {
    void updateOnlineRate();
  }
});

render();

function numberField(name: keyof MortgageInput, label: string, prefix: string, placeholder: string): string {
  return `
    <label class="field" for="${name}">
      <span>${label}</span>
      <span class="input-shell">
        <span aria-hidden="true">${prefix}</span>
        <input id="${name}" inputmode="decimal" name="${name}" placeholder="${placeholder}" autocomplete="off" />
      </span>
      <span class="error" data-error-for="${name}"></span>
    </label>
  `;
}

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required UI element not found: ${selector}`);
  }

  return element;
}

function handleFormChange(): void {
  const formData = new FormData(form);
  const next = { ...state };

  for (const key of Object.keys(defaultInput) as Array<keyof MortgageInput>) {
    const value = formData.get(key);
    if (value === null) {
      continue;
    }

    if (typeof defaultInput[key] === "number") {
      (next[key] as number) = parseNumberInput(String(value));
    } else {
      (next[key] as string) = String(value);
    }
  }

  if (next.downPaymentMode === "percent") {
    next.downPaymentAmount = calculateDownPayment(next.homePrice, "percent", next.downPaymentPercent).amount;
  } else {
    next.downPaymentPercent = calculateDownPayment(next.homePrice, "amount", next.downPaymentAmount).percent;
  }

  if (next.propertyTaxMode === "percent") {
    next.propertyTaxAnnualAmount = next.homePrice * (next.propertyTaxPercent / 100);
  } else if (next.homePrice > 0) {
    next.propertyTaxPercent = (next.propertyTaxAnnualAmount / next.homePrice) * 100;
  }

  if (next.insuranceMode === "percent") {
    next.insuranceAnnualAmount = next.homePrice * (next.insurancePercent / 100);
  } else if (next.homePrice > 0) {
    next.insurancePercent = (next.insuranceAnnualAmount / next.homePrice) * 100;
  }

  state = next;
  saveInput(state);
  render();
}

async function updateOnlineRate(): Promise<void> {
  rateStatus.textContent = "Fetching the latest national average rate...";
  const lookup = await fetchLatestThirtyYearFixedRate();
  rateLookup = lookup;

  if (lookup.rate !== null) {
    state = {
      ...state,
      rateMode: "online",
      onlineInterestRate: lookup.rate,
      manualInterestRate: lookup.rate,
    };
    saveInput(state);
  }

  render();
}

function render(): void {
  syncForm();
  const errors = validateInput(state);
  renderErrors(errors);
  renderRateStatus();

  if (errors.length > 0) {
    results.innerHTML = `
      <h2>Results</h2>
      <div class="empty-state">
        Fix the highlighted inputs to view mortgage estimates.
      </div>
    `;
    amortization.innerHTML = `<h2>Amortization Summary</h2><div class="empty-state">No amortization summary to show yet.</div>`;
    return;
  }

  const result = calculateMortgage(state);
  results.innerHTML = `
    <h2>Results</h2>
    <div class="headline-results">
      ${metric("Total monthly housing cost", formatCurrency(result.totalMonthlyHousingCost))}
      ${metric("With extra principal", formatCurrency(result.totalMonthlyWithExtra))}
      ${metric("Payoff time", formatMonthsAsYearsAndMonths(result.payoffMonths))}
      ${metric("Interest saved", formatCurrency(result.interestSaved))}
    </div>
    <div class="results-grid">
      ${resultRow("Home price", formatCurrency(result.homePrice))}
      ${resultRow("Down payment", `${formatCurrency(result.downPaymentAmount)} (${formatPercent(result.downPaymentPercent)})`)}
      ${resultRow("Loan amount", formatCurrency(result.loanAmount))}
      ${resultRow("Interest rate", formatPercent(result.interestRate))}
      ${resultRow("Monthly principal & interest", formatCurrency(result.principalAndInterest))}
      ${resultRow("Monthly property tax", formatCurrency(result.propertyTaxMonthly))}
      ${resultRow("Monthly home insurance", formatCurrency(result.insuranceMonthly))}
      ${resultRow("Monthly PMI", formatCurrency(result.pmiMonthly))}
      ${resultRow("Monthly HOA", formatCurrency(result.hoaMonthly))}
      ${resultRow("Mortgage payment subtotal", formatCurrency(result.mortgagePaymentSubtotal))}
      ${resultRow("Extra monthly principal", formatCurrency(result.extraMonthlyPrincipal))}
      ${resultRow("Time saved with extra payments", formatMonthsAsYearsAndMonths(result.monthsSaved))}
      ${resultRow("Total interest paid", formatCurrency(result.totalInterest))}
    </div>
  `;

  amortization.innerHTML = `
    <h2>Amortization Summary</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Principal paid</th>
            <th>Interest paid</th>
            <th>Ending balance</th>
          </tr>
        </thead>
        <tbody>
          ${result.yearlySummary.map((year) => `
            <tr>
              <td>${year.year}</td>
              <td>${formatCurrency(year.principalPaid)}</td>
              <td>${formatCurrency(year.interestPaid)}</td>
              <td>${formatCurrency(year.endingBalance)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function syncForm(): void {
  for (const [key, value] of Object.entries(state)) {
    const control = form.elements.namedItem(key);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.value = typeof value === "number" ? cleanNumber(value) : String(value ?? "");
    }
  }
}

function renderErrors(errors: ValidationError[]): void {
  document.querySelectorAll<HTMLElement>(".error").forEach((element) => {
    element.textContent = "";
  });

  for (const error of errors) {
    const element = document.querySelector<HTMLElement>(`[data-error-for="${error.field}"]`);
    if (element) {
      element.textContent = error.message;
    }
  }
}

function renderRateStatus(): void {
  if (rateLookup?.warning) {
    rateStatus.textContent = rateLookup.warning;
    rateStatus.classList.add("warning");
    return;
  }

  rateStatus.classList.remove("warning");

  if (rateLookup?.rate !== null && rateLookup?.rate !== undefined) {
    rateStatus.textContent = `Using ${formatPercent(rateLookup.rate)} from ${rateLookup.source}${rateLookup.asOf ? ` as of ${rateLookup.asOf}` : ""}. This is a national average, not a personalized quote.`;
    return;
  }

  rateStatus.textContent = "Online rates are rough national averages, not personalized quotes.";
}

function metric(label: string, value: string): string {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function resultRow(label: string, value: string): string {
  return `
    <div class="result-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function cleanNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return String(Math.round(value * 100) / 100);
}

function loadInput(): MortgageInput {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return { ...defaultInput };
    }

    return { ...defaultInput, ...(JSON.parse(saved) as Partial<MortgageInput>) };
  } catch {
    return { ...defaultInput };
  }
}

function saveInput(input: MortgageInput): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
}

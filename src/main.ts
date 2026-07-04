import {
  calculateDownPayment,
  calculateMortgage,
  validateInput,
} from "./calculations";
import {
  destroyAmortizationChart,
  renderAmortizationChart,
  type ChartMode,
} from "./charts";
import { formatCurrency, formatMonthsAsYearsAndMonths, formatPercent, parseNumberInput } from "./format";
import { getDefaultInterestRate, getStaticThirtyYearFixedRate } from "./rates";
import { buildShareUrl, decodeShareState, SHARE_PARAM } from "./share";
import "./styles.css";
import type {
  AppState,
  MortgageInput,
  Scenario,
  ScenarioComparisonRow,
  ValidationError,
} from "./types";

const STORAGE_KEY = "mortgage-calculator-state-v2";
const OLD_STORAGE_KEY = "mortgage-calculator-inputs-v1";
const MAX_SCENARIOS = 4;
const FALLBACK_INTEREST_RATE = 6.75;

const defaultInput: MortgageInput = {
  homePrice: 400000,
  downPaymentMode: "percent",
  downPaymentPercent: 20,
  downPaymentAmount: 80000,
  mortgageType: "30-year-fixed-conventional",
  manualInterestRate: getDefaultInterestRate(FALLBACK_INTEREST_RATE),
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

const comparisonRows: ScenarioComparisonRow[] = [
  {
    id: "homePrice",
    label: "Home price",
    format: "currency",
    getValue: (scenario) => scenario.input.homePrice,
  },
  {
    id: "downPayment",
    label: "Down payment",
    format: "currency",
    getValue: (scenario) => scenario.result?.downPaymentAmount ?? null,
  },
  {
    id: "downPaymentPercent",
    label: "Down payment percent",
    format: "percent",
    getValue: (scenario) => scenario.result?.downPaymentPercent ?? null,
  },
  {
    id: "loanAmount",
    label: "Loan amount",
    format: "currency",
    lowerIsBetter: true,
    getValue: (scenario) => scenario.result?.loanAmount ?? null,
    requiresValidResult: true,
  },
  {
    id: "interestRate",
    label: "Interest rate",
    format: "percent",
    getValue: (scenario) => scenario.input.manualInterestRate,
  },
  {
    id: "principalAndInterest",
    label: "Monthly principal & interest",
    format: "currency",
    getValue: (scenario) => scenario.result?.principalAndInterest ?? null,
    requiresValidResult: true,
  },
  {
    id: "taxes",
    label: "Monthly taxes",
    format: "currency",
    getValue: (scenario) => scenario.result?.propertyTaxMonthly ?? null,
    requiresValidResult: true,
  },
  {
    id: "insurance",
    label: "Monthly insurance",
    format: "currency",
    getValue: (scenario) => scenario.result?.insuranceMonthly ?? null,
    requiresValidResult: true,
  },
  {
    id: "pmi",
    label: "Monthly PMI",
    format: "currency",
    getValue: (scenario) => scenario.result?.pmiMonthly ?? null,
    requiresValidResult: true,
  },
  {
    id: "hoa",
    label: "Monthly HOA",
    format: "currency",
    getValue: (scenario) => scenario.result?.hoaMonthly ?? null,
    requiresValidResult: true,
  },
  {
    id: "baselineMonthly",
    label: "Baseline monthly housing cost",
    format: "currency",
    lowerIsBetter: true,
    getValue: (scenario) => scenario.result?.totalMonthlyHousingCost ?? null,
    requiresValidResult: true,
  },
  {
    id: "extraPrincipal",
    label: "Extra monthly principal",
    format: "currency",
    getValue: (scenario) => scenario.input.extraMonthlyPrincipal,
  },
  {
    id: "monthlyWithExtra",
    label: "Monthly cost including extra principal",
    format: "currency",
    getValue: (scenario) => scenario.result?.totalMonthlyWithExtra ?? null,
    requiresValidResult: true,
  },
  {
    id: "cashToClose",
    label: "Cash to close",
    format: "text",
    getValue: () => "Not estimated",
  },
  {
    id: "payoff",
    label: "Payoff time",
    format: "months",
    lowerIsBetter: true,
    getValue: (scenario) => scenario.result?.payoffMonths ?? null,
    requiresValidResult: true,
  },
  {
    id: "monthsSaved",
    label: "Months saved vs no-extra baseline",
    format: "months",
    getValue: (scenario) => scenario.result?.monthsSaved ?? null,
    requiresValidResult: true,
  },
  {
    id: "totalInterest",
    label: "Total interest paid",
    format: "currency",
    lowerIsBetter: true,
    getValue: (scenario) => scenario.result?.totalInterest ?? null,
    requiresValidResult: true,
  },
  {
    id: "interestSaved",
    label: "Interest saved vs no-extra baseline",
    format: "currency",
    higherIsBetter: true,
    getValue: (scenario) => scenario.result?.interestSaved ?? null,
    requiresValidResult: true,
  },
  {
    id: "totalPaid",
    label: "Total paid over loan life",
    format: "currency",
    lowerIsBetter: true,
    getValue: (scenario) =>
      scenario.result ? scenario.result.loanAmount + scenario.result.totalInterest : null,
    requiresValidResult: true,
  },
];

let rateLookup = getStaticThirtyYearFixedRate();
let appState = loadAppState();
let state = getActiveScenario().input;
let chartMode: ChartMode = "balance";

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
    <div class="header-controls">
      <div class="header-actions">
        <a class="secondary-button" href="https://codymorterud.com">Back to blog</a>
        <button class="secondary-button" type="button" data-action="share">Share view</button>
        <button class="secondary-button" type="button" data-action="reset">Reset</button>
      </div>
      <p class="share-status" id="share-status" aria-live="polite"></p>
    </div>
  </header>

  <section class="panel scenarios-panel">
    <div class="section-heading-row">
      <div>
        <h2>Scenarios</h2>
        <p class="helper chart-helper">Edit one scenario at a time, then compare them side-by-side.</p>
      </div>
      <div class="scenario-actions">
        <button class="secondary-button" type="button" data-action="add-scenario">Add scenario</button>
        <button class="secondary-button" type="button" data-action="duplicate-scenario">Duplicate</button>
        <button class="secondary-button" type="button" data-action="rename-scenario">Rename</button>
        <button class="secondary-button" type="button" data-action="delete-scenario">Delete</button>
      </div>
    </div>
    <div class="scenario-tabs" id="scenario-tabs" aria-label="Mortgage scenarios"></div>
  </section>

  <form id="calculator-form" novalidate>
    <section class="panel">
      <h2>Home & Loan</h2>
      <div class="field-grid loan-field-grid">
        ${numberField("homePrice", "Home price", "$", "400,000")}
        <label class="field">
          <span>Mortgage type</span>
          <select name="mortgageType">
            <option value="30-year-fixed-conventional">30-year fixed conventional</option>
            <option value="15-year-fixed-conventional">15-year fixed conventional</option>
          </select>
        </label>
        ${numberField("manualInterestRate", "Annual interest rate", "%", String(defaultInput.manualInterestRate))}
      </div>
      <div class="field-grid down-payment-grid">
        <label class="field">
          <span>Down payment mode</span>
          <select name="downPaymentMode">
            <option value="percent">Percent</option>
            <option value="amount">Dollar amount</option>
          </select>
        </label>
        ${numberField("downPaymentPercent", "Down payment percent", "%", "20")}
        ${numberField("downPaymentAmount", "Down payment amount", "$", "80,000")}
      </div>
      <p class="helper rate-helper" id="rate-status">Default rate comes from static FRED data updated by GitHub Actions. You can edit it.</p>
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
        ${numberField("propertyTaxPercent", "Property tax percent", "%", "1.25", {
          visibleWhenField: "propertyTaxMode",
          visibleWhenValue: "percent",
        })}
        ${numberField("propertyTaxAnnualAmount", "Property tax annual amount", "$", "5,000", {
          visibleWhenField: "propertyTaxMode",
          visibleWhenValue: "annualAmount",
        })}
        <label class="field">
          <span>Insurance mode</span>
          <select name="insuranceMode">
            <option value="percent">Percent of home value per year</option>
            <option value="annualAmount">Manual annual amount</option>
          </select>
        </label>
        ${numberField("insurancePercent", "Insurance percent", "%", "0.35", {
          visibleWhenField: "insuranceMode",
          visibleWhenValue: "percent",
        })}
        ${numberField("insuranceAnnualAmount", "Insurance annual amount", "$", "1,400", {
          visibleWhenField: "insuranceMode",
          visibleWhenValue: "annualAmount",
        })}
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
  <section class="panel" id="chart-section">
    <div class="section-heading-row">
      <div>
        <h2>Amortization chart</h2>
        <p class="helper chart-helper">Charts are based on the same amortization model as the table.</p>
      </div>
      <div class="segmented-control" aria-label="Chart mode">
        <button class="segment-button active" type="button" data-chart-mode="balance">Balance over time</button>
        <button class="segment-button" type="button" data-chart-mode="principalInterest">Principal vs interest by year</button>
      </div>
    </div>
    <div id="chart-empty" class="empty-state" hidden>No amortization chart to show yet.</div>
    <div id="chart-wrap" class="chart-wrap">
      <canvas id="amortization-chart"></canvas>
    </div>
  </section>
  <section class="panel" id="comparison"></section>
  <section class="panel" id="amortization"></section>
`;

const form = getRequiredElement<HTMLFormElement>("#calculator-form");
const scenarioTabs = getRequiredElement<HTMLElement>("#scenario-tabs");
const results = getRequiredElement<HTMLElement>("#results");
const comparison = getRequiredElement<HTMLElement>("#comparison");
const chartWrap = getRequiredElement<HTMLElement>("#chart-wrap");
const chartEmpty = getRequiredElement<HTMLElement>("#chart-empty");
const amortizationChart = getRequiredElement<HTMLCanvasElement>("#amortization-chart");
const amortization = getRequiredElement<HTMLElement>("#amortization");
const rateStatus = getRequiredElement<HTMLElement>("#rate-status");
const shareStatus = getRequiredElement<HTMLElement>("#share-status");

form.addEventListener("input", handleFormChange);
form.addEventListener("change", handleFormChange);
document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action], [data-chart-mode]");

  if (!target) {
    return;
  }

  const action = target.dataset.action;
  const scenarioId = target.dataset.scenarioId;
  const selectedChartMode = target.dataset.chartMode as ChartMode | undefined;

  if (action === "reset") {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY);
    clearShareParam();
    rateLookup = getStaticThirtyYearFixedRate();
    appState = createDefaultAppState();
    state = getActiveScenario().input;
    render();
  }

  if (action === "share") {
    void shareCurrentView();
  }

  if (action === "select-scenario" && scenarioId) {
    setActiveScenario(scenarioId);
  }

  if (action === "add-scenario") {
    addScenario();
  }

  if (action === "duplicate-scenario") {
    duplicateActiveScenario();
  }

  if (action === "delete-scenario") {
    deleteActiveScenario();
  }

  if (action === "rename-scenario") {
    renameActiveScenario();
  }

  if (selectedChartMode) {
    chartMode = selectedChartMode;
    render();
  }
});

render();

function numberField(
  name: keyof MortgageInput,
  label: string,
  prefix: string,
  placeholder: string,
  options: { visibleWhenField?: keyof MortgageInput; visibleWhenValue?: string } = {},
): string {
  const visibilityAttributes =
    options.visibleWhenField && options.visibleWhenValue
      ? ` data-visible-when-field="${options.visibleWhenField}" data-visible-when-value="${options.visibleWhenValue}"`
      : "";

  return `
    <label class="field" for="${name}"${visibilityAttributes}>
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

function createScenario(input: MortgageInput, name: string): Scenario {
  return {
    id: createScenarioId(),
    name,
    input: { ...input },
    validationErrors: [],
  };
}

function createDefaultAppState(): AppState {
  const scenario = createScenario(getDefaultInput(), "Scenario 1");

  return {
    scenarios: [scenario],
    activeScenarioId: scenario.id,
  };
}

function createScenarioId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `scenario-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getActiveScenario(): Scenario {
  return appState.scenarios.find((scenario) => scenario.id === appState.activeScenarioId) ?? appState.scenarios[0];
}

function updateActiveScenarioInput(input: MortgageInput): void {
  const activeScenario = getActiveScenario();
  activeScenario.input = { ...input };
}

function setActiveScenario(scenarioId: string): void {
  const scenario = appState.scenarios.find((candidate) => candidate.id === scenarioId);

  if (!scenario) {
    return;
  }

  appState.activeScenarioId = scenario.id;
  state = { ...scenario.input };
  saveAppState();
  render();
}

function addScenario(): void {
  if (appState.scenarios.length >= MAX_SCENARIOS) {
    return;
  }

  const scenario = createScenario(getActiveScenario().input, nextScenarioName());
  appState.scenarios.push(scenario);
  appState.activeScenarioId = scenario.id;
  state = { ...scenario.input };
  saveAppState();
  render();
}

function duplicateActiveScenario(): void {
  if (appState.scenarios.length >= MAX_SCENARIOS) {
    return;
  }

  const activeScenario = getActiveScenario();
  const scenario = createScenario(activeScenario.input, `${activeScenario.name} copy`);
  appState.scenarios.push(scenario);
  appState.activeScenarioId = scenario.id;
  state = { ...scenario.input };
  saveAppState();
  render();
}

function deleteActiveScenario(): void {
  if (appState.scenarios.length <= 1) {
    return;
  }

  const activeIndex = appState.scenarios.findIndex((scenario) => scenario.id === appState.activeScenarioId);
  const nextIndex = Math.max(0, activeIndex - 1);
  appState.scenarios = appState.scenarios.filter((scenario) => scenario.id !== appState.activeScenarioId);
  appState.activeScenarioId = appState.scenarios[nextIndex]?.id ?? appState.scenarios[0].id;
  state = { ...getActiveScenario().input };
  saveAppState();
  render();
}

function renameActiveScenario(): void {
  const activeScenario = getActiveScenario();
  const nextName = window.prompt("Scenario name", activeScenario.name)?.trim();

  if (!nextName) {
    return;
  }

  activeScenario.name = nextName;
  saveAppState();
  render();
}

function nextScenarioName(): string {
  for (let index = 1; index <= MAX_SCENARIOS; index += 1) {
    const name = `Scenario ${index}`;
    if (!appState.scenarios.some((scenario) => scenario.name === name)) {
      return name;
    }
  }

  return `Scenario ${appState.scenarios.length + 1}`;
}

function syncScenarioResults(): void {
  for (const scenario of appState.scenarios) {
    scenario.validationErrors = validateInput(scenario.input);
    scenario.result = scenario.validationErrors.length === 0 ? calculateMortgage(scenario.input) : undefined;
  }
}

function handleFormChange(): void {
  const formData = new FormData(form);
  const next = { ...state };

  for (const key of Object.keys(defaultInput) as Array<keyof MortgageInput>) {
    const value = formData.get(key);
    if (value === null) {
      continue;
    }

    if (key === "pmiAnnualPercent" && next.pmiMode !== "manual") {
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
  updateActiveScenarioInput(state);
  saveAppState();
  render();
}

function render(): void {
  syncScenarioResults();
  syncForm();
  syncConditionalFields();
  syncEditableFields();
  renderScenarioTabs();
  renderComparison();
  const activeScenario = getActiveScenario();
  const errors = activeScenario.validationErrors;
  renderErrors(errors);
  renderRateStatus();

  if (errors.length > 0) {
    renderChart(null);
    results.innerHTML = `
      <h2>Results</h2>
      <div class="empty-state">
        Fix the highlighted inputs to view mortgage estimates.
      </div>
    `;
    amortization.innerHTML = `<h2>Amortization Summary</h2><div class="empty-state">No amortization summary to show yet.</div>`;
    return;
  }

  const result = activeScenario.result ?? calculateMortgage(state);
  renderChart(result);
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

function renderChart(result: ReturnType<typeof calculateMortgage> | null): void {
  document.querySelectorAll<HTMLButtonElement>("[data-chart-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chartMode === chartMode);
  });

  const hasData = Boolean(result?.yearlySummary.length);
  chartEmpty.hidden = hasData;
  chartWrap.hidden = !hasData;

  if (!hasData) {
    destroyAmortizationChart();
    return;
  }

  renderAmortizationChart(amortizationChart, chartMode, result);
}

function renderScenarioTabs(): void {
  scenarioTabs.innerHTML = appState.scenarios
    .map((scenario) => {
      const isActive = scenario.id === appState.activeScenarioId;
      const invalidClass = scenario.validationErrors.length > 0 ? " invalid" : "";

      return `
        <button
          class="scenario-tab${isActive ? " active" : ""}${invalidClass}"
          type="button"
          data-action="select-scenario"
          data-scenario-id="${scenario.id}"
        >
          <span>${escapeHtml(scenario.name)}</span>
          ${scenario.validationErrors.length > 0 ? `<small>Invalid</small>` : ""}
        </button>
      `;
    })
    .join("");

  document.querySelectorAll<HTMLButtonElement>("[data-action='add-scenario']").forEach((button) => {
    button.disabled = appState.scenarios.length >= MAX_SCENARIOS;
  });
  document.querySelectorAll<HTMLButtonElement>("[data-action='duplicate-scenario']").forEach((button) => {
    button.disabled = appState.scenarios.length >= MAX_SCENARIOS;
  });
  document.querySelectorAll<HTMLButtonElement>("[data-action='delete-scenario']").forEach((button) => {
    button.disabled = appState.scenarios.length <= 1;
  });
}

function renderComparison(): void {
  if (appState.scenarios.length < 2) {
    comparison.innerHTML = `
      <div class="section-heading-row">
        <div>
          <h2>Scenario comparison</h2>
          <p class="helper chart-helper">Add another scenario to compare payment, payoff, and interest outcomes.</p>
        </div>
      </div>
    `;
    return;
  }

  const bestByRow = getBestScenarioIdsByRow();

  comparison.innerHTML = `
    <div class="section-heading-row">
      <div>
        <h2>Scenario comparison</h2>
        <p class="helper chart-helper">Extra principal is shown separately from required baseline housing cost.</p>
      </div>
    </div>
    <div class="comparison-wrap">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            ${appState.scenarios.map((scenario) => `<th>${escapeHtml(scenario.name)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${comparisonRows
            .map((row) => `
              <tr>
                <th>${row.label}</th>
                ${appState.scenarios.map((scenario) => comparisonCell(row, scenario, bestByRow.get(row.id))).join("")}
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function comparisonCell(row: ScenarioComparisonRow, scenario: Scenario, bestScenarioIds?: Set<string>): string {
  const isInvalid = row.requiresValidResult && scenario.validationErrors.length > 0;
  const value = isInvalid ? "Invalid input" : formatComparisonValue(row, row.getValue(scenario));
  const isBest = bestScenarioIds?.has(scenario.id) ?? false;

  return `
    <td class="${isBest ? "best-value" : ""}">
      <span>${value}</span>
      ${isBest ? `<small>Best</small>` : ""}
    </td>
  `;
}

function formatComparisonValue(row: ScenarioComparisonRow, value: number | string | null): string {
  if (value === null) {
    return "Invalid input";
  }

  if (typeof value === "string") {
    return escapeHtml(value);
  }

  if (!Number.isFinite(value)) {
    return "Invalid input";
  }

  if (row.format === "currency") {
    return formatCurrency(value);
  }

  if (row.format === "percent") {
    return formatPercent(value);
  }

  if (row.format === "months") {
    return formatMonthsAsYearsAndMonths(value);
  }

  return String(value);
}

function getBestScenarioIdsByRow(): Map<string, Set<string>> {
  const bestByRow = new Map<string, Set<string>>();

  for (const row of comparisonRows) {
    if (!row.lowerIsBetter && !row.higherIsBetter) {
      continue;
    }

    const values = appState.scenarios
      .map((scenario) => ({
        scenario,
        value: scenario.validationErrors.length > 0 && row.requiresValidResult ? null : row.getValue(scenario),
      }))
      .filter((entry): entry is { scenario: Scenario; value: number } =>
        typeof entry.value === "number" && Number.isFinite(entry.value),
      );

    if (values.length < 2) {
      continue;
    }

    const bestValue = row.lowerIsBetter
      ? Math.min(...values.map((entry) => entry.value))
      : Math.max(...values.map((entry) => entry.value));

    bestByRow.set(
      row.id,
      new Set(values.filter((entry) => entry.value === bestValue).map((entry) => entry.scenario.id)),
    );
  }

  return bestByRow;
}

function syncConditionalFields(): void {
  document.querySelectorAll<HTMLElement>("[data-visible-when-field]").forEach((element) => {
    const field = element.dataset.visibleWhenField as keyof MortgageInput | undefined;
    const value = element.dataset.visibleWhenValue;

    if (!field || value === undefined) {
      return;
    }

    element.hidden = String(state[field]) !== value;
  });
}

function syncEditableFields(): void {
  const readonlyFields = new Set<keyof MortgageInput>();

  if (state.downPaymentMode === "percent") {
    readonlyFields.add("downPaymentAmount");
  } else {
    readonlyFields.add("downPaymentPercent");
  }

  if (state.propertyTaxMode === "percent") {
    readonlyFields.add("propertyTaxAnnualAmount");
  } else {
    readonlyFields.add("propertyTaxPercent");
  }

  if (state.insuranceMode === "percent") {
    readonlyFields.add("insuranceAnnualAmount");
  } else {
    readonlyFields.add("insurancePercent");
  }

  if (state.pmiMode !== "manual") {
    readonlyFields.add("pmiAnnualPercent");
  }

  for (const key of Object.keys(defaultInput) as Array<keyof MortgageInput>) {
    const control = form.elements.namedItem(key);

    if (!(control instanceof HTMLInputElement)) {
      continue;
    }

    const isReadonly = readonlyFields.has(key);
    control.readOnly = isReadonly;
    control.setAttribute("aria-readonly", String(isReadonly));
    control.closest(".field")?.classList.toggle("readonly-field", isReadonly);
  }
}

function syncForm(): void {
  for (const [key, value] of Object.entries(state)) {
    const control = form.elements.namedItem(key);

    if (control instanceof HTMLInputElement && document.activeElement === control) {
      continue;
    }

    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.value = getControlDisplayValue(key as keyof MortgageInput, value);
    }
  }
}

function getControlDisplayValue(key: keyof MortgageInput, value: unknown): string {
  if (key === "pmiAnnualPercent" && state.pmiMode === "auto" && state.downPaymentPercent >= 20) {
    return "";
  }

  if (key === "pmiAnnualPercent" && state.pmiMode === "off") {
    return "";
  }

  if ((key === "hoaAmount" || key === "extraMonthlyPrincipal") && value === 0) {
    return "";
  }

  return typeof value === "number" ? cleanNumber(value) : String(value ?? "");
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
  if (rateLookup.warning) {
    rateStatus.textContent = rateLookup.warning;
    rateStatus.classList.add("warning");
    return;
  }

  rateStatus.classList.remove("warning");

  if (rateLookup.rate !== null) {
    const observationDate = rateLookup.asOf ? `Observation date: ${rateLookup.asOf}. ` : "";
    const refreshedAt = rateLookup.fetchedAt ? `Static data refreshed: ${formatRateRefreshDate(rateLookup.fetchedAt)}. ` : "";
    rateStatus.textContent = `${observationDate}${refreshedAt}Using latest available national average 30-year fixed rate from FRED. This is not a personalized lender quote.`;
    return;
  }

  rateStatus.textContent = "Default rate uses a fallback value because static FRED data is unavailable.";
}

function formatRateRefreshDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
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

function loadAppState(): AppState {
  try {
    const sharedState = decodeShareState(new URLSearchParams(window.location.search).get(SHARE_PARAM));
    if (sharedState) {
      return normalizeAppState(sharedState);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return normalizeAppState(JSON.parse(saved) as Partial<AppState>);
    }

    const oldInput = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldInput) {
      const scenario = createScenario(
        { ...getDefaultInput(), ...(JSON.parse(oldInput) as Partial<MortgageInput>) },
        "Scenario 1",
      );
      return {
        scenarios: [scenario],
        activeScenarioId: scenario.id,
      };
    }

    return createDefaultAppState();
  } catch {
    return createDefaultAppState();
  }
}

function normalizeAppState(saved: Partial<AppState>): AppState {
  const savedScenarios = Array.isArray(saved.scenarios) ? saved.scenarios : [];
  const scenarios = savedScenarios
    .slice(0, MAX_SCENARIOS)
    .map((scenario, index) =>
      createPersistedScenario(
        scenario.id,
        scenario.name || `Scenario ${index + 1}`,
        scenario.input,
      ),
    );

  if (scenarios.length === 0) {
    return createDefaultAppState();
  }

  const activeScenarioId = scenarios.some((scenario) => scenario.id === saved.activeScenarioId)
    ? String(saved.activeScenarioId)
    : scenarios[0].id;

  return { scenarios, activeScenarioId };
}

function createPersistedScenario(id: unknown, name: unknown, input: unknown): Scenario {
  return {
    id: typeof id === "string" && id ? id : createScenarioId(),
    name: typeof name === "string" && name ? name : "Scenario",
    input: { ...getDefaultInput(), ...(typeof input === "object" && input !== null ? input : {}) },
    validationErrors: [],
  };
}

function saveAppState(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeScenarioId: appState.activeScenarioId,
      scenarios: appState.scenarios.map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        input: scenario.input,
      })),
    }),
  );
}

async function shareCurrentView(): Promise<void> {
  const shareUrl = buildShareUrl(appState);

  try {
    await navigator.clipboard.writeText(shareUrl);
    shareStatus.textContent = "Share link copied.";
  } catch {
    shareStatus.textContent = shareUrl;
  }
}

function clearShareParam(): void {
  const url = new URL(window.location.href);

  if (!url.searchParams.has(SHARE_PARAM)) {
    return;
  }

  url.searchParams.delete(SHARE_PARAM);
  window.history.replaceState(null, "", url.toString());
}

function getDefaultInput(): MortgageInput {
  return {
    ...defaultInput,
    manualInterestRate: getDefaultInterestRate(FALLBACK_INTEREST_RATE),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

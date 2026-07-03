import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartOptions,
} from "chart.js";
import { formatCurrency } from "./format";
import type { AmortizationSummaryYear, MortgageResult } from "./types";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

export type ChartMode = "balance" | "principalInterest";

let activeChart: Chart | null = null;

export function renderAmortizationChart(
  canvas: HTMLCanvasElement,
  mode: ChartMode,
  result: MortgageResult | null,
): void {
  destroyAmortizationChart();

  if (!result || result.yearlySummary.length === 0) {
    return;
  }

  activeChart = new Chart(canvas, buildChartConfig(mode, result));
}

export function destroyAmortizationChart(): void {
  activeChart?.destroy();
  activeChart = null;
}

export function getYearlyChartData(
  yearlySummary: AmortizationSummaryYear[],
): Array<{
  year: number;
  endingBalance: number;
  principalPaid: number;
  interestPaid: number;
}> {
  return yearlySummary
    .map((year) => ({
      year: year.year,
      endingBalance: Math.max(0, finiteNumber(year.endingBalance)),
      principalPaid: Math.max(0, finiteNumber(year.principalPaid)),
      interestPaid: Math.max(0, finiteNumber(year.interestPaid)),
    }))
    .filter((year) =>
      [year.year, year.endingBalance, year.principalPaid, year.interestPaid].every(Number.isFinite),
    );
}

function buildChartConfig(mode: ChartMode, result: MortgageResult): ChartConfiguration {
  if (mode === "principalInterest") {
    return buildPrincipalInterestChartConfig(result);
  }

  return buildBalanceChartConfig(result);
}

function buildBalanceChartConfig(result: MortgageResult): ChartConfiguration<"line"> {
  const baseline = getYearlyChartData(result.baselineYearlySummary);
  const accelerated = getYearlyChartData(result.yearlySummary);
  const labels = buildYearLabels(Math.max(baseline.length, accelerated.length));
  const datasets = [
    {
      label: "Baseline / no extra payments",
      data: padBalances(baseline, labels.length),
      borderColor: "#476fdf",
      backgroundColor: "rgba(71, 111, 223, 0.12)",
      borderWidth: 2,
      pointRadius: 2,
      tension: 0.22,
    },
  ];

  if (result.extraMonthlyPrincipal > 0) {
    datasets.push({
      label: "With extra payments",
      data: padBalances(accelerated, labels.length),
      borderColor: "#1f8a5f",
      backgroundColor: "rgba(31, 138, 95, 0.12)",
      borderWidth: 2,
      pointRadius: 2,
      tension: 0.22,
    });
  }

  return {
    type: "line",
    data: { labels, datasets },
    options: commonChartOptions("Remaining loan balance"),
  };
}

function buildPrincipalInterestChartConfig(result: MortgageResult): ChartConfiguration<"bar"> {
  const yearly = getYearlyChartData(result.yearlySummary);

  return {
    type: "bar",
    data: {
      labels: yearly.map((year) => `Year ${year.year}`),
      datasets: [
        {
          label: "Principal paid",
          data: yearly.map((year) => year.principalPaid),
          backgroundColor: "#1f8a5f",
          stack: "payments",
        },
        {
          label: "Interest paid",
          data: yearly.map((year) => year.interestPaid),
          backgroundColor: "#d07a31",
          stack: "payments",
        },
      ],
    },
    options: {
      ...commonChartOptions("Dollars paid that year"),
      scales: {
        x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { callback: (value) => compactCurrency(Number(value)) },
        },
      },
    },
  };
}

function commonChartOptions(title: string): ChartOptions<"line"> & ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, boxHeight: 12, color: "#33423d" },
      },
      tooltip: {
        callbacks: {
          label: (item) => `${item.dataset.label}: ${formatCurrency(Number(item.parsed.y))}`,
        },
      },
    },
    scales: {
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: {
        beginAtZero: true,
        title: { display: true, text: title },
        ticks: { callback: (value) => compactCurrency(Number(value)) },
      },
    },
  } as ChartOptions<"line"> & ChartOptions<"bar">;
}

function buildYearLabels(yearCount: number): string[] {
  return Array.from({ length: yearCount }, (_, index) => `Year ${index + 1}`);
}

function padBalances(data: ReturnType<typeof getYearlyChartData>, length: number): number[] {
  return Array.from({ length }, (_, index) => data[index]?.endingBalance ?? 0);
}

function compactCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return "$0";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

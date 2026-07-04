import type { MortgageInput } from "./types";

export const SHARE_PARAM = "view";

export interface SharedViewState {
  input: Partial<MortgageInput>;
  chartMode: "balance" | "principalInterest";
}

interface EncodedSharedViewState extends SharedViewState {
  version: 1;
}

export function encodeSharedView(state: SharedViewState): string {
  return JSON.stringify({
    version: 1,
    input: state.input,
    chartMode: state.chartMode,
  } satisfies EncodedSharedViewState);
}

export function decodeSharedView(value: string | null): SharedViewState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<EncodedSharedViewState>;

    if (parsed.version !== 1 || typeof parsed.input !== "object" || parsed.input === null) {
      return null;
    }

    return {
      input: parsed.input,
      chartMode: parsed.chartMode === "principalInterest" ? "principalInterest" : "balance",
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(state: SharedViewState, href = window.location.href): string {
  const url = new URL(href);
  url.searchParams.set(SHARE_PARAM, encodeSharedView(state));
  return url.toString();
}

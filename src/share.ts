import type { AppState, MortgageInput } from "./types";

export const SHARE_PARAM = "view";

interface SharedAppState {
  version: 1;
  activeScenarioId: string;
  scenarios: Array<{
    id: string;
    name: string;
    input: unknown;
  }>;
}

export function encodeShareState(appState: AppState): string {
  const sharedState: SharedAppState = {
    version: 1,
    activeScenarioId: appState.activeScenarioId,
    scenarios: appState.scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      input: scenario.input,
    })),
  };

  return JSON.stringify(sharedState);
}

export function decodeShareState(value: string | null): Partial<AppState> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SharedAppState>;

    if (parsed.version !== 1 || !Array.isArray(parsed.scenarios)) {
      return null;
    }

    const scenarios = parsed.scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      input: scenario.input as Partial<MortgageInput>,
      validationErrors: [],
    })) as AppState["scenarios"];

    return {
      activeScenarioId: typeof parsed.activeScenarioId === "string" ? parsed.activeScenarioId : undefined,
      scenarios,
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(appState: AppState, href = window.location.href): string {
  const url = new URL(href);
  url.searchParams.set(SHARE_PARAM, encodeShareState(appState));
  return url.toString();
}

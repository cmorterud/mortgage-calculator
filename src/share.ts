import type { MortgageInput } from "./types";

export const SHARE_PARAM = "view";

interface SharedMortgageInput {
  version: 1;
  input: Partial<MortgageInput>;
}

export function encodeShareState(input: MortgageInput): string {
  const sharedState: SharedMortgageInput = {
    version: 1,
    input,
  };

  return JSON.stringify(sharedState);
}

export function decodeShareState(value: string | null): Partial<MortgageInput> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SharedMortgageInput>;

    if (parsed.version !== 1 || typeof parsed.input !== "object" || parsed.input === null) {
      return null;
    }

    return parsed.input;
  } catch {
    return null;
  }
}

export function buildShareUrl(input: MortgageInput, href = window.location.href): string {
  const url = new URL(href);
  url.searchParams.set(SHARE_PARAM, encodeShareState(input));
  return url.toString();
}

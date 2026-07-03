import { describe, expect, it } from "vitest";
import { parseLatestFredCsvObservation } from "./rates";

describe("rate lookup parsing", () => {
  it("parses the latest usable FRED CSV mortgage rate", () => {
    const csv = `observation_date,MORTGAGE30US
2026-01-01,6.5
2026-01-08,.
2026-01-15,6.25`;

    expect(parseLatestFredCsvObservation(csv)).toEqual({
      date: "2026-01-15",
      rate: 6.25,
    });
  });
});

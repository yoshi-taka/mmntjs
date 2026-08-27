import { describe, expect, test } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

describe("formatted offset parsing", () => {
  test("moment.utc preserves an offset token before a trailing literal", () => {
    const input = "2024-06-15T10:30:00+05:30 foo";
    const format = "YYYY-MM-DDTHH:mm:ssZ [foo]";

    const actual = moment.utc(input, format);
    const expected = originalMoment.utc(input, format);
    expect(actual.valueOf()).toBe(expected.valueOf());
    expect([actual.year(), actual.month(), actual.date(), actual.hour(), actual.minute()]).toEqual([
      expected.year(),
      expected.month(),
      expected.date(),
      expected.hour(),
      expected.minute(),
    ]);
  });

  test("internal parsed offset is not exposed and week overflow is reported", () => {
    const parsed = moment("2024-06-15T10:30:00+05:30", "YYYY-MM-DDTHH:mm:ssZ").parsingFlags();
    expect(parsed).not.toHaveProperty("parsedOffset");

    const invalidWeek = moment("2024-W54-1", "GGGG-[W]WW-E", true);
    expect(invalidWeek.isValid()).toBe(false);
    expect(invalidWeek.invalidAt()).toBe(7);
  });
});

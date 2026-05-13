import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";

/** Temporal oracle: parse with Temporal and return fields, or null if unavailable/unparseable */
function temporalParse(s: string): Record<string, unknown> | null {
  const T = (globalThis as Record<string, unknown>).Temporal as
    | {
        PlainDate: { from(s: string): { year: number; month: number; day: number } };
        PlainDateTime: {
          from(s: string): {
            year: number;
            month: number;
            day: number;
            hour: number;
            minute: number;
            second: number;
            millisecond: number;
          };
        };
        ZonedDateTime: {
          from(s: string): {
            year: number;
            month: number;
            day: number;
            hour: number;
            minute: number;
            second: number;
            millisecond: number;
            offsetNanoseconds: bigint;
          };
        };
      }
    | undefined;
  if (!T) {
    return null;
  }

  try {
    if (s.includes("T") || s.includes("t")) {
      try {
        const z = T.ZonedDateTime.from(s);
        return {
          year: z.year,
          month: z.month,
          day: z.day,
          hour: z.hour,
          minute: z.minute,
          second: z.second,
          millisecond: z.millisecond,
          offset: Math.round(Number(z.offsetNanoseconds) / 6e10),
        };
      } catch {
        const d = T.PlainDateTime.from(s);
        return {
          year: d.year,
          month: d.month,
          day: d.day,
          hour: d.hour,
          minute: d.minute,
          second: d.second,
          millisecond: d.millisecond,
        };
      }
    }
    const d = T.PlainDate.from(s);
    return { year: d.year, month: d.month, day: d.day };
  } catch {
    return null;
  }
}

function momentFields(s: string): Record<string, unknown> | null {
  const m = moment(s);
  if (!m.isValid()) {
    return null;
  }
  const r: Record<string, unknown> = {
    year: m.year(),
    month: m.month() + 1,
    day: m.date(),
    hour: m.hour(),
    minute: m.minute(),
    second: m.second(),
    millisecond: m.millisecond(),
  };
  if (m._offset !== 0) {
    r.offset = m._offset;
  }
  if (m._isUTC) {
    r._isUTC = true;
  }
  return r;
}

function fieldsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  for (const k of ["year", "month", "day", "hour", "minute", "second", "millisecond", "offset"]) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
}

const CASES: { input: string; note?: string; expectInvalid?: boolean; skipMoment?: boolean }[] = [
  // ---- Basic date ----
  { input: "2024-06-15", note: "standard date" },
  { input: "20240615", note: "compact date" },
  { input: "20240615T103000", note: "compact date+time" },
  { input: "2024-02-29", note: "leap year" },
  { input: "2023-02-28", note: "non-leap feb" },

  // ---- With time ----
  { input: "2024-06-15T10:30:00", note: "date+time" },
  { input: "20240615T103000", note: "compact date+time" },
  { input: "2024-06-15T10:30:45.123", note: "with ms" },
  { input: "2024-06-15T10:30:45.123456", note: "with fractional seconds" },

  // ---- Timezone / offset ----
  { input: "2024-06-15T10:30:00Z", note: "UTC Z" },
  { input: "2024-06-15T10:30:00+05:00", note: "positive offset" },
  { input: "2024-06-15T10:30:00-05:00", note: "negative offset" },
  { input: "2024-06-15T10:30:00+0530", note: "compact offset" },
  { input: "2024-06-15T10:30:00-0530", note: "negative compact offset" },

  // ---- Year variants ----
  { input: "0000-01-01", note: "year zero" },
  { input: "9999-12-31", note: "max year" },
  { input: "-000001-01-01", note: "negative year (6-digit)", skipMoment: true },
  { input: "+002024-06-15", note: "expanded year +", skipMoment: true },
  { input: "-002024-06-15", note: "expanded year -", skipMoment: true },

  // ---- Edge dates ----
  { input: "2024-01-01", note: "first day" },
  { input: "2024-12-31", note: "last day" },
  { input: "2024-01-31", note: "month end" },

  // ---- Month+day only, year+month only ----
  { input: "2024-06", note: "year-month (no day)", expectInvalid: true },

  // ---- With space separator ----
  { input: "2024-06-15 10:30:00", note: "space separator" },

  // ---- Non-ISO (should fall through) ----
  { input: "June 15, 2024", note: "named month (non-ISO)" },
  { input: "06/15/2024", note: "US format (non-ISO)" },
  { input: "", note: "empty", expectInvalid: true },
  { input: "invalid", note: "garbage", expectInvalid: true },
];

// Only run when Temporal is available
const hasTemporal = !!(globalThis as Record<string, unknown>).Temporal;

if (hasTemporal) {
  describe("ISO parse: mmntjs vs Temporal oracle", () => {
    for (const c of CASES) {
      test(c.note ?? c.input, () => {
        const temporal = temporalParse(c.input)!;
        const momentResult = momentFields(c.input);

        if (c.expectInvalid) {
          // Both should be invalid (but Temporal may reject sooner)
          expect(momentResult).toBeNull();
          return;
        }

        expect(momentResult).not.toBeNull();
        expect(temporal).not.toBeNull();

        const ok = fieldsEqual(momentResult!, temporal);
        if (!ok) {
          console.log(`Mismatch for ${c.input}:`);
          console.log("  mmntjs:", JSON.stringify(momentResult));
          console.log("  Temporal:", JSON.stringify(temporal));
        }
        expect(ok).toBe(true);
      });
    }
  });
} else {
  describe("ISO parse: mmntjs (no Temporal oracle)", () => {
    test("Temporal not available on Bun", () => {
      expect(hasTemporal).toBe(false);
    });
  });
}

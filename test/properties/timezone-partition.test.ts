import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { assertProp } from "./helpers";
import _moment from "../../src/index.ts";
import type { MomentStatic } from "../../src/entry/types";
import _originalMoment from "../../moment/moment";

const moment = _moment as unknown as MomentStatic;
type MomentFn = ((...args: unknown[]) => ReturnType<typeof _moment>) & {
  utc(...args: unknown[]): ReturnType<typeof _moment>;
  parseZone(...args: unknown[]): ReturnType<typeof _moment>;
};
const originalMoment = _originalMoment as unknown as MomentFn;

function compareMoments(mm: ReturnType<typeof _moment>, om: ReturnType<typeof _originalMoment>) {
  expect(mm.valueOf()).toBe(om.valueOf());
  expect(mm.utcOffset()).toBe(om.utcOffset());
  expect(mm.format()).toBe(om.format());
}

function sameOffset(a: number, b: number): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (isNaN(a) && isNaN(b)) {
    return true;
  }
  if (!isFinite(a) && !isFinite(b)) {
    return true;
  }
  if (a === 0 && b === 0) {
    return true;
  }
  return false;
}

function expectEqualOffset(actual: number, expected: number) {
  if (sameOffset(actual, expected)) {
    expect(true).toBe(true);
  } else {
    expect(actual).toBe(expected);
  }
}

// ============================================================
// EQUIVALENCE PARTITIONING: utcOffset() numeric input
// ============================================================
describe("EP: utcOffset() numeric input", () => {
  const eqSmall = fc.constantFrom(-15, -5, -1, 1, 5, 15);
  const eqLarge = fc.constantFrom(-720, -480, -240, -60, 60, 120, 420, 600, 840);
  const eqZero = fc.constantFrom(0);

  test("|offset| < 16 → treated as hours (×60)", () => {
    assertProp(
      fc.property(eqSmall, (n) => {
        if (n === 0) {
          return;
        }
        const m = moment("2024-06-15T12:00:00").utcOffset(n);
        const o = originalMoment("2024-06-15T12:00:00").utcOffset(n);
        expect(m.utcOffset()).toBe(o.utcOffset());
        expect(m.valueOf()).toBe(o.valueOf());
      }),
      { numRuns: 50 },
    );
  });

  test("|offset| >= 16 → treated as minutes (passthrough)", () => {
    assertProp(
      fc.property(eqLarge, (n) => {
        const m = moment("2024-06-15T12:00:00").utcOffset(n);
        const o = originalMoment("2024-06-15T12:00:00").utcOffset(n);
        expect(m.utcOffset()).toBe(o.utcOffset());
        expect(m.valueOf()).toBe(o.valueOf());
      }),
      { numRuns: 50 },
    );
  });

  test("offset = 0 → UTC", () => {
    assertProp(
      fc.property(eqZero, (_n) => {
        const m = moment("2024-06-15T12:00:00").utcOffset(0);
        const o = originalMoment("2024-06-15T12:00:00").utcOffset(0);
        expect(m.utcOffset()).toBe(0);
        expect(o.utcOffset()).toBe(0);
        expect(m.isUtc()).toBe(o.isUtc());
        expect(m.valueOf()).toBe(o.valueOf());
      }),
      { numRuns: 10 },
    );
  });
});

// ============================================================
// BOUNDARY VALUE ANALYSIS: utcOffset() input
// ============================================================
describe("BVA: utcOffset() numeric boundaries", () => {
  const boundaries = [-Infinity, -17, -16, -15, -1, 0, 1, 15, 16, 17, Infinity];

  for (const n of boundaries) {
    test(`utcOffset(${n}) matches moment.js`, () => {
      const m = moment("2024-06-15T12:00:00").utcOffset(n);
      const o = originalMoment("2024-06-15T12:00:00").utcOffset(n);
      expectEqualOffset(m.utcOffset(), o.utcOffset());
      if (isFinite(n)) {
        expect(m.valueOf()).toBe(o.valueOf());
      }
    });
  }
});

// ============================================================
// EQUIVALENCE PARTITIONING: utcOffset() string input
// ============================================================
describe("EP: utcOffset() string input", () => {
  const validOffsets = fc.constantFrom(
    "+00:00",
    "-00:00",
    "+0000",
    "-0000",
    "+01:00",
    "-01:00",
    "+0100",
    "-0100",
    "+05:30",
    "-05:30",
    "+0530",
    "-0530",
    "+12:00",
    "-12:00",
    "+1200",
    "-1200",
    "+14:00",
    "+1400",
  );

  const invalidOffsets = fc.constantFrom(
    "",
    "+",
    "-",
    "+0",
    "-0",
    "+ab:cd",
    "01:00",
    "abc",
    "+24:00",
    "-24:00",
  );

  test("valid offset strings match moment.js", () => {
    assertProp(
      fc.property(validOffsets, (s) => {
        const m = moment("2024-06-15T12:00:00").utcOffset(s);
        const o = originalMoment("2024-06-15T12:00:00").utcOffset(s);
        expectEqualOffset(m.utcOffset(), o.utcOffset());
        expect(m.valueOf()).toBe(o.valueOf());
      }),
      { numRuns: 50 },
    );
  });

  test("invalid offset strings → no-op (returns same moment)", () => {
    assertProp(
      fc.property(invalidOffsets, (s) => {
        const base = moment("2024-06-15T12:00:00");
        const v = base.valueOf();
        const m = base.utcOffset(s);
        expect(m.valueOf()).toBe(v);
      }),
      { numRuns: 50 },
    );
  });
});

// ============================================================
// BVA: utcOffset() string boundaries
// ============================================================
describe("BVA: utcOffset() string boundaries", () => {
  const cases: [string, number][] = [
    ["+00:00", 0],
    ["-00:00", 0],
    ["+0000", 0],
    ["-0000", 0],
    ["+00:01", 1],
    ["-00:01", -1],
    ["+0001", 1],
    ["-0001", -1],
    ["+00:15", 15],
    ["-00:15", -15],
    ["+00:16", 16],
    ["-00:16", -16],
    ["+14:00", 840],
    ["-12:00", -720],
    ["+23:59", 1439],
    ["-23:59", -1439],
  ];

  for (const [str, expected] of cases) {
    test(`utcOffset("${str}") => ${expected}`, () => {
      const m = moment("2024-06-15T12:00:00").utcOffset(str);
      const o = originalMoment("2024-06-15T12:00:00").utcOffset(str);
      expectEqualOffset(m.utcOffset(), o.utcOffset());
      expectEqualOffset(m.utcOffset(), expected);
    });
  }
});

// ============================================================
// EP + BVA: zone() input (sign inversion of utcOffset)
// ============================================================
describe("EP: zone() input", () => {
  test("zone() getter matches -utcOffset()", () => {
    assertProp(
      fc.property(fc.constantFrom(-720, -480, -240, -60, 60, 120, 420, 600, 840), (off) => {
        const m = moment("2024-06-15T12:00:00").utcOffset(off);
        const o = originalMoment("2024-06-15T12:00:00").utcOffset(off);
        expect(m.zone()).toBe(o.zone());
        expect(m.zone()).toBe(-m.utcOffset() || 0);
      }),
      { numRuns: 50 },
    );
  });

  test("zone(0) returns 0 and matches moment.js", () => {
    const m = moment("2024-06-15T12:00:00").utcOffset(0);
    const o = originalMoment("2024-06-15T12:00:00").utcOffset(0);
    expectEqualOffset(m.zone(), o.zone());
    expect(m.zone()).toBe(0);
  });

  const zoneInputs: [number, number][] = [
    [1, -60],
    [15, -900],
    [16, -16],
    [-1, 60],
    [-15, 900],
    [-16, 16],
  ];

  for (const [input, expectedOffset] of zoneInputs) {
    test(`zone(${input}) → utcOffset(${expectedOffset})`, () => {
      const m = moment("2024-06-15T12:00:00").zone(input);
      const o = originalMoment("2024-06-15T12:00:00").zone(input as never);
      expect(m.utcOffset()).toBe(o.utcOffset());
      expect(m.utcOffset()).toBe(expectedOffset);
    });
  }
});

// ============================================================
// EP: mode transitions preserve valueOf (no keepLocalTime)
// ============================================================
describe("EP: mode transitions preserve absolute time", () => {
  const baseTime = "2024-06-15T12:30:00";

  test("local → utc → local", () => {
    const m = moment(baseTime);
    const v = m.valueOf();
    m.utc();
    expect(m.valueOf()).toBe(v);
    m.local();
    expect(m.valueOf()).toBe(v);
  });

  test("utc → local → utc", () => {
    const m = moment.utc(baseTime);
    const v = m.valueOf();
    m.local();
    expect(m.valueOf()).toBe(v);
    m.utc();
    expect(m.valueOf()).toBe(v);
  });

  test("local → utcOffset(N) → utc → local", () => {
    const m = moment(baseTime);
    const v = m.valueOf();
    m.utcOffset(90);
    expect(m.valueOf()).toBe(v);
    m.utc();
    expect(m.valueOf()).toBe(v);
    m.local();
    expect(m.valueOf()).toBe(v);
  });

  test("utc → utcOffset(N) → utc", () => {
    const m = moment.utc(baseTime);
    const v = m.valueOf();
    m.utcOffset(-240);
    expect(m.valueOf()).toBe(v);
    m.utc();
    expect(m.valueOf()).toBe(v);
  });

  test("local → utcOffset(-720) → utcOffset(840) → local", () => {
    const m = moment(baseTime);
    const v = m.valueOf();
    m.utcOffset(-720);
    expect(m.valueOf()).toBe(v);
    m.utcOffset(840);
    expect(m.valueOf()).toBe(v);
    m.local();
    expect(m.valueOf()).toBe(v);
  });

  test("keepLocalTime changes absolute time", () => {
    const m = moment(baseTime);
    const v = m.valueOf();
    m.utcOffset(90, true);
    expect(m.valueOf()).not.toBe(v);
    expect(m.hours()).toBe(12);
    expect(m.minutes()).toBe(30);
  });
});

// ============================================================
// EP + BVA: keepLocalTime across all 3 mode-switch functions
// ============================================================
describe("EP: keepLocalTime preserves wall clock", () => {
  const wallTests: [
    label: string,
    setup: (m: ReturnType<typeof _moment>) => ReturnType<typeof _moment>,
  ][] = [
    ["local → utc(true)", (m) => m.clone().utc(true)],
    ["utc → local(true)", (m) => m.clone().local(true)],
    ["local → utcOffset(N, true)", (m) => m.clone().utcOffset(90, true)],
    ["fixed-offset → utc(true)", (m) => m.clone().utcOffset(90).utc(true)],
    ["fixed-offset → local(true)", (m) => m.clone().utcOffset(90).local(true)],
    ["utc → utcOffset(N, true)", (m) => m.clone().utcOffset(90, true)],
  ];

  for (const [label, fn] of wallTests) {
    test(`${label}: HH:mm:ss preserved`, () => {
      assertProp(
        fc.property(
          fc.constantFrom(
            "2024-06-15T12:30:45",
            "2024-01-01T00:00:00",
            "2024-12-31T23:59:59",
            "2024-03-10T02:30:00",
            "2024-11-03T01:30:00",
          ),
          (base) => {
            const m = moment(base);
            const o = originalMoment(base);
            const mm = fn(m);
            const om = fn(o as unknown as ReturnType<typeof _originalMoment>);
            expect(mm.format("HH:mm:ss")).toBe(om.format("HH:mm:ss"));
            expect(mm.format("YYYY-MM-DD")).toBe(om.format("YYYY-MM-DD"));
            expect(mm.utcOffset()).toBe(om.utcOffset());
          },
        ),
        { numRuns: 50 },
      );
    });
  }
});

// ============================================================
// BVA: keepLocalTime with boundary offset values
// ============================================================
describe("BVA: keepLocalTime with boundary offsets", () => {
  const boundaryOffsets = [-720, -480, -240, -60, 0, 60, 120, 420, 600, 840];

  for (const off of boundaryOffsets) {
    test(`utcOffset(${off}, true) preserves wall clock`, () => {
      const m = moment("2024-06-15T12:30:00");
      const o = originalMoment("2024-06-15T12:30:00");
      m.utcOffset(off, true);
      o.utcOffset(off, true);
      expect(m.format("HH:mm:ss")).toBe(o.format("HH:mm:ss"));
      expect(m.hours()).toBe(o.hours());
      expect(m.minutes()).toBe(o.minutes());
      expect(m.seconds()).toBe(o.seconds());
      expect(m.utcOffset()).toBe(o.utcOffset());
    });
  }
});

// ============================================================
// EP: format Z / ZZ tokens
// ============================================================
describe("EP: format Z / ZZ tokens", () => {
  const offsetCases: [number, string, string][] = [
    [0, "+00:00", "+0000"],
    [60, "+01:00", "+0100"],
    [-60, "-01:00", "-0100"],
    [330, "+05:30", "+0530"],
    [-330, "-05:30", "-0530"],
    [765, "+12:45", "+1245"],
    [-765, "-12:45", "-1245"],
    [90, "+01:30", "+0130"],
    [-90, "-01:30", "-0130"],
    [600, "+10:00", "+1000"],
    [-480, "-08:00", "-0800"],
  ];

  for (const [offset, expectedZ, expectedZZ] of offsetCases) {
    test(`Z / ZZ for offset ${offset}: ${expectedZ} / ${expectedZZ}`, () => {
      const m = moment.utc("2024-06-15T12:00:00").utcOffset(offset);
      const o = originalMoment.utc("2024-06-15T12:00:00").utcOffset(offset);
      expect(m.format("Z")).toBe(o.format("Z"));
      expect(m.format("ZZ")).toBe(o.format("ZZ"));
      expect(m.format("Z")).toBe(expectedZ);
      expect(m.format("ZZ")).toBe(expectedZZ);
    });
  }
});

// ============================================================
// BVA: format Z / ZZ edge cases
// ============================================================
describe("BVA: format Z/ZZ edge offsets", () => {
  const edgeOffsets = [-1440, -1439, -720, -1, 1, 720, 1439, 1440];

  for (const off of edgeOffsets) {
    test(`offset ${off}`, () => {
      const m = moment.utc("2024-06-15T12:00:00").utcOffset(off);
      const o = originalMoment.utc("2024-06-15T12:00:00").utcOffset(off);
      expect(m.format("Z")).toBe(o.format("Z"));
      expect(m.format("ZZ")).toBe(o.format("ZZ"));
    });
  }
});

// ============================================================
// EP: parseZone() input equivalence classes
// ============================================================
describe("EP: parseZone() input", () => {
  test("ISO string with +HH:mm offset", () => {
    const inputs = [
      "2013-01-01T00:00:00+09:00",
      "2013-01-01T05:00:00+05:30",
      "2013-01-01T00:00:00+14:00",
    ];
    for (const input of inputs) {
      compareMoments(moment.parseZone(input), originalMoment.parseZone(input));
    }
  });

  test("ISO string with -HH:mm offset", () => {
    const inputs = [
      "2013-01-01T00:00:00-13:00",
      "2013-01-01T00:00:00-05:00",
      "2013-01-01T00:00:00-12:00",
    ];
    for (const input of inputs) {
      compareMoments(moment.parseZone(input), originalMoment.parseZone(input));
    }
  });

  test("ISO string without offset → treated as UTC (+00:00)", () => {
    const inputs = ["2016-02-01T00:00:00", "2013-01-01T00:00:00"];
    for (const input of inputs) {
      const m = moment.parseZone(input);
      const o = originalMoment.parseZone(input);
      expect(m.utcOffset()).toBe(o.utcOffset());
      expect(m.utcOffset()).toBe(0);
      expect(m.format()).toBe(o.format());
    }
  });

  test("parseZone with format + ZZ token", () => {
    const inputs: [string, string][] = [
      ["2013 01 01 05 +09:00", "YYYY MM DD HH ZZ"],
      ["2013 01 01 05 -13:00", "YYYY MM DD HH ZZ"],
      ["2013-01-01 05 +0530", "YYYY-MM-DD HH ZZ"],
      ["2013-01-01 05 -0530", "YYYY-MM-DD HH ZZ"],
    ];
    for (const [input, fmt] of inputs) {
      compareMoments(moment.parseZone(input, fmt), originalMoment.parseZone(input, fmt));
    }
  });

  test("parseZone roundtrip: original offset preserved after clone", () => {
    assertProp(
      fc.property(
        fc.constantFrom(
          "2013-01-01T00:00:00-13:00",
          "2013-01-01T05:00:00+09:00",
          "2013-01-01T00:00:00+05:30",
        ),
        (input) => {
          const m = moment.parseZone(input);
          const o = originalMoment.parseZone(input);
          expect(m.utcOffset()).toBe(o.utcOffset());
          expect(m.clone().utcOffset()).toBe(o.clone().utcOffset());
          expect(m.clone().valueOf()).toBe(o.clone().valueOf());
        },
      ),
      { numRuns: 50 },
    );
  });

  test("parseZone with non-offset format → falls back to +00:00", () => {
    const m = moment.parseZone("2013 01 01 05 30", "YYYY MM DD HH mm");
    const o = originalMoment.parseZone("2013 01 01 05 30", "YYYY MM DD HH mm");
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.valueOf()).toBe(o.valueOf());
  });

  test("parseZone no argument → invalid", () => {
    const m = moment.parseZone(undefined as unknown);
    const o = originalMoment.parseZone(undefined as unknown);
    expect(m.isValid()).toBe(o.isValid());
  });

  test("parseZone with explicit moment", () => {
    const m = moment.parseZone("2013-01-01T00:00:00-13:00");
    const o = originalMoment.parseZone("2013-01-01T00:00:00-13:00");
    expect(m.format("YYYY-MM-DDTHH:mm:ssZ")).toBe(o.format("YYYY-MM-DDTHH:mm:ssZ"));
    expect(m.hours()).toBe(o.hours());
    expect(m.minutes()).toBe(o.minutes());
  });
});

// ============================================================
// BVA: parseZone() string offset extremes
// ============================================================
describe("BVA: parseZone() offset extremes", () => {
  const extremes = [
    ["-23:59", -1439],
    ["+23:59", 1439],
    ["-12:00", -720],
    ["+14:00", 840],
    ["-00:00", 0],
    ["+00:00", 0],
  ] as const;

  for (const [offsetStr, expected] of extremes) {
    test(`parseZone with offset ${offsetStr} → utcOffset ${expected}`, () => {
      const input = `2013-01-01T00:00:00${offsetStr}`;
      const m = moment.parseZone(input);
      const o = originalMoment.parseZone(input);
      expectEqualOffset(m.utcOffset(), o.utcOffset());
      expectEqualOffset(m.utcOffset(), expected);
      expect(m.hours()).toBe(o.hours());
    });
  }
});

// ============================================================
// EP: isDST() behavior
// ============================================================
describe("EP: isDST()", () => {
  test("UTC moment → always false", () => {
    assertProp(
      fc.property(
        fc.constantFrom("2024-01-15", "2024-06-15", "2024-03-10", "2024-11-03"),
        (date) => {
          expect(moment.utc(date).isDST()).toBe(false);
          expect(originalMoment.utc(date).isDST()).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  test("fixed-offset moment → always false", () => {
    assertProp(
      fc.property(
        fc.constantFrom("2024-01-15", "2024-06-15", "2024-03-10", "2024-11-03"),
        fc.constantFrom(-240, 60, 330),
        (date, off) => {
          expect(moment(date).utcOffset(off).isDST()).toBe(false);
          expect(originalMoment(date).utcOffset(off).isDST()).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  test("local moment matches moment.js", () => {
    assertProp(
      fc.property(
        fc.constantFrom(
          "2024-01-15",
          "2024-06-15",
          "2024-03-10",
          "2024-11-03",
          "2024-03-10T02:30:00",
          "2024-11-03T01:30:00",
        ),
        (date) => {
          expect(moment(date).isDST()).toBe(originalMoment(date).isDST());
        },
      ),
      { numRuns: 50 },
    );
  });

  test("isDST(false) returns isDST() value", () => {
    expect(moment().isDST()).toBe(originalMoment().isDST());
  });
});

// ============================================================
// EP: hasAlignedHourOffset()
// ============================================================
describe("EP: hasAlignedHourOffset()", () => {
  const aligned = fc.constantFrom(-480, -240, -60, 0, 60, 120, 420, 600);
  const nonAligned = fc.constantFrom(-450, -330, -90, 90, 330, 390, 765);

  test("aligned offsets → true with UTC", () => {
    assertProp(
      fc.property(aligned, (off) => {
        const m = moment("2024-06-15T12:00:00").utcOffset(off);
        const o = originalMoment("2024-06-15T12:00:00").utcOffset(off);
        expect(m.hasAlignedHourOffset()).toBe(o.hasAlignedHourOffset());
        expect(m.hasAlignedHourOffset()).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  test("non-aligned offsets → false with UTC", () => {
    assertProp(
      fc.property(nonAligned, (off) => {
        const m = moment("2024-06-15T12:00:00").utcOffset(off);
        const o = originalMoment("2024-06-15T12:00:00").utcOffset(off);
        expect(m.hasAlignedHourOffset()).toBe(o.hasAlignedHourOffset());
        expect(m.hasAlignedHourOffset()).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  test("two aligned offsets → true", () => {
    const m = moment("2024-06-15T12:00:00").utcOffset(-120);
    const o = originalMoment("2024-06-15T12:00:00").utcOffset(-120);
    const other1 = moment("2024-06-15T12:00:00").utcOffset(-180);
    const other2 = originalMoment("2024-06-15T12:00:00").utcOffset(-180);
    expect(m.hasAlignedHourOffset(other1)).toBe(o.hasAlignedHourOffset(other2));
  });

  test("aligned vs non-aligned → false", () => {
    const m = moment("2024-06-15T12:00:00").utcOffset(-120);
    const o = originalMoment("2024-06-15T12:00:00").utcOffset(-120);
    const other1 = moment("2024-06-15T12:00:00").utcOffset(-90);
    const other2 = originalMoment("2024-06-15T12:00:00").utcOffset(-90);
    expect(m.hasAlignedHourOffset(other1)).toBe(o.hasAlignedHourOffset(other2));
    expect(m.hasAlignedHourOffset(other1)).toBe(false);
  });

  test("invalid moment → false", () => {
    const m = moment("invalid");
    expect(m.hasAlignedHourOffset()).toBe(false);
    expect(m.hasAlignedHourOffset(moment.utc())).toBe(false);
  });

  test("other invalid → false", () => {
    const m = moment("2024-06-15T12:00:00");
    const other = moment("invalid");
    expect(m.hasAlignedHourOffset(other)).toBe(false);
  });
});

// ============================================================
// EP: _isUTC flag state transitions across all modes
// ============================================================
describe("EP: _isUTC flag transitions", () => {
  test("initial local → !isUtc, isLocal, !isUtcOffset", () => {
    const m = moment("2024-06-15T12:00:00");
    expect(m.isLocal()).toBe(true);
    expect(m.isUtc()).toBe(false);
    expect(m.isUtcOffset()).toBe(false);
  });

  test("initial utc → isUtc, !isLocal, isUtcOffset", () => {
    const m = moment.utc("2024-06-15T12:00:00");
    expect(m.isUtc()).toBe(true);
    expect(m.isLocal()).toBe(false);
    expect(m.isUtcOffset()).toBe(true);
  });

  test("utcOffset(N) → isUtcOffset, !isUtc (N≠0), !isLocal", () => {
    const m = moment("2024-06-15T12:00:00").utcOffset(60);
    expect(m.isUtcOffset()).toBe(true);
    expect(m.isUtc()).toBe(false);
    expect(m.isLocal()).toBe(false);
  });

  test("utcOffset(0) → isUtc, isUtcOffset, !isLocal", () => {
    const m = moment("2024-06-15T12:00:00").utcOffset(0);
    expect(m.isUtc()).toBe(true);
    expect(m.isUtcOffset()).toBe(true);
    expect(m.isLocal()).toBe(false);
  });

  test("parseZone with offset → isUtcOffset, !isUtc", () => {
    const m = moment.parseZone("2013-01-01T00:00:00+09:00");
    expect(m.isUtcOffset()).toBe(true);
    expect(m.isUtc()).toBe(false);
    expect(m.isLocal()).toBe(false);
    expect(m.utcOffset()).toBe(540);
  });

  test("parseZone without offset → isUtc, isUtcOffset", () => {
    const m = moment.parseZone("2016-02-01T00:00:00");
    expect(m.isUtc()).toBe(true);
    expect(m.isUtcOffset()).toBe(true);
    expect(m.utcOffset()).toBe(0);
  });

  test("local → utcOffset(N) → local → utc", () => {
    const m = moment("2024-06-15T12:00:00");
    expect(m.isLocal()).toBe(true);
    m.utcOffset(60);
    expect(m.isUtcOffset()).toBe(true);
    expect(m.isUtc()).toBe(false);
    m.local();
    expect(m.isLocal()).toBe(true);
    m.utc();
    expect(m.isUtc()).toBe(true);
  });
});

// ============================================================
// EP: valueOf invariants across offset representations
// ============================================================
describe("EP: valueOf invariants", () => {
  test("same instant, different offset representations", () => {
    const ts = Date.UTC(2024, 5, 15, 12, 0, 0);
    const reps = [
      moment(ts),
      moment.utc(ts),
      moment(ts).utcOffset(60),
      moment(ts).utcOffset(-240),
      moment(ts).utcOffset(330),
    ];
    for (const m of reps) {
      expect(m.valueOf()).toBe(ts);
    }
  });

  test("unix() same across offset representations", () => {
    const ts = 1718454600000;
    const m = moment(ts);
    const v = m.unix();
    expect(m.utc().unix()).toBe(v);
    expect(m.utcOffset(60).unix()).toBe(v);
    expect(m.utcOffset(-240).unix()).toBe(v);
    expect(m.utcOffset(330).unix()).toBe(v);
  });
});

// ============================================================
// EP: toDate() / toISOString() across offsets
// ============================================================
describe("EP: toDate() / toISOString() across offsets", () => {
  test("toDate() returns same epoch regardless of offset", () => {
    const d = new Date("2024-06-15T12:00:00Z");
    expect(+moment(d).utcOffset(60).toDate()).toBe(+d);
    expect(+moment(d).utcOffset(-240).toDate()).toBe(+d);
    expect(+moment(d).utcOffset(0).toDate()).toBe(+d);
  });

  test("toISOString(true) with offset returns offset string", () => {
    const m = moment("2024-06-15T12:30:00").utcOffset(60);
    const o = originalMoment("2024-06-15T12:30:00").utcOffset(60);
    expect(m.toISOString(true)).toBe(o.toISOString(true));
  });

  test("toISOString() (no arg) always UTC", () => {
    assertProp(
      fc.property(fc.constantFrom(60, -240, 330, 0, 90, -90), (off) => {
        const m = moment("2024-06-15T12:30:00").utcOffset(off);
        const o = originalMoment("2024-06-15T12:30:00").utcOffset(off);
        expect(m.toISOString()).toBe(o.toISOString());
      }),
      { numRuns: 50 },
    );
  });
});

// ============================================================
// BVA: clone and Moment(moment()) offset preservation
// ============================================================
describe("BVA: clone with offset", () => {
  const offsetValues = [-720, -480, -240, -60, 0, 60, 120, 420, 600, 840];

  for (const off of offsetValues) {
    test(`clone retains utcOffset(${off})`, () => {
      const m = moment("2024-06-15T12:00:00").utcOffset(off);
      const o = originalMoment("2024-06-15T12:00:00").utcOffset(off);
      expect(m.clone().utcOffset()).toBe(o.clone().utcOffset());
      expect(m.clone().valueOf()).toBe(o.clone().valueOf());
    });
  }

  for (const off of [-120, 120, 0, 330]) {
    test(`moment(moment()) wraps offset ${off}`, () => {
      const src = moment("2024-06-15T12:00:00").utcOffset(off);
      const m = moment(src);
      const o = originalMoment(originalMoment("2024-06-15T12:00:00").utcOffset(off));
      expect(m.utcOffset()).toBe(o.utcOffset());
      expect(m.valueOf()).toBe(o.valueOf());
    });
  }
});

// ============================================================
// BVA: getters/setters with extreme offset values
// ============================================================
describe("BVA: getters/setters with offset", () => {
  const offsetValues = [-720, -480, -240, -60, 60, 120, 420, 600, 840];

  for (const off of offsetValues) {
    test(`year/month/date getters with offset ${off}`, () => {
      const ref = moment.utc([2012, 0, 1, 0, 0, 0]);
      const m = ref.clone().utcOffset(off);
      const o = originalMoment.utc([2012, 0, 1, 0, 0, 0]).utcOffset(off);
      expect(m.year()).toBe(o.year());
      expect(m.month()).toBe(o.month());
      expect(m.date()).toBe(o.date());
    });
  }

  for (const off of [-240, 120]) {
    test(`set year/month/date with offset ${off}`, () => {
      const m = moment([2011, 5, 20]).utcOffset(off);
      const o = originalMoment([2011, 5, 20]).utcOffset(off);
      expect(m.clone().year(2012).year()).toBe(o.clone().year(2012).year());
      expect(m.clone().month(1).month()).toBe(o.clone().month(1).month());
      expect(m.clone().date(2).date()).toBe(o.clone().date(2).date());
      expect(m.clone().hour(1).hour()).toBe(o.clone().hour(1).hour());
    });
  }
});

// ============================================================
// BVA: moment.utc() factory boundary values
// ============================================================
describe("BVA: moment.utc() factory", () => {
  test("no arguments", () => {
    const mm = moment.utc();
    const om = originalMoment.utc();
    expect(Math.abs(mm.valueOf() - om.valueOf())).toBeLessThan(100);
  });

  test("ISO string with and without Z", () => {
    const inputs = [
      "2024-06-15T12:30:00",
      "2024-06-15T12:30:00Z",
      "2024-06-15T12:30:00+00:00",
      "2024-06-15T12:30:00+09:00",
      "2024-06-15T12:30:00-05:00",
      "2024-01-01T00:00:00",
      "2024-12-31T23:59:59",
    ];
    for (const input of inputs) {
      compareMoments(moment.utc(input), originalMoment.utc(input));
    }
  });

  test("array input", () => {
    const arrays: number[][] = [
      [2024, 5, 15],
      [2024, 5, 15, 12],
      [2024, 5, 15, 12, 30],
      [2024, 5, 15, 12, 30, 45],
      [2024, 5, 15, 12, 30, 45, 123],
      [0, 0, 1],
      [9999, 11, 31],
    ];
    for (const arr of arrays) {
      compareMoments(moment.utc(arr), originalMoment.utc(arr));
    }
  });

  test("unix timestamp (number)", () => {
    const timestamps = [0, -1, 1, 1718454600000, -86400000, 86400000];
    for (const ts of timestamps) {
      compareMoments(moment.utc(ts), originalMoment.utc(ts));
    }
  });

  test("object input", () => {
    const objs = [
      { year: 2024, month: 5, day: 15 },
      { year: 2024, month: 5, day: 15, hour: 12, minute: 30 },
      { y: 2024, M: 5, d: 15 },
    ];
    for (const obj of objs) {
      compareMoments(moment.utc(obj), originalMoment.utc(obj));
    }
  });
});

// ============================================================
// EP: zoneAbbr / zoneName
// ============================================================
describe("EP: zoneAbbr / zoneName", () => {
  test("UTC moment → zoneAbbr UTC, zoneName Coordinated Universal Time", () => {
    expect(moment.utc().zoneAbbr()).toBe("UTC");
    expect(moment.utc().zoneName()).toBe("Coordinated Universal Time");
    expect(originalMoment.utc().zoneAbbr()).toBe("UTC");
    expect(originalMoment.utc().zoneName()).toBe("Coordinated Universal Time");
  });

  test("fixed-offset moment → same as UTC (moment.js behavior)", () => {
    const cases = [60, -60, 330, -330, 0];
    for (const off of cases) {
      const m = moment.utc("2024-06-15T12:00:00").utcOffset(off);
      const o = originalMoment.utc("2024-06-15T12:00:00").utcOffset(off);
      expect(m.zoneAbbr()).toBe(o.zoneAbbr());
      expect(m.zoneName()).toBe(o.zoneName());
      expect(m.zoneAbbr()).toBe("UTC");
      expect(m.zoneName()).toBe("Coordinated Universal Time");
    }
  });

  test("local moment → zoneAbbr/zoneName match moment.js", () => {
    expect(moment().zoneAbbr()).toBe(originalMoment().zoneAbbr());
    expect(moment().zoneName()).toBe(originalMoment().zoneName());
  });
});

// ============================================================
// BVA: startOf / endOf with offset
// ============================================================
describe("BVA: startOf/endOf with offset", () => {
  test("startOf day across offset range", () => {
    assertProp(
      fc.property(fc.constantFrom(-720, -480, -240, 0, 60, 120, 420, 600, 840), (off) => {
        const ref = moment.utc([2010, 1, 2, 0, 0, 0]);
        const m = ref.clone().utcOffset(off).startOf("day");
        const o = originalMoment.utc([2010, 1, 2, 0, 0, 0]).utcOffset(off).startOf("day");
        expect(m.hour()).toBe(o.hour());
        expect(m.minute()).toBe(o.minute());
      }),
      { numRuns: 50 },
    );
  });

  test("endOf day across offset range", () => {
    assertProp(
      fc.property(fc.constantFrom(-720, -480, -240, 0, 60, 120, 420, 600, 840), (off) => {
        const ref = moment.utc([2010, 1, 2, 0, 0, 0]);
        const m = ref.clone().utcOffset(off).endOf("day");
        const o = originalMoment.utc([2010, 1, 2, 0, 0, 0]).utcOffset(off).endOf("day");
        expect(m.hour()).toBe(o.hour());
        expect(m.minute()).toBe(o.minute());
      }),
      { numRuns: 50 },
    );
  });
});

// ============================================================
// BVA: diff across extreme offsets
// ============================================================
describe("BVA: diff across extreme offsets", () => {
  test("diff is independent of offset", () => {
    const ref = moment();
    const other = moment(ref).add(35, "m");
    const expected = ref.valueOf() - other.valueOf();
    const offs = [-720, -480, -240, 0, 60, 120, 420, 600, 840];
    for (const off of offs) {
      expect(moment(ref).utcOffset(off).diff(other)).toBe(expected);
    }
  });
});

// ============================================================
// BVA: isSame / isBefore / isAfter across offset
// ============================================================
describe("BVA: comparison across offsets", () => {
  test("isSame() same absolute time", () => {
    const ref = moment("2024-06-15T12:00:00");
    const z1 = moment(ref).utcOffset(60);
    const z2 = moment(ref).utcOffset(-240);
    expect(z1.isSame(z2)).toBe(true);
    expect(z1.isSame(z2, "hour")).toBe(true);
  });

  test("isBefore() respects absolute time", () => {
    const ref = moment("2024-06-15T12:00:00");
    const later = moment(ref).add(1, "hour");
    expect(later.utcOffset(60).isBefore(ref.utcOffset(-240))).toBe(false);
    expect(ref.utcOffset(-240).isBefore(later.utcOffset(60))).toBe(true);
  });
});

// ============================================================
// BVA: Array-constructed moment propagates _isUTC
// ============================================================
describe("BVA: _isUTC propagation for array inputs", () => {
  test("moment([y,m,d]) is local", () => {
    expect(moment([2024, 5, 15]).isLocal()).toBe(true);
    expect(moment([2024, 5, 15]).isUtc()).toBe(false);
  });

  test("moment.utc([y,m,d]) is UTC", () => {
    expect(moment.utc([2024, 5, 15]).isUtc()).toBe(true);
    expect(moment.utc([2024, 5, 15]).isLocal()).toBe(false);
    expect(moment.utc([2024, 5, 15]).utcOffset()).toBe(0);
  });

  test("moment.utc([y,m,d]) valueOf matches moment.utc() of same date", () => {
    const mm = moment.utc([2024, 5, 15, 12, 30]);
    const om = originalMoment.utc([2024, 5, 15, 12, 30]);
    expect(mm.valueOf()).toBe(om.valueOf());
    expect(mm.format("YYYY-MM-DDTHH:mm:ss")).toBe(om.format("YYYY-MM-DDTHH:mm:ss"));
  });
});

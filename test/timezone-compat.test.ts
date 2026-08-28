import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

function compareMoments(mm: ReturnType<typeof moment>, om: ReturnType<typeof originalMoment>) {
  expect(mm.valueOf()).toBe(om.valueOf());
  expect(mm.utcOffset()).toBe(om.utcOffset());
  expect(mm.format()).toBe(om.format());
}

describe("moment() — local timezone", () => {
  test("basic string parsing matches moment.js", () => {
    compareMoments(moment("2024-06-15T12:30:00"), originalMoment("2024-06-15T12:30:00"));
  });

  test("new Date() constructor", () => {
    const d = new Date("2024-06-15T12:30:00Z");
    compareMoments(moment(d), originalMoment(d));
  });

  test("unix timestamp (number)", () => {
    const ts = 1718454600000;
    compareMoments(moment(ts), originalMoment(ts));
  });

  test("array constructor", () => {
    compareMoments(moment([2024, 5, 15, 12, 30]), originalMoment([2024, 5, 15, 12, 30]));
  });

  test("year arithmetic refreshes fields when DST normalizes a nonexistent time", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const input = new Date("1951-04-28T08:00:05.999Z");
      const mm = moment(input).add(-6, "seconds").subtract(-6, "years");
      const om = originalMoment(input).add(-6, "seconds").subtract(-6, "years");
      compareMoments(mm, om);
    } finally {
      process.env.TZ = originalTz;
    }
  });
});

describe("moment.utc()", () => {
  test("no arguments", () => {
    const mm = moment.utc();
    const om = originalMoment.utc();
    expect(Math.abs(mm.valueOf() - om.valueOf())).toBeLessThan(100);
  });

  test("ISO string", () => {
    compareMoments(moment.utc("2024-06-15T12:30:00"), originalMoment.utc("2024-06-15T12:30:00"));
  });

  test("ISO string with Z suffix", () => {
    compareMoments(moment.utc("2024-06-15T12:30:00Z"), originalMoment.utc("2024-06-15T12:30:00Z"));
  });

  test("ISO string with offset", () => {
    compareMoments(
      moment.utc("2024-06-15T12:30:00+09:00"),
      originalMoment.utc("2024-06-15T12:30:00+09:00"),
    );
  });

  test("ISO string with negative offset", () => {
    compareMoments(
      moment.utc("2024-06-15T12:30:00-04:00"),
      originalMoment.utc("2024-06-15T12:30:00-04:00"),
    );
  });

  test("array", () => {
    compareMoments(moment.utc([2024, 5, 15, 12, 30]), originalMoment.utc([2024, 5, 15, 12, 30]));
  });

  test("formatted time-only input uses the current UTC date", () => {
    const oldNow = moment.now;
    const oldOriginalNow = originalMoment.now;
    const fixedNow = Date.UTC(2024, 5, 15, 18, 45);
    moment.now = () => fixedNow;
    originalMoment.now = () => fixedNow;
    try {
      compareMoments(moment.utc("13:30", "HH:mm"), originalMoment.utc("13:30", "HH:mm"));
    } finally {
      moment.now = oldNow;
      originalMoment.now = oldOriginalNow;
    }
  });
});

describe("moment.utc() — historical dates with non-integer timezone offsets", () => {
  const TZS = ["Asia/Tokyo", "America/New_York", "Europe/London", "Australia/Sydney"];

  function testHistorical(desc: string, input: string) {
    for (const tz of TZS) {
      test(`${desc} in ${tz}`, () => {
        const origTz = process.env.TZ;
        process.env.TZ = tz;
        try {
          const mm = moment.utc(input);
          const om = originalMoment.utc(input);
          expect(mm.valueOf()).toBe(om.valueOf());
          expect(mm.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(om.format("YYYY-MM-DD HH:mm:ss.SSS"));
          expect(mm.toISOString()).toBe(om.toISOString());
        } finally {
          process.env.TZ = origTz;
        }
      });
    }
  }

  testHistorical("4-digit year-only", "1111");
  testHistorical("4-digit year-only 0001", "0001");
  testHistorical("ISO date with time", "1111-01-01T12:00:00");
  testHistorical("ISO date+time with no offset", "0001-01-01T00:00:00");
  testHistorical("ISO date only", "1111-01-01");
  testHistorical("ISO date only with year 0001", "0001-01-01");
  testHistorical("ISO year-month only", "1111-01");
  testHistorical("pre-Tokyo-standardized date", "1887-12-31");
});

describe("utcOffset() getter", () => {
  test("local moment offset matches", () => {
    expect(moment().utcOffset()).toBe(originalMoment().utcOffset());
  });

  test("utc moment offset is 0", () => {
    expect(moment.utc().utcOffset()).toBe(0);
  });

  test("after setting fixed offset", () => {
    const mm = moment("2024-06-15T12:00:00").utcOffset(60);
    const om = originalMoment("2024-06-15T12:00:00").utcOffset(60);
    expect(mm.utcOffset()).toBe(om.utcOffset());
  });
});

describe("utcOffset() setter — number", () => {
  test("numeric NaN matches moment.js", () => {
    for (const keepLocalTime of [false, true]) {
      const mm = moment.utc(0).utcOffset(NaN, keepLocalTime);
      const om = originalMoment.utc(0).utcOffset(NaN, keepLocalTime);
      expect(mm.valueOf()).toBe(om.valueOf());
      expect(mm.utcOffset()).toBe(om.utcOffset());
      expect(mm.isValid()).toBe(om.isValid());
    }
  });

  test("matches moment.js at TimeClip boundaries", () => {
    for (const timestamp of [-8.64e15, 8.64e15]) {
      for (const offset of [-60, 60]) {
        const mm = moment.utc(timestamp).utcOffset(offset);
        const om = originalMoment.utc(timestamp).utcOffset(offset);
        expect(mm.valueOf()).toBe(om.valueOf());
        expect(mm.utcOffset()).toBe(om.utcOffset());
        expect(mm.isValid()).toBe(om.isValid());
      }
    }
  });

  const testOffsets = [
    [0, 0],
    [1, 60],
    [60, 60],
    [-1, -60],
    [-60, -60],
    [1.5, 90],
    [90, 90],
    [-1.5, -90],
    [-90, -90],
    [15, 900],
    [-15, -900],
    [16, 16],
    [-16, -16],
  ] as const;

  for (const [input, expected] of testOffsets) {
    test(`utcOffset(${input}) => ${expected}`, () => {
      const base = "2024-06-15T12:00:00";
      const mm = moment(base).utcOffset(input);
      const om = originalMoment(base).utcOffset(input);
      expect(mm.utcOffset()).toBe(om.utcOffset());
      expect(mm.valueOf()).toBe(om.valueOf());
    });
  }
});

describe("utcOffset() setter — string", () => {
  const testOffsets: [string, number][] = [
    ["+01:00", 60],
    ["+0100", 60],
    ["-01:00", -60],
    ["-0100", -60],
    ["+01:30", 90],
    ["+0130", 90],
    ["-01:30", -90],
    ["-0130", -90],
    ["+00:10", 10],
    ["-00:10", -10],
    ["+0010", 10],
    ["-0010", -10],
  ];

  for (const [str, expected] of testOffsets) {
    test(`utcOffset("${str}") => ${expected}`, () => {
      const base = "2024-06-15T12:00:00";
      const mm = moment(base).utcOffset(str);
      const om = originalMoment(base).utcOffset(str);
      expect(mm.utcOffset()).toBe(om.utcOffset());
      expect(mm.valueOf()).toBe(om.valueOf());
    });
  }
});

describe("zone()", () => {
  function zoneCompare(mm: ReturnType<typeof moment>, om: ReturnType<typeof originalMoment>) {
    expect(mm.zone()).toBe(-om.utcOffset() || 0);
    expect(mm.utcOffset()).toBe(om.utcOffset());
    expect(mm.valueOf()).toBe(om.valueOf());
  }

  test("zone() getter sign opposite of utcOffset", () => {
    const base = "2024-06-15T12:00:00";
    const m = moment(base).utcOffset(-120);
    const o = originalMoment(base).utcOffset(-120);
    zoneCompare(m, o);
    expect(m.zone()).toBe(120);
  });

  test("zone(number) setter", () => {
    const base = "2024-06-15T12:00:00";
    const mm = moment(base).zone(60);
    const om = originalMoment(base).utcOffset(-60);
    zoneCompare(mm, om);
  });

  test("zone(string) setter", () => {
    const base = "2024-06-15T12:00:00";
    const mm = moment(base).zone("-01:00");
    const om = originalMoment(base).utcOffset(-60);
    zoneCompare(mm, om);
  });
});

describe("utcOffset(..., true) — keepLocalTime", () => {
  test("keepLocalTime preserves local clock when called on local moment", () => {
    const base = "2024-06-15T12:30:00";
    const mm = moment(base);
    const om = originalMoment(base);
    mm.utcOffset(90, true);
    om.utcOffset(90, true);
    expect(mm.hours()).toBe(om.hours());
    expect(mm.minutes()).toBe(om.minutes());
    expect(mm.seconds()).toBe(om.seconds());
    expect(mm.utcOffset()).toBe(om.utcOffset());
  });

  test("keepLocalTime changes absolute time", () => {
    const base = "2024-06-15T12:30:00";
    const originalValue = moment(base).valueOf();
    const mm = moment(base).utcOffset(90, true);
    expect(mm.valueOf()).not.toBe(originalValue);
  });

  test("keepLocalTime preserves clock with negative offset", () => {
    const base = "2024-06-15T12:30:00";
    const mm = moment(base);
    const om = originalMoment(base);
    mm.utcOffset(-300, true);
    om.utcOffset(-300, true);
    expect(mm.hours()).toBe(om.hours());
    expect(mm.minutes()).toBe(om.minutes());
    expect(mm.utcOffset()).toBe(om.utcOffset());
  });

  test("keepLocalTime with fractional offset", () => {
    const base = "2024-06-15T12:30:00";
    const mm = moment(base);
    const om = originalMoment(base);
    mm.utcOffset(330, true);
    om.utcOffset(330, true);
    expect(mm.hours()).toBe(om.hours());
    expect(mm.minutes()).toBe(om.minutes());
    expect(mm.utcOffset()).toBe(om.utcOffset());
  });
});

describe("utc() / local() conversions", () => {
  test("local -> utc preserves valueOf", () => {
    const m = moment("2024-06-15T12:30:00");
    const o = originalMoment("2024-06-15T12:30:00");
    expect(m.utc().valueOf()).toBe(o.utc().valueOf());
  });

  test("utc -> local preserves valueOf", () => {
    const m = moment.utc("2024-06-15T12:30:00");
    const o = originalMoment.utc("2024-06-15T12:30:00");
    expect(m.local().valueOf()).toBe(o.local().valueOf());
  });

  test("utc() resets offset to 0", () => {
    const m = moment.utc("2024-06-15T12:30:00").utcOffset(60);
    const o = originalMoment.utc("2024-06-15T12:30:00").utcOffset(60);
    m.utc();
    o.utc();
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.hours()).toBe(o.hours());
  });

  test("local() resets to local offset", () => {
    const m = moment.utc("2024-06-15T12:30:00").utcOffset(60);
    const o = originalMoment.utc("2024-06-15T12:30:00").utcOffset(60);
    m.local();
    o.local();
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.valueOf()).toBe(o.valueOf());
  });

  test("roundtrip: local -> utc -> local preserves format", () => {
    const m = moment("2024-06-15T12:30:00");
    const o = originalMoment("2024-06-15T12:30:00");
    const fmt = "YYYY-MM-DDTHH:mm:ss";
    expect(m.format(fmt)).toBe(o.format(fmt));
    m.utc();
    o.utc();
    expect(m.format(fmt)).toBe(o.format(fmt));
    m.local();
    o.local();
    expect(m.format(fmt)).toBe(o.format(fmt));
  });

  test("roundtrip: utc -> local -> utc preserves format", () => {
    const m = moment.utc("2024-06-15T12:30:00");
    const o = originalMoment.utc("2024-06-15T12:30:00");
    const fmt = "YYYY-MM-DDTHH:mm:ss";
    expect(m.format(fmt)).toBe(o.format(fmt));
    m.local();
    o.local();
    expect(m.format(fmt)).toBe(o.format(fmt));
    m.utc();
    o.utc();
    expect(m.format(fmt)).toBe(o.format(fmt));
  });

  test("roundtrip: fixed offset -> utc -> fixed offset", () => {
    const m = moment("2024-06-15T12:30:00").utcOffset(60);
    const o = originalMoment("2024-06-15T12:30:00").utcOffset(60);
    const fmt = "YYYY-MM-DDTHH:mm:ss";
    expect(m.format(fmt)).toBe(o.format(fmt));
    m.utc();
    o.utc();
    expect(m.format(fmt)).toBe(o.format(fmt));
    expect(m.utcOffset()).toBe(o.utcOffset());
  });
});

describe("utc(true) / local(true) — keepLocalTime", () => {
  test("utc(true) on local moment preserves wall clock", () => {
    const m = moment("2024-06-15T12:30:00");
    const o = originalMoment("2024-06-15T12:30:00");
    m.utc(true);
    o.utc(true);
    expect(m.format("YYYY-MM-DDTHH:mm:ss")).toBe(o.format("YYYY-MM-DDTHH:mm:ss"));
    expect(m.utcOffset()).toBe(o.utcOffset());
  });

  test("local(true) on utc moment preserves wall clock", () => {
    const m = moment.utc("2024-06-15T12:30:00");
    const o = originalMoment.utc("2024-06-15T12:30:00");
    m.local(true);
    o.local(true);
    expect(m.format("YYYY-MM-DDTHH:mm:ss")).toBe(o.format("YYYY-MM-DDTHH:mm:ss"));
    expect(m.utcOffset()).toBe(o.utcOffset());
  });

  test("local(true) on fixed-offset moment preserves wall clock", () => {
    const m = moment.utc("2024-06-15T12:30:00").utcOffset(60);
    const o = originalMoment.utc("2024-06-15T12:30:00").utcOffset(60);
    m.local(true);
    o.local(true);
    expect(m.format("YYYY-MM-DDTHH:mm:ss")).toBe(o.format("YYYY-MM-DDTHH:mm:ss"));
    expect(m.utcOffset()).toBe(o.utcOffset());
  });

  test("utc(true) on fixed-offset moment preserves wall clock", () => {
    const m = moment.utc("2024-06-15T12:30:00").utcOffset(60);
    const o = originalMoment.utc("2024-06-15T12:30:00").utcOffset(60);
    m.utc(true);
    o.utc(true);
    expect(m.format("YYYY-MM-DDTHH:mm:ss")).toBe(o.format("YYYY-MM-DDTHH:mm:ss"));
    expect(m.utcOffset()).toBe(o.utcOffset());
  });
});

describe("parseZone()", () => {
  test("parseZone preserves wall clock with negative offset", () => {
    const m = moment("2013-01-01T00:00:00-13:00").parseZone();
    const o = originalMoment("2013-01-01T00:00:00-13:00").parseZone();
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.hours()).toBe(o.hours());
    expect(m.minutes()).toBe(o.minutes());
    expect(m.format()).toBe(o.format());
    expect(m.valueOf()).toBe(o.valueOf());
  });

  test("parseZone preserves wall clock with positive offset", () => {
    const m = moment("2013-01-01T05:00:00+09:00").parseZone();
    const o = originalMoment("2013-01-01T05:00:00+09:00").parseZone();
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.hours()).toBe(o.hours());
    expect(m.format()).toBe(o.format());
    expect(m.valueOf()).toBe(o.valueOf());
  });

  test("parseZone UTC zone", () => {
    const m = moment("2013-01-01T05:00:00+00:00").parseZone();
    const o = originalMoment("2013-01-01T05:00:00+00:00").parseZone();
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.hours()).toBe(o.hours());
    expect(m.format()).toBe(o.format());
  });

  test("parseZone static", () => {
    const m = moment.parseZone("2013-01-01T00:00:00-13:00");
    const o = originalMoment.parseZone("2013-01-01T00:00:00-13:00");
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.hours()).toBe(o.hours());
    expect(m.format()).toBe(o.format());
  });

  test("parseZone static UTC", () => {
    const m = moment.parseZone("2013-01-01T05:00:00+00:00");
    const o = originalMoment.parseZone("2013-01-01T05:00:00+00:00");
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.hours()).toBe(o.hours());
  });

  test("parseZone with format argument", () => {
    const m = moment.parseZone("2013 01 01 05 -13:00", "YYYY MM DD HH ZZ");
    const o = originalMoment.parseZone("2013 01 01 05 -13:00", "YYYY MM DD HH ZZ");
    expect(m.format()).toBe(o.format());
  });

  test("parseZone with minutes offset < 16", () => {
    const m = moment.parseZone("2013-01-01T00:00:00-00:15");
    const o = originalMoment.parseZone("2013-01-01T00:00:00-00:15");
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.hours()).toBe(o.hours());
    expect(m.format()).toBe(o.format());
  });

  test("parseZone with minutes offset +00:15", () => {
    const m = moment.parseZone("2013-01-01T00:00:00+00:15");
    const o = originalMoment.parseZone("2013-01-01T00:00:00+00:15");
    expect(m.utcOffset()).toBe(o.utcOffset());
    expect(m.hours()).toBe(o.hours());
    expect(m.format()).toBe(o.format());
  });

  test("parseZone roundtrip: parseZone -> utc -> local", () => {
    const m = moment.parseZone("2013-01-01T00:00:00-13:00");
    const o = originalMoment.parseZone("2013-01-01T00:00:00-13:00");
    m.utc();
    o.utc();
    expect(m.valueOf()).toBe(o.valueOf());
    expect(m.utcOffset()).toBe(o.utcOffset());
    m.local();
    o.local();
    expect(m.valueOf()).toBe(o.valueOf());
    expect(m.utcOffset()).toBe(o.utcOffset());
  });

  test("parseZone without timezone preserves wall-clock and sets offset to 0", () => {
    const inputs = [
      "2016-02-01T00:00:00",
      "2016-02-01T00:00:00Z",
      "2016-02-01T00:00:00+00:00",
      "2016-02-01T00:00:00+0000",
    ];
    for (const input of inputs) {
      const mm = moment.parseZone(input);
      const om = originalMoment.parseZone(input);
      expect(mm.format("M D YYYY HH:mm:ss ZZ")).toBe(om.format("M D YYYY HH:mm:ss ZZ"));
      expect(mm.utcOffset()).toBe(om.utcOffset());
      expect(mm.valueOf()).toBe(om.valueOf());
    }
  });

  test("formatted partial dates use the appropriate current date", () => {
    const oldNow = moment.now;
    const oldOriginalNow = originalMoment.now;
    const fixedNow = Date.UTC(2024, 5, 15, 18, 45);
    moment.now = () => fixedNow;
    originalMoment.now = () => fixedNow;
    try {
      for (const [input, format] of [
        ["13:30+02:00", "HH:mmZ"],
        ["13:30", "HH:mm"],
      ]) {
        compareMoments(moment.parseZone(input, format), originalMoment.parseZone(input, format));
      }
    } finally {
      moment.now = oldNow;
      originalMoment.now = oldOriginalNow;
    }
  });
});

describe("format tokens Z / ZZ / z / zz", () => {
  test("UTC moment: Z -> +00:00, ZZ -> +0000, z -> UTC, zz -> Coordinated Universal Time", () => {
    const mm = moment.utc("2024-06-15T12:00:00");
    const om = originalMoment.utc("2024-06-15T12:00:00");
    expect(mm.format("Z")).toBe(om.format("Z"));
    expect(mm.format("ZZ")).toBe(om.format("ZZ"));
    expect(mm.format("z")).toBe(om.format("z"));
    expect(mm.format("zz")).toBe(om.format("zz"));
  });

  test("fixed offset +01:00: Z, ZZ", () => {
    const mm = moment.utc("2024-06-15T12:00:00").utcOffset(60);
    const om = originalMoment.utc("2024-06-15T12:00:00").utcOffset(60);
    expect(mm.format("Z")).toBe(om.format("Z"));
    expect(mm.format("ZZ")).toBe(om.format("ZZ"));
  });

  test("fixed offset -04:00: Z, ZZ", () => {
    const mm = moment.utc("2024-06-15T12:00:00").utcOffset(-240);
    const om = originalMoment.utc("2024-06-15T12:00:00").utcOffset(-240);
    expect(mm.format("Z")).toBe(om.format("Z"));
    expect(mm.format("ZZ")).toBe(om.format("ZZ"));
  });

  test("fixed offset +05:30: Z, ZZ", () => {
    const mm = moment.utc("2024-06-15T12:00:00").utcOffset(330);
    const om = originalMoment.utc("2024-06-15T12:00:00").utcOffset(330);
    expect(mm.format("Z")).toBe(om.format("Z"));
    expect(mm.format("ZZ")).toBe(om.format("ZZ"));
  });

  test("local moment: z is empty, zz is empty", () => {
    expect(moment().format("z")).toBe(originalMoment().format("z"));
    expect(moment().format("zz")).toBe(originalMoment().format("zz"));
  });

  test("zoneAbbr / zoneName", () => {
    expect(moment.utc().zoneAbbr()).toBe(originalMoment.utc().zoneAbbr());
    expect(moment.utc().zoneName()).toBe(originalMoment.utc().zoneName());
    expect(moment().zoneAbbr()).toBe(originalMoment().zoneAbbr());
    expect(moment().zoneName()).toBe(originalMoment().zoneName());
  });
});

describe("isDST()", () => {
  test("UTC moment is never DST", () => {
    expect(moment.utc("2024-06-15T12:00:00").isDST()).toBe(false);
    expect(moment.utc("2024-01-15T12:00:00").isDST()).toBe(false);
  });

  test("fixed-offset moment is never DST", () => {
    expect(moment("2024-06-15T12:00:00").utcOffset(60).isDST()).toBe(false);
    expect(moment("2024-01-15T12:00:00").utcOffset(60).isDST()).toBe(false);
  });

  test("fixed-offset moment DST matches moment.js", () => {
    const mm = moment("2024-06-15T12:00:00").utcOffset(60);
    const om = originalMoment("2024-06-15T12:00:00").utcOffset(60);
    expect(mm.isDST()).toBe(om.isDST());
  });

  test("fixed-offset moment in winter is not DST (same as moment.js)", () => {
    const mm = moment("2024-01-15T12:00:00").utcOffset(60);
    const om = originalMoment("2024-01-15T12:00:00").utcOffset(60);
    expect(mm.isDST()).toBe(om.isDST());
  });
});

describe("isLocal / isUtc / isUtcOffset", () => {
  test("local moment", () => {
    expect(moment().isLocal()).toBe(originalMoment().isLocal());
    expect(moment().isUtc()).toBe(originalMoment().isUtc());
    expect(moment().isUtcOffset()).toBe(originalMoment().isUtcOffset());
  });

  test("utc moment", () => {
    expect(moment.utc().isLocal()).toBe(originalMoment.utc().isLocal());
    expect(moment.utc().isUtc()).toBe(originalMoment.utc().isUtc());
    expect(moment.utc().isUtcOffset()).toBe(originalMoment.utc().isUtcOffset());
  });

  test("fixed offset moment", () => {
    const mm = moment().utcOffset(60);
    const om = originalMoment().utcOffset(60);
    expect(mm.isLocal()).toBe(om.isLocal());
    expect(mm.isUtc()).toBe(om.isUtc());
    expect(mm.isUtcOffset()).toBe(om.isUtcOffset());
  });

  test("utcOffset(0) is equivalent to utc", () => {
    const mm = moment().utcOffset(0);
    const om = originalMoment().utcOffset(0);
    expect(mm.isUtc()).toBe(om.isUtc());
    expect(mm.isUtcOffset()).toBe(om.isUtcOffset());
  });
});

describe("valueOf() invariants", () => {
  test("valueOf same across different offset representations of same instant", () => {
    const ts = Date.UTC(2024, 5, 15, 12, 0, 0);
    const m1 = moment(ts);
    const m2 = moment.utc(ts);
    const m3 = moment(ts).utcOffset(60);
    const m4 = moment(ts).utcOffset(-240);
    expect(m1.valueOf()).toBe(ts);
    expect(m2.valueOf()).toBe(ts);
    expect(m3.valueOf()).toBe(ts);
    expect(m4.valueOf()).toBe(ts);
  });

  test("valueOf after local/utc roundtrip", () => {
    const m = moment("2024-06-15T12:00:00");
    const v = m.valueOf();
    m.utc();
    m.local();
    expect(m.valueOf()).toBe(v);
  });

  test("valueOf after utc/local roundtrip", () => {
    const m = moment.utc("2024-06-15T12:00:00");
    const v = m.valueOf();
    m.local();
    m.utc();
    expect(m.valueOf()).toBe(v);
  });

  test("valueOf after parseZone roundtrip", () => {
    const m = moment.parseZone("2024-06-15T12:00:00+05:30");
    const o = originalMoment.parseZone("2024-06-15T12:00:00+05:30");
    expect(m.valueOf()).toBe(o.valueOf());
    m.utc();
    o.utc();
    expect(m.valueOf()).toBe(o.valueOf());
    m.local();
    o.local();
    expect(m.valueOf()).toBe(o.valueOf());
  });
});

describe("hasAlignedHourOffset()", () => {
  test("aligned with UTC", () => {
    expect(moment().utcOffset(-120).hasAlignedHourOffset()).toBe(
      originalMoment().utcOffset(-120).hasAlignedHourOffset(),
    );
    expect(moment().utcOffset(-90).hasAlignedHourOffset()).toBe(
      originalMoment().utcOffset(-90).hasAlignedHourOffset(),
    );
  });

  test("aligned with other zone", () => {
    const m = moment().utcOffset(-120);
    const o = originalMoment().utcOffset(-120);
    expect(m.hasAlignedHourOffset(moment().utcOffset(-180))).toBe(
      o.hasAlignedHourOffset(originalMoment().utcOffset(-180)),
    );
    expect(m.hasAlignedHourOffset(moment().utcOffset(-90))).toBe(
      o.hasAlignedHourOffset(originalMoment().utcOffset(-90)),
    );
  });
});

describe("clone with offset", () => {
  test("explicit clone retains offset", () => {
    expect(moment().utcOffset(-120).clone().utcOffset()).toBe(
      originalMoment().utcOffset(-120).clone().utcOffset(),
    );
    expect(moment().utcOffset(120).clone().utcOffset()).toBe(
      originalMoment().utcOffset(120).clone().utcOffset(),
    );
  });

  test("implicit clone (via moment()) retains offset", () => {
    const mm = moment(moment().utcOffset(-120));
    const om = originalMoment(originalMoment().utcOffset(-120));
    expect(mm.utcOffset()).toBe(om.utcOffset());
  });
});

describe("offsets with minutes (fractional timezones)", () => {
  test("+05:30 (India)", () => {
    const mm = moment.utc("2024-06-15T12:00:00").utcOffset(330);
    const om = originalMoment.utc("2024-06-15T12:00:00").utcOffset(330);
    expect(mm.utcOffset()).toBe(om.utcOffset());
    expect(mm.format("HH:mm")).toBe(om.format("HH:mm"));
    expect(mm.valueOf()).toBe(om.valueOf());
  });

  test("-04:30 (Venezuela)", () => {
    const mm = moment.utc("2024-06-15T12:00:00").utcOffset(-270);
    const om = originalMoment.utc("2024-06-15T12:00:00").utcOffset(-270);
    expect(mm.utcOffset()).toBe(om.utcOffset());
    expect(mm.format("HH:mm")).toBe(om.format("HH:mm"));
    expect(mm.valueOf()).toBe(om.valueOf());
  });

  test("+12:45 (Chatham Islands)", () => {
    const mm = moment.utc("2024-06-15T12:00:00").utcOffset(765);
    const om = originalMoment.utc("2024-06-15T12:00:00").utcOffset(765);
    expect(mm.utcOffset()).toBe(om.utcOffset());
    expect(mm.format("HH:mm")).toBe(om.format("HH:mm"));
    expect(mm.valueOf()).toBe(om.valueOf());
  });
});

describe("toDate()", () => {
  test("toDate returns same epoch across different offsets", () => {
    const d = new Date("2024-06-15T12:00:00Z");
    const m1 = moment(d).utcOffset(60);
    const m2 = moment(d).utcOffset(-240);
    expect(+m1.toDate()).toBe(+d);
    expect(+m2.toDate()).toBe(+d);
  });
});

describe("toISOString()", () => {
  test("UTC moment toISOString", () => {
    const mm = moment.utc("2024-06-15T12:30:45.123");
    const om = originalMoment.utc("2024-06-15T12:30:45.123");
    expect(mm.toISOString()).toBe(om.toISOString());
  });

  test("local moment toISOString", () => {
    const mm = moment("2024-06-15T12:30:00");
    const om = originalMoment("2024-06-15T12:30:00");
    expect(mm.toISOString()).toBe(om.toISOString());
  });

  test("fixed offset moment toISOString (true)", () => {
    const mm = moment("2024-06-15T12:30:00").utcOffset(60);
    const om = originalMoment("2024-06-15T12:30:00").utcOffset(60);
    expect(mm.toISOString(true)).toBe(om.toISOString(true));
  });
});

describe("Unix timestamp consistency across offsets", () => {
  test("unix() same across all offsets representing same instant", () => {
    const m = moment("2024-06-15T12:00:00");
    const v = m.unix();
    expect(m.utc().unix()).toBe(v);
    expect(m.utcOffset(60).unix()).toBe(v);
    expect(m.utcOffset(-240).unix()).toBe(v);
  });
});

describe("isSame / isBefore / isAfter across offsets", () => {
  test("same absolute time across zones", () => {
    const ref = moment("2024-06-15T12:00:00");
    const z1 = moment(ref).utcOffset(60);
    const z2 = moment(ref).utcOffset(-240);
    expect(z1.isSame(z2)).toBe(true);
    expect(z1.isSame(z2, "hour")).toBe(true);
  });

  test("isAfter with different offsets", () => {
    const ref = moment("2024-06-15T12:00:00");
    const later = moment(ref).add(1, "hour");
    expect(later.utcOffset(60).isAfter(ref.utcOffset(-240))).toBe(true);
  });
});

describe("startOf / endOf with utcOffset", () => {
  test("startOf day with offset", () => {
    const a = moment.utc([2010, 1, 2, 0, 0, 0]).utcOffset(-450);
    const b = originalMoment.utc([2010, 1, 2, 0, 0, 0]).utcOffset(-450);
    expect(a.clone().startOf("day").hour()).toBe(b.clone().startOf("day").hour());
    expect(a.clone().startOf("day").minute()).toBe(b.clone().startOf("day").minute());
    expect(a.clone().startOf("hour").minute()).toBe(b.clone().startOf("hour").minute());
  });

  test("endOf day with offset", () => {
    const a = moment.utc([2010, 1, 2, 0, 0, 0]).utcOffset(-450);
    const b = originalMoment.utc([2010, 1, 2, 0, 0, 0]).utcOffset(-450);
    expect(a.clone().endOf("day").hour()).toBe(b.clone().endOf("day").hour());
    expect(a.clone().endOf("day").minute()).toBe(b.clone().endOf("day").minute());
    expect(a.clone().endOf("hour").minute()).toBe(b.clone().endOf("hour").minute());
  });
});

describe("diff across offsets", () => {
  test("diff same across zones (internal consistency)", () => {
    const ref = moment();
    const other = moment(ref).add(35, "m");
    const z1 = moment(ref).utcOffset(-720);
    const z2 = moment(ref).utcOffset(-360);
    const z3 = moment(ref).utcOffset(690);
    const expected = ref.valueOf() - other.valueOf();
    expect(z1.diff(other)).toBe(expected);
    expect(z2.diff(other)).toBe(expected);
    expect(z3.diff(other)).toBe(expected);
  });
});

describe("getters/setters with utcOffset", () => {
  test("getters with -120 offset", () => {
    const a = moment.utc([2012, 0, 1, 0, 0, 0]);
    const b = originalMoment.utc([2012, 0, 1, 0, 0, 0]);
    expect(a.clone().utcOffset(-120).year()).toBe(b.clone().utcOffset(-120).year());
    expect(a.clone().utcOffset(-120).month()).toBe(b.clone().utcOffset(-120).month());
    expect(a.clone().utcOffset(-120).date()).toBe(b.clone().utcOffset(-120).date());
    expect(a.clone().utcOffset(-120).hour()).toBe(b.clone().utcOffset(-120).hour());
    expect(a.clone().utcOffset(-120).minute()).toBe(b.clone().utcOffset(-120).minute());
  });

  test("getters with +120 offset", () => {
    const a = moment.utc([2012, 0, 1, 0, 0, 0]);
    const b = originalMoment.utc([2012, 0, 1, 0, 0, 0]);
    expect(a.clone().utcOffset(120).year()).toBe(b.clone().utcOffset(120).year());
    expect(a.clone().utcOffset(120).month()).toBe(b.clone().utcOffset(120).month());
    expect(a.clone().utcOffset(120).date()).toBe(b.clone().utcOffset(120).date());
    expect(a.clone().utcOffset(120).hour()).toBe(b.clone().utcOffset(120).hour());
    expect(a.clone().utcOffset(120).minute()).toBe(b.clone().utcOffset(120).minute());
  });

  test("setters with -120 offset", () => {
    const a = moment([2011, 5, 20]);
    const b = originalMoment([2011, 5, 20]);
    expect(a.clone().utcOffset(-120).year(2012).year()).toBe(
      b.clone().utcOffset(-120).year(2012).year(),
    );
    expect(a.clone().utcOffset(-120).month(1).month()).toBe(
      b.clone().utcOffset(-120).month(1).month(),
    );
    expect(a.clone().utcOffset(-120).date(2).date()).toBe(b.clone().utcOffset(-120).date(2).date());
    expect(a.clone().utcOffset(-120).hour(1).hour()).toBe(b.clone().utcOffset(-120).hour(1).hour());
  });
});

describe("DST behavior in local timezone", () => {
  test("isDST for January (northern hemisphere winter)", () => {
    expect(moment("2024-01-15T12:00:00").isDST()).toBe(
      originalMoment("2024-01-15T12:00:00").isDST(),
    );
  });

  test("isDST for July (northern hemisphere summer)", () => {
    expect(moment("2024-07-15T12:00:00").isDST()).toBe(
      originalMoment("2024-07-15T12:00:00").isDST(),
    );
  });
});

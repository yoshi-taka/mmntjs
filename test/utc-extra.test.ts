import { describe, test, expect, beforeEach } from "bun:test";
import moment from "../src/index.ts";

beforeEach(() => {
  moment.locale("en");
});

describe("moment.utc()", () => {
  test("creates UTC moment from date", () => {
    const m = moment.utc("2024-01-15");
    expect(m.isUTC()).toBe(true);
    expect(m.format("YYYY-MM-DD")).toBe("2024-01-15");
  });

  test("creates UTC moment with keepLocalTime", () => {
    const m = moment("2024-01-15");
    const mUtc = m.clone().utc(true);
    expect(mUtc.isUTC()).toBe(true);
  });

  test("isUTC returns true for UTC", () => {
    expect(moment.utc().isUTC()).toBe(true);
    expect(moment().isUTC()).toBe(false);
  });

  test("isLocal returns true for local", () => {
    expect(moment().isLocal()).toBe(true);
    expect(moment.utc().isLocal()).toBe(false);
  });

  test("isUtcOffset returns true when _isUTC is set", () => {
    const m = moment.utc();
    expect(m.isUtcOffset()).toBe(true);
  });
});

describe("moment.parseZone()", () => {
  test("preserves offset from ISO string", () => {
    const m = moment.parseZone("2024-01-15T10:30:00+05:30");
    expect(m.utcOffset()).toBe(330);
  });

  test("parseZone with no input clones", () => {
    const m = moment.parseZone();
    expect(m.isValid()).toBe(true);
  });

  test("parseZone with format preserves parsed offset", () => {
    const m = moment.parseZone("2024-01-15 10:30:00 +05:30", "YYYY-MM-DD HH:mm:ss Z");
    expect(m.isValid()).toBe(true);
  });
});

describe("moment.utcOffset()", () => {
  test("getter returns current offset", () => {
    const m = moment();
    expect(typeof m.utcOffset()).toBe("number");
  });

  test("setter with number", () => {
    const m = moment("2024-01-15");
    m.utcOffset(330);
    expect(m.utcOffset()).toBe(330);
    expect(m.isUtcOffset()).toBe(true);
  });

  test("setter with small number (< 16) treats as hours", () => {
    const m = moment("2024-01-15");
    m.utcOffset(5);
    expect(m.utcOffset()).toBe(300);
  });

  test("setter with string offset", () => {
    const m = moment("2024-01-15");
    m.utcOffset("+05:30");
    expect(m.utcOffset()).toBe(330);
  });

  test("setter with string offset (compact)", () => {
    const m = moment("2024-01-15");
    m.utcOffset("+0530");
    expect(m.utcOffset()).toBe(330);
  });

  test("setter with invalid string returns m", () => {
    const m = moment("2024-01-15");
    const result = m.utcOffset("invalid");
    expect(result).toBe(m);
  });

  test("setter with keepLocalTime", () => {
    const m = moment("2024-01-15T12:00:00");
    const origHour = m.hour();
    m.utcOffset(330, true);
    expect(m.utcOffset()).toBe(330);
    expect(m.hour()).toBe(origHour);
  });
});

describe("moment.zone()", () => {
  test("getter returns negative offset (moment.js compat)", () => {
    const m = moment.utc("2024-01-15");
    expect(m.zone()).toBe(0);
  });

  test("setter with string timezone", () => {
    const m = moment("2024-01-15");
    m.zone("+05:30");
    expect(typeof m.utcOffset()).toBe("number");
  });

  test("setter with number (< 16 treated as hours)", () => {
    const m = moment("2024-01-15");
    m.zone(5);
    expect(typeof m.utcOffset()).toBe("number");
  });

  test("setter with invalid string returns m", () => {
    const m = moment("2024-01-15");
    const result = m.zone("invalid");
    expect(result).toBe(m);
  });

  test("setter with numeric string", () => {
    const m = moment("2024-01-15");
    m.zone("5");
    expect(typeof m.utcOffset()).toBe("number");
  });

  test("setter with signed hours string", () => {
    const m = moment("2024-01-15");
    m.zone("+5");
    expect(typeof m.utcOffset()).toBe("number");
  });
});

describe("zoneAbbr / zoneName", () => {
  test("zoneAbbr for UTC", () => {
    const m = moment.utc("2024-01-15");
    expect(m.zoneAbbr()).toBe("UTC");
  });

  test("zoneAbbr for non-UTC", () => {
    const m = moment.utc("2024-01-15").utcOffset(330);
    expect(m.zoneAbbr()).toMatch(/^GMT[+-]/);
  });

  test("zoneAbbr for local moment", () => {
    const m = moment("2024-01-15");
    expect(m.zoneAbbr()).toBe("");
  });

  test("zoneName for UTC", () => {
    const m = moment.utc("2024-01-15");
    expect(m.zoneName()).toBe("Coordinated Universal Time");
  });

  test("zoneName for non-UTC", () => {
    const m = moment("2024-01-15");
    expect(m.zoneName()).toBe("");
  });
});

describe("isDST", () => {
  test("isDST returns boolean", () => {
    const m = moment("2024-06-15");
    expect(typeof m.isDST()).toBe("boolean");
  });

  test("isDST for UTC moment is false", () => {
    const m = moment.utc("2024-06-15");
    expect(m.isDST()).toBe(false);
  });

  test("isDST for UTC with offset is true (offset from 0)", () => {
    const m = moment.utc("2024-06-15").utcOffset(330);
    expect(m.isDST()).toBe(true);
  });
});

describe("hasAlignedHourOffset", () => {
  test("returns boolean", () => {
    const m = moment("2024-01-15");
    expect(typeof m.hasAlignedHourOffset()).toBe("boolean");
  });

  test("aligned offsets return true", () => {
    const m1 = moment.utc("2024-01-15").utcOffset(60);
    const m2 = moment.utc("2024-01-15").utcOffset(120);
    expect(m1.hasAlignedHourOffset(m2)).toBe(true);
  });
});

describe("local / UTC with keepLocalTime", () => {
  test("local() on UTC moment without keepLocalTime changes time", () => {
    const m = moment.utc("2024-01-15T10:00:00");
    const origValue = m.valueOf();
    m.local();
    expect(m.isLocal()).toBe(true);
    expect(m.valueOf()).toBe(origValue);
  });

  test("local() with keepLocalTime preserves display time", () => {
    const m = moment.utc("2024-01-15T10:00:00");
    const origHour = m.format("HH");
    m.local(true);
    expect(m.isLocal()).toBe(true);
  });

  test("utc() on local moment without keepLocalTime", () => {
    const m = moment("2024-01-15T10:00:00");
    const origValue = m.valueOf();
    m.utc();
    expect(m.isUTC()).toBe(true);
    expect(m.valueOf()).toBe(origValue);
  });

  test("utc() with keepLocalTime preserves display time", () => {
    const m = moment("2024-01-15T10:00:00");
    const origHour = m.format("HH");
    m.utc(true);
    expect(m.isUTC()).toBe(true);
  });

  test("utcOffset setter with keepLocalTime", () => {
    const m = moment("2024-01-15T12:00:00");
    const origHour = m.hour();
    m.utcOffset(330, true);
    expect(m.utcOffset()).toBe(330);
    expect(m.hour()).toBe(origHour);
  });

  test("zone setter with keepLocalTime", () => {
    const m = moment("2024-01-15T12:00:00");
    m.zone(-5, true);
    expect(typeof m.utcOffset()).toBe("number");
  });
});

describe("hasAlignedHourOffset", () => {
  test("returns boolean", () => {
    const m = moment("2024-01-15");
    expect(typeof m.hasAlignedHourOffset()).toBe("boolean");
  });

  test("aligned offsets return true", () => {
    const m1 = moment.utc("2024-01-15").utcOffset(60);
    const m2 = moment.utc("2024-01-15").utcOffset(120);
    expect(m1.hasAlignedHourOffset(m2)).toBe(true);
  });

  test("invalid moment returns false", () => {
    const m = moment("invalid");
    expect(m.hasAlignedHourOffset()).toBe(false);
  });
});

describe("parseZone with format and offset", () => {
  test("with ISO_8601 format", () => {
    const m = moment.parseZone("2024-01-15T10:30:00+05:30", "YYYY-MM-DDTHH:mm:ssZ");
    expect(m.utcOffset()).toBe(330);
  });

  test("with format and no offset in string, falls back to regex", () => {
    const m = moment.parseZone("2024-01-15 10:30:00 +05:30", "YYYY-MM-DD HH:mm:ss");
    expect(m.isValid()).toBe(true);
  });
});

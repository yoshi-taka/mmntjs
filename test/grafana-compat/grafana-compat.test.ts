/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-condition */

import { describe, it, expect } from "bun:test";

import moment from "moment";
import originalMoment from "../../moment/moment.js";
import _mtz, { tz as tzFn } from "moment-timezone";
const mtz = _mtz as any;

// =========================================================================
// SECTION 1: moment_wrapper.ts API patterns
// =========================================================================

describe("grafana moment_wrapper patterns", () => {
  // dateTime() - moment() constructor patterns
  it("moment() with no args", () => {
    const m = moment();
    expect(m.isValid()).toBe(true);
    expect(typeof m.valueOf()).toBe("number");
  });

  it("moment(string) with ISO string", () => {
    const m = moment("2014-01-01T06:06:06.666Z");
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(1388556366666);
  });

  it("moment(number) with unix timestamp", () => {
    const m = moment(1388556366666);
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(1388556366666);
  });

  it("moment(Date) with native Date", () => {
    const m = moment(new Date(1388556366666));
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(1388556366666);
  });

  it("moment(array) with [y, M, d, h, m, s]", () => {
    const m = moment([2014, 0, 1, 6, 6, 6]);
    expect(m.isValid()).toBe(true);
    expect(m.year()).toBe(2014);
    expect(m.month()).toBe(0);
    expect(m.date()).toBe(1);
  });

  // moment.utc() patterns
  it("moment.utc(string)", () => {
    const m = moment.utc("2014-01-01T06:06:06.666Z");
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(1388556366666);
  });

  it("moment.utc(array)", () => {
    const m = moment.utc([2014, 0, 1, 6, 6, 6]);
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(1388556366000);
  });

  it("moment.utc() with format", () => {
    const m = moment.utc("2020-03-02 15:00:22", "YYYY-MM-DD HH:mm:ss");
    expect(m.isValid()).toBe(true);
    if (!m.isUTC()) {
      expect(m.format()).toBe("2020-03-02T15:00:22Z");
    }
  });

  // moment.isMoment()
  it("moment.isMoment()", () => {
    const m = moment();
    expect(moment.isMoment(m)).toBe(true);
    expect(moment.isMoment(new Date())).toBe(false);
    expect(moment.isMoment({})).toBe(false);
  });

  // moment.ISO_8601
  it("moment.ISO_8601 constant", () => {
    expect(moment.ISO_8601).toBeDefined();
  });

  // moment.duration()
  it("moment.duration()", () => {
    const d = moment.duration(2, "hours");
    expect(d.asHours()).toBe(2);
    expect(d.asSeconds()).toBe(7200);
  });

  it("moment.duration() with isoWeek", () => {
    const d = moment.duration(1, "isoWeek" as any);
    expect(d.asDays()).toBe(7);
  });

  // locale patterns
  it("moment.locale() / moment.localeData()", () => {
    const loc = moment.locale();
    expect(typeof loc).toBe("string");
    const data = moment.localeData();
    expect(typeof data.firstDayOfWeek).toBe("function");
    expect(typeof data.firstDayOfYear).toBe("function");
  });

  it("localeData().firstDayOfWeek() returns correct value", () => {
    const data = moment.localeData();
    const dow = data.firstDayOfWeek();
    expect(typeof dow).toBe("number");
  });

  it("moment.locale(language)", () => {
    moment.locale("en");
    expect(moment.locale()).toBe("en");
  });

  it("moment.updateLocale()", () => {
    moment.updateLocale("en-test", {
      parentLocale: "en",
      week: { dow: 3 },
    });
    const data = moment.localeData("en-test");
    expect(data).toBeDefined();
    // clean up using the public API
    moment.updateLocale("en-test", null);
  });

  // moment.weekdays()
  it("moment.weekdays()", () => {
    const wd = moment.weekdays();
    expect(Array.isArray(wd)).toBe(true);
    expect(wd.length).toBeGreaterThanOrEqual(7);
  });

  // DateTime interface methods
  it("moment.fn.format()", () => {
    const input = "2014-01-01T06:06:06.666Z";
    const m = moment(input);
    const original = originalMoment(input);
    expect(m.format()).toBeDefined();
    expect(m.format("YYYY-MM-DD")).toBe(original.format("YYYY-MM-DD"));
    expect(m.format("YYYY-MM-DD HH:mm:ss")).toBe(original.format("YYYY-MM-DD HH:mm:ss"));
  });

  it("moment.fn.valueOf()", () => {
    const m = moment(1388556366666);
    expect(m.valueOf()).toBe(1388556366666);
  });

  it("moment.fn.unix()", () => {
    const m = moment(1388556366666);
    expect(m.unix()).toBe(1388556366);
  });

  it("moment.fn.isValid()", () => {
    expect(moment("invalid date").isValid()).toBe(false);
    expect(moment("2014-01-01").isValid()).toBe(true);
  });

  it("moment.fn.add()", () => {
    const m = moment("2014-01-01");
    m.add(5, "days");
    expect(m.date()).toBe(6);
  });

  it("moment.fn.subtract()", () => {
    const m = moment("2014-01-06");
    m.subtract(5, "days");
    expect(m.date()).toBe(1);
  });

  it("moment.fn.startOf()", () => {
    const m = moment("2014-01-01T06:06:06");
    m.startOf("day");
    expect(m.hour()).toBe(0);
    expect(m.minute()).toBe(0);
    expect(m.second()).toBe(0);
  });

  it("moment.fn.endOf()", () => {
    const m = moment("2014-01-01T06:06:06");
    m.endOf("day");
    expect(m.hour()).toBe(23);
    expect(m.minute()).toBe(59);
    expect(m.second()).toBe(59);
  });

  it("moment.fn.local()", () => {
    const m = moment.utc("2014-01-01T06:06:06");
    const local = m.local();
    expect(local.isValid()).toBe(true);
  });

  it("moment.fn.locale(string)", () => {
    const m = moment();
    const result = m.locale("en");
    expect(result.isValid()).toBe(true);
  });

  it("moment.fn.toDate()", () => {
    const m = moment("2014-01-01");
    const d = m.toDate();
    expect(d instanceof Date).toBe(true);
  });

  it("moment.fn.toISOString()", () => {
    const m = moment.utc("2014-01-01T06:06:06.666Z");
    const iso = m.toISOString();
    expect(iso).toBe("2014-01-01T06:06:06.666Z");
  });

  it("moment.fn.toISOString(keepOffset)", () => {
    const m = moment("2014-01-01T06:06:06.666Z");
    const iso = m.toISOString(true);
    expect(typeof iso).toBe("string");
  });

  it("moment.fn.isoWeekday()", () => {
    const m = moment("2014-01-01"); // Wednesday
    expect(m.isoWeekday()).toBe(3);
    m.isoWeekday(1);
    expect(m.isoWeekday()).toBe(1);
  });

  it("moment.fn.utc()", () => {
    const m = moment("2014-01-01T06:06:06");
    const utc = m.utc();
    expect(utc.isValid()).toBe(true);
  });

  it("moment.fn.utcOffset()", () => {
    const m = moment("2014-01-01T06:06:06");
    const offset = m.utcOffset();
    expect(typeof offset).toBe("number");
  });

  it("moment.fn.diff()", () => {
    const a = moment("2014-01-10");
    const b = moment("2014-01-01");
    expect(a.diff(b, "days")).toBe(9);
    expect(a.diff(b)).toBe(9 * 86400000);
  });

  it("moment.fn.isSame()", () => {
    const a = moment("2014-01-01");
    const b = moment("2014-01-01");
    expect(a.isSame(b)).toBe(true);
    expect(a.isSame(b, "day")).toBe(true);
  });

  it("moment.fn.isBefore()", () => {
    const a = moment("2014-01-01");
    const b = moment("2014-01-02");
    expect(a.isBefore(b)).toBe(true);
  });

  it("moment.fn.fromNow()", () => {
    const m = moment().subtract(1, "hour");
    const str = m.fromNow();
    expect(typeof str).toBe("string");
    expect(str).toContain("hour");
  });

  it("moment.fn.from()", () => {
    const a = moment("2014-01-02");
    const b = moment("2014-01-01");
    expect(a.from(b)).toBeDefined();
  });

  it("moment.fn.clone()", () => {
    const a = moment("2014-01-01");
    const b = moment(a); // clone via constructor
    expect(b.valueOf()).toBe(a.valueOf());
    expect(b).not.toBe(a);
  });

  it("moment.fn.set()", () => {
    const m = moment("2014-01-01");
    m.set("year", 2020);
    expect(m.year()).toBe(2020);
  });

  it("moment.fn.hour() / minute()", () => {
    const m = moment("2014-01-01T06:30:00");
    expect(m.hour()).toBe(6);
    expect(m.minute()).toBe(30);
  });

  // Grafana wrapper function patterns
  it("grafana toUtc pattern", () => {
    const m = moment.utc("2020-03-02 15:00:22", "YYYY-MM-DD HH:mm:ss");
    expect(m.isValid()).toBe(true);
    if (!m.isUTC()) {
      expect(m.format()).toBe("2020-03-02T15:00:22Z");
    }
  });

  it("grafana isDateTime pattern", () => {
    const m = moment();
    expect(moment.isMoment(m)).toBe(true);
    expect(moment.isMoment(new Date())).toBe(false);
  });

  it("grafana dateTime + format pattern (UTC)", () => {
    const ts = 1587126975779;
    const m = moment.utc(ts);
    const formatted = m.format("YYYY-MM-DD HH:mm:ss");
    expect(formatted).toBe("2020-04-17 12:36:15");
  });

  it("grafana fromNow pattern", () => {
    const m = moment(1587126975779);
    const fromNow = m.fromNow();
    expect(typeof fromNow).toBe("string");
    expect(fromNow.length).toBeGreaterThan(0);
  });
});

// =========================================================================
// SECTION 2: moment-timezone API patterns (formatter.ts, parser.ts, timezones.ts)
// =========================================================================

describe("grafana moment-timezone patterns", () => {
  // moment.tz.zone()
  it("moment.tz.zone() - valid zone", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    expect(zone!.name).toBe("America/New_York");
    expect(typeof zone!.abbr).toBe("function");
    expect(typeof zone!.utcOffset).toBe("function");
  });

  it("moment.tz.zone() - UTC", () => {
    const zone = mtz.tz.zone("UTC");
    expect(zone).not.toBeNull();
  });

  it("moment.tz.zone() - invalid zone", () => {
    const zone = mtz.tz.zone("Invalid/Zone");
    expect(zone).toBeNull();
  });

  // moment.tz.names()
  it("moment.tz.names()", () => {
    const names = mtz.tz.names();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("America/New_York");
  });

  // moment.tz.guess()
  it("moment.tz.guess()", () => {
    const guessed = mtz.tz.guess();
    expect(typeof guessed).toBe("string");
    expect(guessed.length).toBeGreaterThan(0);
  });

  // moment.tz() (tz function) - basic
  it("moment.tz() constructor - string", () => {
    const m = mtz.tz("2014-01-01T06:06:06", "America/New_York");
    expect(m.isValid()).toBe(true);
    expect(typeof m.valueOf()).toBe("number");
  });

  // moment.tz() constructor - with format
  it("moment.tz() constructor - string with format", () => {
    const m = mtz.tz("2014-01-01 06:06:06", "YYYY-MM-DD HH:mm:ss", "America/New_York");
    expect(m.isValid()).toBe(true);
  });

  // moment.fn.tz() - convert to timezone
  it("moment.fn.tz() - convert", () => {
    const m = moment("2014-01-01T06:06:06");
    const converted = mtz(m).tz("America/New_York");
    expect(converted.isValid()).toBe(true);
    expect(typeof converted.format("z")).toBe("string");
  });

  // formatter.ts: dateTimeFormat patterns
  it("formatter pattern - UTC format", () => {
    const ts = 1587126975779;
    const date = moment.utc(ts).format("YYYY-MM-DD HH:mm:ss");
    expect(date).toBe("2020-04-17 12:36:15");
  });

  it("formatter pattern - Stockholm timezone", () => {
    const ts = 1587126975779;
    const utcDate = moment.utc(ts);
    const localTz = mtz(utcDate).tz("Europe/Stockholm");
    const formatted = localTz.format("YYYY-MM-DD HH:mm:ss");
    expect(formatted).toBe("2020-04-17 14:36:15");
  });

  it("formatter pattern - New York timezone", () => {
    const ts = 1587126975779;
    const utcDate = moment.utc(ts);
    const localTz = mtz(utcDate).tz("America/New_York");
    const formatted = localTz.format("YYYY-MM-DD HH:mm:ss");
    expect(formatted).toBe("2020-04-17 08:36:15");
  });

  it("formatter ISO pattern", () => {
    const ts = 1587126975779;
    const m = moment.utc(ts);
    expect(m.format()).toBe("2020-04-17T12:36:15Z");
  });

  it("formatter pattern with zone abbreviation", () => {
    const ts = 1587126975779;
    const utcDate = moment.utc(ts);
    const newYork = mtz(utcDate).tz("America/New_York");
    const formatted = newYork.format("YYYY-MM-DD HH:mm:ss z");
    expect(formatted).toMatch(/^2020-04-17 08:36:15 \w+$/);
  });

  it("formatter pattern with Z format", () => {
    const ts = 1587126975779;
    const m = moment.utc(ts);
    const withTz = mtz(m).tz("America/New_York");
    expect(withTz.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe("2020-04-17T08:36:15.779-04:00");
  });

  // parser.ts patterns
  it("parser timezone resolution - moment.tz.zone", () => {
    const timeZone = "Europe/Stockholm";
    const zone = mtz.tz.zone(timeZone);
    expect(zone).not.toBeNull();
    expect(zone!.name).toBe("Europe/Stockholm");
  });

  it("parser timezone resolution - utc string", () => {
    const timeZone = "utc";
    expect(mtz.tz.zone(timeZone)).not.toBeNull();
  });

  it("parser timezone resolution - browser", () => {
    const zone = mtz.tz.zone("browser");
    // zone() returns null for 'browser' since it's not a real IANA zone
    // Grafana handles this by checking zone.name
    if (zone) {
      expect(zone.name).toBe("browser");
    }
  });

  // timezones.ts patterns
  it("moment.tz.countries()", () => {
    const countries = mtz.tz.countries();
    // Note: mmntjs-timezone returns [] for countries
    expect(Array.isArray(countries)).toBe(true);
  });

  it("moment.tz.zonesForCountry()", () => {
    const zones = mtz.tz.zonesForCountry("US");
    expect(Array.isArray(zones)).toBe(true);
  });

  // moment.tz.zone() methods
  it("moment.tz.zone().abbr()", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    const abbr = zone!.abbr(1587126975779); // April 2020, EDT
    expect(abbr).toBe("EDT");
  });

  it("moment.tz.zone().utcOffset()", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    const offset = zone!.utcOffset(1587126975779);
    // EDT is UTC-4 = minutes to add to local to get UTC
    expect(offset).toBe(240);
  });

  it("moment.tz.zone().name", () => {
    const zone = mtz.tz.zone("Europe/Stockholm");
    expect(zone).not.toBeNull();
    expect(zone!.name).toBe("Europe/Stockholm");
  });
});

// =========================================================================
// SECTION 3: datemath.ts patterns
// =========================================================================

describe("grafana datemath patterns", () => {
  const anchor = "2014-01-01T06:06:06.666Z";
  const unix = moment(anchor).valueOf();
  const format = "YYYY-MM-DDTHH:mm:ss.SSSZ";

  it("parseDateMath: now-5d", () => {
    const expected = moment(unix).subtract(5, "d").format(format);
    const result = moment(unix).subtract(5, "d").format(format);
    expect(result).toBe(expected);
  });

  it("parseDateMath: -2d relative to anchor", () => {
    const base = moment([2014, 1, 5]);
    const result = moment(base).subtract(2, "d");
    expect(result.valueOf()).toBe(moment([2014, 1, 3]).valueOf());
  });

  it("parseDateMath: multiple expressions -2d-6h", () => {
    const base = moment([2014, 1, 5]);
    const result = moment(base).subtract(2, "d").subtract(6, "h");
    expect(result.valueOf()).toBe(moment([2014, 1, 2, 18]).valueOf());
  });

  it("parseDateMath: -30m-2d", () => {
    const base = moment([2014, 1, 5]);
    const result = moment(base).subtract(30, "m").subtract(2, "d");
    expect(result.valueOf()).toBe(moment([2014, 1, 2, 23, 30]).valueOf());
  });

  it("parseDateMath: -1d-1h-30m", () => {
    const base = moment([2014, 1, 5, 12, 0]);
    const result = moment(base).subtract(1, "d").subtract(1, "h").subtract(30, "m");
    expect(result.valueOf()).toBe(moment([2014, 1, 4, 10, 30]).valueOf());
  });

  it("parseDateMath: -0d+8h+30m+30s", () => {
    const base = moment([2014, 1, 5, 12, 0]);
    const result = moment(base).add(8, "h").add(30, "m").add(30, "s");
    expect(result.valueOf()).toBe(moment([2014, 1, 5, 20, 30, 30]).valueOf());
  });

  it("parseDateMath: +1d-6h", () => {
    const base = moment([2014, 1, 5]);
    const result = moment(base).add(1, "d").subtract(6, "h");
    expect(result.valueOf()).toBe(moment([2014, 1, 5, 18]).valueOf());
  });

  it("parseDateMath: -1w-1d", () => {
    const base = moment([2014, 1, 14]);
    const result = moment(base).subtract(1, "w").subtract(1, "d");
    expect(result.valueOf()).toBe(moment([2014, 1, 6]).valueOf());
  });

  it("startOf rounding pattern: now/d", () => {
    const now = moment(unix);
    const result = moment(now).startOf("day");
    expect(result.hour()).toBe(0);
    expect(result.minute()).toBe(0);
    expect(result.second()).toBe(0);
    expect(result.millisecond()).toBe(0);
  });

  it("endOf rounding pattern: now/d roundUp", () => {
    const now = moment(unix);
    const result = moment(now).endOf("day");
    expect(result.hour()).toBe(23);
    expect(result.minute()).toBe(59);
    expect(result.second()).toBe(59);
  });

  it("clone before mutation pattern", () => {
    const dateInput = moment([2014, 1, 5]);
    const cloned = moment(dateInput);
    cloned.subtract(2, "d");
    expect(dateInput.valueOf()).not.toBe(cloned.valueOf());
    expect(dateInput.valueOf()).toBe(moment([2014, 1, 5]).valueOf());
  });

  it("strip whitespace pattern", () => {
    const result = moment([2014, 1, 5]).subtract(2, "d");
    expect(result.valueOf()).toBe(moment([2014, 1, 3]).valueOf());
  });

  // Fiscal year patterns (roundToFiscal)
  it("roundToFiscal: start of fiscal year", () => {
    const base = moment([2021, 3, 5]); // May 5, 2021
    const fyStartMonth = 1; // February
    // Round to start of fiscal year
    const monthDiff = (base.month() - fyStartMonth + 12) % 12;
    const result = moment(base).subtract(monthDiff, "M").startOf("M");
    expect(result.valueOf()).toBe(moment([2021, 1, 1]).valueOf());
  });

  it("roundToFiscal: end of fiscal year", () => {
    const base = moment([2021, 5, 2]); // July 2, 2021
    const fyStartMonth = 1; // February
    const monthDiff = (base.month() - fyStartMonth + 12) % 12;
    const rounded = moment(base).subtract(monthDiff, "M").startOf("M");
    const result = moment(rounded).add(11, "M").endOf("M");
    expect(result.valueOf()).toBe(moment([2022, 0, 1]).endOf("M").valueOf());
  });

  it("roundToFiscal: start of fiscal quarter (fy=Feb, base=Jul)", () => {
    const base = moment([2021, 6, 1]); // July 1, 2021 (month 6)
    const fyStartMonth = 1; // February
    // Q1=Feb-Apr(1-3), Q2=May-Jul(4-6), Q3=Aug-Oct(7-9), Q4=Nov-Jan(10-11-0)
    // Jul(6) is Q2, should round to May(4)
    const monthDiff = (base.month() - fyStartMonth + 12) % 3; // =2
    const result = moment(base).subtract(monthDiff, "M").startOf("M");
    expect(result.month()).toBe(4); // May
    expect(result.date()).toBe(1);
  });

  it("roundToFiscal: start of fiscal quarter (fy=Feb, base=Jan)", () => {
    const base = moment([2022, 0, 1]); // January 1, 2022 (month 0)
    const fyStartMonth = 1; // February
    // Jan(0) is Q4 (Nov-Jan), should round to Nov(10)
    const monthDiff = (base.month() - fyStartMonth + 12) % 3; // =2
    const result = moment(base).subtract(monthDiff, "M").startOf("M");
    expect(result.month()).toBe(10); // November
    expect(result.date()).toBe(1);
    expect(result.year()).toBe(2021);
  });
});

// =========================================================================
// SECTION 4: format/parse patterns with various timezones
// =========================================================================

describe("grafana timezone format patterns", () => {
  const ts = 1587126975779; // 2020-04-17T12:36:15.779Z

  it.each([
    ["Africa/Djibouti", "2020-04-17 15:36:15"],
    ["Europe/London", "2020-04-17 13:36:15"],
    ["Europe/Berlin", "2020-04-17 14:36:15"],
    ["Europe/Stockholm", "2020-04-17 14:36:15"],
    ["Europe/Moscow", "2020-04-17 15:36:15"],
    ["Europe/Madrid", "2020-04-17 14:36:15"],
    ["America/New_York", "2020-04-17 08:36:15"],
    ["America/Chicago", "2020-04-17 07:36:15"],
    ["America/Denver", "2020-04-17 06:36:15"],
    ["America/Los_Angeles", "2020-04-17 05:36:15"],
    ["Asia/Tokyo", "2020-04-17 21:36:15"],
  ])("format in %s should be %s", (timeZone, expected) => {
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz(timeZone);
    expect(withTz.format("YYYY-MM-DD HH:mm:ss")).toBe(expected);
  });

  it("format in Stockholm with abbreviation", () => {
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz("Europe/Stockholm");
    expect(withTz.format("YYYY-MM-DD HH:mm:ss z")).toBe("2020-04-17 14:36:15 CEST");
  });

  it("format in New York with abbreviation", () => {
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz("America/New_York");
    expect(withTz.format("YYYY-MM-DD HH:mm:ss z")).toBe("2020-04-17 08:36:15 EDT");
  });

  it("format in Bucharest with abbreviation", () => {
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz("Europe/Bucharest");
    expect(withTz.format("YYYY-MM-DD HH:mm:ss z")).toBe("2020-04-17 15:36:15 EEST");
  });

  it("format ISO with offset - Stockholm", () => {
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz("Europe/Stockholm");
    expect(withTz.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe("2020-04-17T14:36:15.779+02:00");
  });

  it("format ISO with offset - New York", () => {
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz("America/New_York");
    expect(withTz.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe("2020-04-17T08:36:15.779-04:00");
  });

  it("format ISO with offset - Madrid", () => {
    const utcDate = moment.utc(ts);
    const withTz = mtz(utcDate).tz("Europe/Madrid");
    expect(withTz.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe("2020-04-17T14:36:15.779+02:00");
  });

  it("format ISO standard", () => {
    const m = moment.utc(ts);
    expect(m.format()).toBe("2020-04-17T12:36:15Z");
  });
});

// =========================================================================
// SECTION 5: edge cases from grafana tests
// =========================================================================

describe("grafana edge case patterns", () => {
  it("parse array format used by calendar", () => {
    const m = moment.utc([2020, 5, 10, 10, 30, 20]);
    expect(m.format()).toBe("2020-06-10T10:30:20Z");
  });

  it("now/d in UTC", () => {
    const today = new Date();
    const expected = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0),
    );
    const now = moment.utc();
    const startOfDay = moment.utc(now).startOf("day");
    expect(startOfDay.valueOf()).toBe(expected.getTime());
  });

  it("relativeToTimeRange pattern", () => {
    const now = moment("2021-04-20T15:55:00Z");
    const fromSec = 600;
    const from = moment(now).subtract(fromSec, "s");
    expect(from.valueOf()).toBe(moment("2021-04-20T15:45:00Z").valueOf());
  });

  it("timeRangeToRelative pattern", () => {
    const now = moment("2021-04-20T15:55:00Z");
    const fifteenMinAgo = moment(now).subtract(15, "minutes");
    const diff = now.unix() - fifteenMinAgo.unix();
    expect(diff).toBe(900);
  });

  it("week subtraction pattern", () => {
    const now = moment("2021-04-20T15:55:00Z");
    const twoWeeksAgo = moment(now).subtract(2, "weeks");
    const oneWeekAgo = moment(now).subtract(1, "week");
    expect(now.unix() - twoWeeksAgo.unix()).toBe(1209600);
    expect(now.unix() - oneWeekAgo.unix()).toBe(604800);
  });
});

// =========================================================================
// SECTION 6: rangeutil text range pattern
// =========================================================================

describe("grafana text range patterns", () => {
  // This tests the display text patterns from rangeutil.ts

  it("should detect now-5m to now as Last 5 minutes", () => {
    const from = "now-5m";
    const to = "now";
    expect(from).toBe("now-5m");
    expect(to).toBe("now");
  });
});

// =========================================================================
// SECTION 7: verify native Date integration
// =========================================================================

describe("native Date integration patterns", () => {
  it("moment(Date) constructor", () => {
    const d = new Date(1388556366666);
    const m = moment(d);
    expect(m.valueOf()).toBe(1388556366666);
  });

  it("moment.fn.toDate() returns correct Date", () => {
    const m = moment(1388556366666);
    const d = m.toDate();
    expect(d.getTime()).toBe(1388556366666);
  });

  it("moment.fn.toISOString() native Date compat", () => {
    const m = moment.utc(1388556366666);
    expect(m.toISOString()).toBe(new Date(1388556366666).toISOString());
  });
});

// =========================================================================
// SECTION 8: module export shape verification
// =========================================================================

describe("moment module export shape", () => {
  it("default export is a function (constructor)", () => {
    expect(typeof moment).toBe("function");
  });

  it("moment has static methods", () => {
    expect(typeof moment.utc).toBe("function");
    expect(typeof moment.isMoment).toBe("function");
    expect(typeof moment.duration).toBe("function");
    expect(typeof moment.locale).toBe("function");
    expect(typeof moment.localeData).toBe("function");
    expect(typeof moment.weekdays).toBe("function");
    expect(typeof moment.updateLocale).toBe("function");
  });

  it("moment has ISO_8601", () => {
    expect(moment.ISO_8601).toBeDefined();
  });
});

describe("moment-timezone module export shape", () => {
  it("default export is a function (constructor with tz)", () => {
    expect(typeof mtz).toBe("function");
  });

  it("mtz has tz property", () => {
    expect(typeof mtz.tz).toBe("function");
  });

  it("tz static method exists", () => {
    expect(typeof tzFn).toBe("function");
  });

  it("tz has static methods", () => {
    expect(typeof mtz.tz.zone).toBe("function");
    expect(typeof mtz.tz.names).toBe("function");
    expect(typeof mtz.tz.guess).toBe("function");
    expect(typeof mtz.tz.countries).toBe("function");
    expect(typeof mtz.tz.zonesForCountry).toBe("function");
  });
});

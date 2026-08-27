/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-condition */

import { describe, it, expect } from "bun:test";

import moment from "moment";
import originalMoment from "../../moment/moment.js";
import _mtz from "moment-timezone";
const mtz = _mtz as any;

// Load locales needed for tests
import { deLocale } from "../../src/locale/de";
import { jaLocale } from "../../src/locale/ja";
moment.defineLocale("de", deLocale as any);
moment.defineLocale("ja", jaLocale as any);
moment.locale("en");

// =========================================================================
// SECTION 1: Core constructor and conversion patterns
// =========================================================================

describe("kibana core constructor patterns", () => {
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

  it("moment(number) with unix timestamp ms", () => {
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

  it("moment.utc() with no args", () => {
    const m = moment.utc();
    expect(m.isValid()).toBe(true);
    expect(m.isUTC()).toBe(true);
  });

  it("moment.utc(string)", () => {
    const m = moment.utc("2014-01-01T06:06:06.666Z");
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(1388556366666);
  });

  it("moment.utc(number)", () => {
    const m = moment.utc(1587126975779);
    expect(m.format()).toBe("2020-04-17T12:36:15Z");
  });

  it("moment.utc(array)", () => {
    const m = moment.utc([2014, 0, 1, 6, 6, 6]);
    expect(m.isValid()).toBe(true);
    expect(m.valueOf()).toBe(1388556366000);
  });

  it("moment.utc() with format string", () => {
    const m = moment.utc("2020-03-02 15:00:22", "YYYY-MM-DD HH:mm:ss");
    expect(m.isValid()).toBe(true);
    expect(m.format()).toBe("2020-03-02T15:00:22Z");
  });

  it("moment.isMoment() type guard", () => {
    const m = moment();
    expect(moment.isMoment(m)).toBe(true);
    expect(moment.isMoment(new Date())).toBe(false);
    expect(moment.isMoment({})).toBe(false);
  });

  it("moment.isDuration() type guard", () => {
    const d = moment.duration(5, "minutes");
    expect(moment.isDuration(d)).toBe(true);
    expect(moment.isDuration({})).toBe(false);
  });

  it("moment.fn.clone()", () => {
    const a = moment("2014-01-01T06:06:06");
    const b = a.clone();
    expect(b.valueOf()).toBe(a.valueOf());
    expect(b).not.toBe(a);
    b.add(1, "day");
    expect(b.valueOf()).not.toBe(a.valueOf());
  });

  it("moment.fn.valueOf()", () => {
    const m = moment(1388556366666);
    expect(m.valueOf()).toBe(1388556366666);
  });

  it("moment.fn.toDate()", () => {
    const m = moment(1388556366666);
    const d = m.toDate();
    expect(d instanceof Date).toBe(true);
    expect(d.getTime()).toBe(1388556366666);
  });

  it("moment.fn.toISOString()", () => {
    const m = moment.utc("2014-01-01T06:06:06.666Z");
    expect(m.toISOString()).toBe("2014-01-01T06:06:06.666Z");
  });
});

// =========================================================================
// SECTION 2: Format patterns (field formatters, display)
// =========================================================================

describe("kibana format patterns", () => {
  const ts = 1587126975779;

  it("moment.format() with default pattern", () => {
    const m = moment.utc(ts);
    expect(m.format()).toBe("2020-04-17T12:36:15Z");
  });

  it("moment.format('YYYY-MM-DD HH:mm:ss')", () => {
    const m = moment.utc(ts);
    expect(m.format("YYYY-MM-DD HH:mm:ss")).toBe("2020-04-17 12:36:15");
  });

  it("moment.format('YYYY-MM-DD')", () => {
    const m = moment.utc(ts);
    expect(m.format("YYYY-MM-DD")).toBe("2020-04-17");
  });

  it("moment.format('ll') locale-aware", () => {
    const m = moment.utc(ts);
    const formatted = m.format("ll");
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("moment.format('L') locale-aware date", () => {
    const m = moment("2014-01-01");
    expect(m.format("L")).toBe("01/01/2014");
  });

  it("moment.format('LT') locale-aware time", () => {
    const m = moment("2014-01-01T14:30:00");
    const lt = m.format("LT");
    expect(typeof lt).toBe("string");
    expect(lt.length).toBeGreaterThan(0);
  });

  it("moment.format('LTS') locale-aware time with seconds", () => {
    const m = moment("2014-01-01T14:30:15");
    const lts = m.format("LTS");
    expect(typeof lts).toBe("string");
    expect(lts.length).toBeGreaterThan(0);
  });

  it("moment.format with UTC offset Z format", () => {
    const m = moment.utc(ts);
    expect(m.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe("2020-04-17T12:36:15.779+00:00");
  });

  it("moment.fn.locale(string) then format", () => {
    const m = moment("2014-01-01T14:30:00");
    m.locale("de");
    expect(m.format("LL")).toBe("1. Januar 2014");
    m.locale("en");
  });

  it("moment(value).locale(locale).format(pattern) [field formatter pattern]", () => {
    const input = "2014-01-01T06:06:06.666Z";
    const pattern = "MMMM Do YYYY, h:mm:ss a";
    const formatted = moment(input).locale("en").format(pattern);
    expect(formatted).toBe(originalMoment(input).locale("en").format(pattern));
  });

  it("moment.utc(value).tz(timezone).format(pattern) [server formatter]", () => {
    const formatted = moment.utc(ts).tz("America/New_York").format("YYYY-MM-DD HH:mm:ss");
    expect(formatted).toBe("2020-04-17 08:36:15");
  });

  it("moment.utc(value).tz(timezone).format(pattern) with zone abbr", () => {
    const formatted = moment.utc(ts).tz("America/New_York").format("YYYY-MM-DD HH:mm:ss z");
    expect(formatted).toBe("2020-04-17 08:36:15 EDT");
  });
});

// =========================================================================
// SECTION 3: Date math patterns (add, subtract, startOf, endOf)
// =========================================================================

describe("kibana date math patterns", () => {
  it("moment.fn.add(5, 'days')", () => {
    const m = moment("2014-01-01");
    m.add(5, "days");
    expect(m.date()).toBe(6);
  });

  it("moment.fn.subtract(5, 'days')", () => {
    const m = moment("2014-01-06");
    m.subtract(5, "days");
    expect(m.date()).toBe(1);
  });

  it("moment.fn.add(1, 'hour')", () => {
    const m = moment("2014-01-01T06:00:00");
    m.add(1, "hour");
    expect(m.hour()).toBe(7);
  });

  it("moment.fn.subtract(15, 'minutes')", () => {
    const m = moment("2014-01-01T06:30:00");
    m.subtract(15, "minutes");
    expect(m.minute()).toBe(15);
  });

  it("moment.fn.add(2, 'weeks')", () => {
    const m = moment("2014-01-01");
    m.add(2, "weeks");
    expect(m.date()).toBe(15);
  });

  it("moment.fn.subtract(1, 'year')", () => {
    const m = moment("2014-01-01");
    m.subtract(1, "year");
    expect(m.year()).toBe(2013);
  });

  it("moment.fn.startOf('day') [datemath now/d pattern]", () => {
    const m = moment("2014-01-01T14:30:15.123");
    m.startOf("day");
    expect(m.hour()).toBe(0);
    expect(m.minute()).toBe(0);
    expect(m.second()).toBe(0);
    expect(m.millisecond()).toBe(0);
  });

  it("moment.fn.startOf('month')", () => {
    const m = moment("2014-03-15");
    m.startOf("month");
    expect(m.date()).toBe(1);
    expect(m.hour()).toBe(0);
  });

  it("moment.fn.startOf('year')", () => {
    const m = moment("2014-06-15");
    m.startOf("year");
    expect(m.month()).toBe(0);
    expect(m.date()).toBe(1);
  });

  it("moment.fn.startOf('week')", () => {
    const m = moment("2014-01-15"); // Wednesday
    m.startOf("week");
    expect(m.day()).toBe(0); // Sunday (locale default)
  });

  it("moment.fn.endOf('day')", () => {
    const m = moment("2014-01-01T06:06:06");
    m.endOf("day");
    expect(m.hour()).toBe(23);
    expect(m.minute()).toBe(59);
    expect(m.second()).toBe(59);
  });

  it("moment.fn.endOf('month')", () => {
    const m = moment("2014-01-15");
    m.endOf("month");
    expect(m.date()).toBe(31);
  });

  it("chained add/subtract [datemath now-5d-2h]", () => {
    const base = moment("2014-01-10T12:00:00");
    const result = moment(base).subtract(5, "d").subtract(2, "h");
    expect(result.format("YYYY-MM-DD HH:mm")).toBe("2014-01-05 10:00");
  });

  it("add then startOf [datemath now+1d/d]", () => {
    const now = moment("2014-01-10T14:30:00");
    const result = moment(now).add(1, "d").startOf("day");
    expect(result.year()).toBe(2014);
    expect(result.month()).toBe(0);
    expect(result.date()).toBe(11);
    expect(result.hour()).toBe(0);
    expect(result.minute()).toBe(0);
    expect(result.second()).toBe(0);
  });

  it("clone before mutation pattern", () => {
    const original = moment("2014-01-10");
    const modified = moment(original).subtract(2, "d");
    expect(original.valueOf()).toBe(moment("2014-01-10").valueOf());
    expect(modified.valueOf()).toBe(moment("2014-01-08").valueOf());
  });
});

// =========================================================================
// SECTION 4: Comparison patterns (diff, isBefore, isAfter, isSame)
// =========================================================================

describe("kibana comparison patterns", () => {
  it("moment.fn.diff() in milliseconds", () => {
    const a = moment("2014-01-10");
    const b = moment("2014-01-01");
    expect(a.diff(b)).toBe(9 * 86400000);
  });

  it("moment.fn.diff() in days", () => {
    const a = moment("2014-01-10");
    const b = moment("2014-01-01");
    expect(a.diff(b, "days")).toBe(9);
  });

  it("moment.fn.diff() in hours", () => {
    const a = moment("2014-01-01T12:00:00");
    const b = moment("2014-01-01T06:00:00");
    expect(a.diff(b, "hours")).toBe(6);
  });

  it("moment.fn.diff() in minutes", () => {
    const a = moment("2014-01-01T06:30:00");
    const b = moment("2014-01-01T06:00:00");
    expect(a.diff(b, "minutes")).toBe(30);
  });

  it("moment.fn.isBefore()", () => {
    const a = moment("2014-01-01");
    const b = moment("2014-01-02");
    expect(a.isBefore(b)).toBe(true);
    expect(b.isBefore(a)).toBe(false);
  });

  it("moment.fn.isAfter()", () => {
    const a = moment("2014-01-02");
    const b = moment("2014-01-01");
    expect(a.isAfter(b)).toBe(true);
    expect(b.isAfter(a)).toBe(false);
  });

  it("moment.fn.isSame()", () => {
    const a = moment("2014-01-01");
    const b = moment("2014-01-01");
    expect(a.isSame(b)).toBe(true);
  });

  it("moment.fn.isSame() with unit", () => {
    const a = moment("2014-01-01T06:00:00");
    const b = moment("2014-01-01T12:00:00");
    expect(a.isSame(b, "day")).toBe(true);
    expect(a.isSame(b, "hour")).toBe(false);
  });

  it("moment.fn.isValid()", () => {
    expect(moment("2014-01-01").isValid()).toBe(true);
    expect(moment("invalid date").isValid()).toBe(false);
  });
});

// =========================================================================
// SECTION 5: Duration patterns (TimeBuckets, interval calc)
// =========================================================================

describe("kibana duration patterns", () => {
  it("moment.duration(2, 'hours')", () => {
    const d = moment.duration(2, "hours");
    expect(d.asHours()).toBe(2);
    expect(d.asMilliseconds()).toBe(7200000);
    expect(d.asSeconds()).toBe(7200);
  });

  it("moment.duration(30, 'minutes')", () => {
    const d = moment.duration(30, "minutes");
    expect(d.asMinutes()).toBe(30);
    expect(d.asMilliseconds()).toBe(1800000);
  });

  it("moment.duration(7, 'days')", () => {
    const d = moment.duration(7, "days");
    expect(d.asDays()).toBe(7);
    expect(d.asWeeks()).toBe(1);
  });

  it("moment.duration(1, 'isoWeek')", () => {
    const d = moment.duration(1, "isoWeek" as any);
    expect(d.asDays()).toBe(7);
  });

  it("moment.duration.humanize()", () => {
    const d = moment.duration(2, "hours");
    expect(d.humanize()).toBe("2 hours");
  });

  it("moment.duration.humanize() for small values", () => {
    const d = moment.duration(30, "seconds");
    expect(d.humanize()).toBe("a few seconds");
  });

  it("moment.duration(ms) from millis", () => {
    const d = moment.duration(7200000);
    expect(d.asHours()).toBe(2);
  });

  it("moment.duration.toISOString()", () => {
    const d = moment.duration(2, "hours");
    expect(d.toISOString()).toBe("PT2H");
  });

  it("moment.duration.asMilliseconds() for interval math", () => {
    const d = moment.duration(5, "minutes");
    expect(d.asMilliseconds()).toBe(300000);
    expect(d.valueOf()).toBe(300000);
  });
});

// =========================================================================
// SECTION 6: Locale / i18n patterns
// =========================================================================

describe("kibana locale patterns", () => {
  it("moment.locale() returns current locale", () => {
    const loc = moment.locale();
    expect(typeof loc).toBe("string");
  });

  it("moment.locale(language) sets locale", () => {
    moment.locale("en");
    expect(moment.locale()).toBe("en");
  });

  it("moment.locale('de') for German", () => {
    moment.locale("de");
    expect(moment.locale()).toBe("de");
    moment.locale("en");
  });

  it("moment.fn.locale('ja') on instance", () => {
    const m = moment("2014-01-01");
    m.locale("ja");
    expect(m.format("MMMM")).toBe("1月");
  });

  it("moment.updateLocale() for custom relative time (ss)", () => {
    moment.updateLocale("en-ss-test", {
      parentLocale: "en",
      relativeTime: {
        ss: "%d seconds",
      },
    });
    // Need to lower ss threshold so values between ssThresh+1 and sThresh-1 use ss key
    const origSs = moment.relativeTimeThreshold("ss");
    moment.relativeTimeThreshold("ss", 1);
    const d = moment.duration(30, "seconds");
    expect(d.locale("en-ss-test").humanize()).toBe("30 seconds");
    moment.relativeTimeThreshold("ss", origSs);
    moment.updateLocale("en-ss-test", null);
  });

  it("moment.relativeTimeThreshold() for ss", () => {
    const orig = moment.relativeTimeThreshold("ss");
    moment.relativeTimeThreshold("ss", 1);
    // 2 seconds is now > ss threshold (1) and < s threshold (45)
    const d = moment.duration(2, "seconds");
    expect(d.humanize()).toBe("2 seconds");
    // 44 seconds falls into ss range with ss_thresh=1
    const d2 = moment.duration(44, "seconds");
    expect(d2.humanize()).toBe("44 seconds");
    moment.relativeTimeThreshold("ss", orig);
  });

  it("moment.relativeTimeRounding()", () => {
    const orig = moment.relativeTimeRounding();
    moment.relativeTimeRounding(Math.floor);
    const d = moment.duration(119, "seconds");
    expect(d.humanize()).toBe("a minute");
    moment.relativeTimeRounding(orig);
  });
});

// =========================================================================
// SECTION 7: Timezone / moment-timezone patterns
// =========================================================================

describe("kibana moment-timezone patterns", () => {
  const ts = 1587126975779;

  it("moment.tz.guess() returns timezone string", () => {
    const guessed = mtz.tz.guess();
    expect(typeof guessed).toBe("string");
    expect(guessed.length).toBeGreaterThan(0);
  });

  it("moment.tz.zone() for valid IANA zone", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    expect(zone!.name).toBe("America/New_York");
    expect(typeof zone!.abbr).toBe("function");
    expect(typeof zone!.utcOffset).toBe("function");
  });

  it("moment.tz.zone() for UTC", () => {
    const zone = mtz.tz.zone("UTC");
    expect(zone).not.toBeNull();
  });

  it("moment.tz.zone() returns null for invalid zone", () => {
    const zone = mtz.tz.zone("Invalid/Zone");
    expect(zone).toBeNull();
  });

  it("moment.tz.names() returns zone names", () => {
    const names = mtz.tz.names();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("America/New_York");
  });

  it("moment.tz.zone().abbr(ts) returns abbreviation", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    expect(zone!.abbr(ts)).toBe("EDT");
  });

  it("moment.tz.zone().utcOffset(ts) returns offset minutes", () => {
    const zone = mtz.tz.zone("America/New_York");
    expect(zone).not.toBeNull();
    expect(zone!.utcOffset(ts)).toBe(240);
  });

  it("moment.tz(string, timezone) constructor [timeslider pattern]", () => {
    const m = mtz.tz("2014-01-01T06:06:06", "America/New_York");
    expect(m.isValid()).toBe(true);
    expect(typeof m.valueOf()).toBe("number");
  });

  it("moment.tz(number, timezone) constructor", () => {
    const m = mtz.tz(ts, "America/New_York");
    expect(m.isValid()).toBe(true);
    expect(m.format("YYYY-MM-DD HH:mm:ss")).toBe("2020-04-17 08:36:15");
  });

  it("moment.fn.tz() conversion", () => {
    const m = moment.utc(ts);
    const converted = mtz(m).tz("America/New_York");
    expect(converted.isValid()).toBe(true);
    expect(converted.format("YYYY-MM-DD HH:mm:ss")).toBe("2020-04-17 08:36:15");
  });

  it("moment.utc(m).tz(tz).locale(locale).format(pattern) [timeslider format]", () => {
    const formatted = mtz.tz(ts, "America/New_York").locale("en").format("MMMM Do YYYY, HH:mm:ss");
    expect(formatted).toBe("April 17th 2020, 08:36:15");
  });

  it("moment.tz.zone() check for getTimeZone fallback", () => {
    const timeZone = "Browser";
    const zone = mtz.tz.zone(timeZone);
    // 'Browser' is not a real IANA zone; Kibana falls back to guess()
    if (!zone) {
      const fallback = mtz.tz.guess();
      expect(typeof fallback).toBe("string");
    } else {
      expect(zone.name).toBe(timeZone);
    }
  });

  it("format with timezone across multiple zones", () => {
    const zones = [
      ["America/New_York", "2020-04-17 08:36:15 EDT"],
      ["America/Chicago", "2020-04-17 07:36:15 CDT"],
      ["Europe/London", "2020-04-17 13:36:15 BST"],
      ["Europe/Berlin", "2020-04-17 14:36:15 CEST"],
      ["Asia/Tokyo", "2020-04-17 21:36:15 JST"],
    ];

    zones.forEach(([timezone, expected]) => {
      const formatted = moment.utc(ts).tz(timezone).format("YYYY-MM-DD HH:mm:ss z");
      expect(formatted).toBe(expected);
    });
  });
});

// =========================================================================
// SECTION 8: Setter/getter patterns
// =========================================================================

describe("kibana getter/setter patterns", () => {
  it("moment.fn.year() getter", () => {
    const m = moment("2014-01-01");
    expect(m.year()).toBe(2014);
  });

  it("moment.fn.year() setter", () => {
    const m = moment("2014-01-01");
    m.year(2020);
    expect(m.year()).toBe(2020);
  });

  it("moment.fn.month() getter", () => {
    const m = moment("2014-05-01");
    expect(m.month()).toBe(4);
  });

  it("moment.fn.month() setter", () => {
    const m = moment("2014-01-01");
    m.month(4);
    expect(m.month()).toBe(4);
    expect(m.format("MMM")).toBe("May");
  });

  it("moment.fn.date() getter", () => {
    const m = moment("2014-01-15");
    expect(m.date()).toBe(15);
  });

  it("moment.fn.date() setter", () => {
    const m = moment("2014-01-01");
    m.date(15);
    expect(m.date()).toBe(15);
  });

  it("moment.fn.hour() getter", () => {
    const m = moment("2014-01-01T06:30:00");
    expect(m.hour()).toBe(6);
  });

  it("moment.fn.minute() getter", () => {
    const m = moment("2014-01-01T06:30:00");
    expect(m.minute()).toBe(30);
  });

  it("moment.fn.second() getter", () => {
    const m = moment("2014-01-01T06:06:06");
    expect(m.second()).toBe(6);
  });

  it("moment.fn.millisecond() getter", () => {
    const m = moment("2014-01-01T06:06:06.666");
    expect(m.millisecond()).toBe(666);
  });

  it("moment.fn.day() getter", () => {
    const m = moment("2014-01-01"); // Wednesday
    expect(m.day()).toBe(3);
  });

  it("moment.fn.isoWeekday() getter/setter", () => {
    const m = moment("2014-01-01"); // Wednesday
    expect(m.isoWeekday()).toBe(3);
    m.isoWeekday(1);
    expect(m.isoWeekday()).toBe(1);
  });

  it("moment.fn.set('year', value)", () => {
    const m = moment("2014-01-01");
    m.set("year", 2020);
    expect(m.year()).toBe(2020);
  });

  it("moment.fn.set({ unit: value })", () => {
    const m = moment("2014-01-01");
    m.set({ year: 2020, month: 5 });
    expect(m.year()).toBe(2020);
    expect(m.month()).toBe(5);
  });
});

// =========================================================================
// SECTION 9: Relative time patterns (fromNow, from)
// =========================================================================

describe("kibana relative time patterns", () => {
  it("moment.fn.fromNow()", () => {
    const m = moment().subtract(1, "hour");
    const str = m.fromNow();
    expect(typeof str).toBe("string");
    expect(str).toContain("hour");
  });

  it("moment.fn.fromNow() without suffix", () => {
    const m = moment().subtract(1, "hour");
    const str = m.fromNow(true);
    expect(typeof str).toBe("string");
    expect(str).not.toContain("ago");
  });

  it("moment.fn.from(anchor) without suffix", () => {
    const a = moment("2014-01-02");
    const b = moment("2014-01-01");
    expect(a.from(b, true)).toBe("a day");
  });
});

// =========================================================================
// SECTION 10: Datemath (@kbn/datemath) patterns
// =========================================================================

describe("kibana datemath patterns", () => {
  const anchor = "2014-01-01T06:06:06.666Z";
  const unix = moment(anchor).valueOf();

  it("parseDateMath: now-5d", () => {
    const result = moment(unix).subtract(5, "d");
    expect(result.format("YYYY-MM-DD")).toBe("2013-12-27");
  });

  it("parseDateMath: now+3d", () => {
    const result = moment(unix).add(3, "d");
    expect(result.format("YYYY-MM-DD")).toBe("2014-01-04");
  });

  it("parseDateMath: now-2d-6h (chained subtract)", () => {
    const result = moment(unix).subtract(2, "d").subtract(6, "h");
    expect(result.valueOf()).toBe(unix - (2 * 24 + 6) * 60 * 60 * 1000);
  });

  it("parseDateMath: now+1h+30m (chained add)", () => {
    const result = moment(unix).add(1, "h").add(30, "m");
    expect(result.valueOf()).toBe(unix + 90 * 60 * 1000);
  });

  it("parseDateMath: now-30m (minutes)", () => {
    const result = moment(unix).subtract(30, "m");
    expect(result.valueOf()).toBe(unix - 30 * 60 * 1000);
  });

  it("parseDateMath: now/d (start of day rounding)", () => {
    const result = moment(unix).startOf("day");
    expect(result.format("YYYY-MM-DD HH:mm:ss")).toBe("2014-01-01 00:00:00");
  });

  it("parseDateMath: now/w (start of week rounding)", () => {
    const result = moment(unix).startOf("week");
    expect(result.format("YYYY-MM-DD")).toBe("2013-12-29"); // locale-dependent
  });

  it("parseDateMath: now/M (start of month rounding)", () => {
    const result = moment(unix).startOf("month");
    expect(result.format("YYYY-MM-DD")).toBe("2014-01-01");
  });

  it("parseDateMath: now/y (start of year rounding)", () => {
    const result = moment(unix).startOf("year");
    expect(result.format("YYYY-MM-DD")).toBe("2014-01-01");
  });
});

// =========================================================================
// SECTION 11: Time bucket / interval patterns
// =========================================================================

describe("kibana time bucket patterns", () => {
  it("calcAutoIntervalNear with moment.duration", () => {
    const esUnit = "d";
    const esValue = 1;
    const d = moment.duration(esValue, esUnit as moment.unitOfTime.Base);
    expect(d.asMilliseconds()).toBe(86400000);
  });

  it("interval parsing with d/h/m/s units", () => {
    const intervals = [
      ["d", 86400000],
      ["h", 3600000],
      ["m", 60000],
      ["s", 1000],
      ["ms", 1],
    ] as const;
    intervals.forEach(([unit, expected]) => {
      const d = moment.duration(1, unit as any);
      expect(d.asMilliseconds()).toBe(expected);
    });
  });

  it("duration comparison for bucket scaling", () => {
    const oneMinute = moment.duration(1, "minute");
    const fiveMinutes = moment.duration(5, "minutes");
    expect(fiveMinutes.asMilliseconds()).toBeGreaterThan(oneMinute.asMilliseconds());
    expect(fiveMinutes.asMinutes()).toBe(5);
  });

  it("duration valueOf for interval math", () => {
    const d = moment.duration(1, "hour");
    expect(d.valueOf()).toBe(3600000);
    expect(+d).toBe(3600000);
  });

  it("duration isValid", () => {
    const d = moment.duration(5, "minutes");
    expect(d.isValid()).toBe(true);
  });
});

// =========================================================================
// SECTION 12: UTC / offset patterns
// =========================================================================

describe("kibana UTC/offset patterns", () => {
  it("moment.fn.utc() converts to UTC mode", () => {
    const m = moment("2014-01-01T06:06:06");
    const utc = m.utc();
    expect(utc.isUTC()).toBe(true);
  });

  it("moment.fn.local() converts to local mode", () => {
    const m = moment.utc("2014-01-01T06:06:06");
    const local = m.local();
    expect(local.isValid()).toBe(true);
    expect(local.isUTC()).toBe(false);
  });

  it("moment.fn.utcOffset() getter returns number", () => {
    const m = moment("2014-01-01T06:06:06");
    const offset = m.utcOffset();
    expect(typeof offset).toBe("number");
  });

  it("moment.fn.isUTC() detection", () => {
    const m = moment();
    expect(m.isUTC()).toBe(false);
    const utc = moment.utc();
    expect(utc.isUTC()).toBe(true);
  });

  it("moment.fn.isLocal() detection", () => {
    const m = moment();
    expect(m.isLocal()).toBe(true);
    const utc = moment.utc();
    expect(utc.isLocal()).toBe(false);
  });

  it("utc offset keepLocalTime pattern", () => {
    const m = moment("2014-01-01T06:06:06");
    m.utcOffset();
    const changed = m.clone().utcOffset(120, true);
    expect(changed.isValid()).toBe(true);
    expect(changed.format("HH:mm")).toBe("06:06");
  });
});

// =========================================================================
// SECTION 13: Module export shape verification
// =========================================================================

describe("moment module export shape (Kibana expected)", () => {
  it("default export is a function (constructor)", () => {
    expect(typeof moment).toBe("function");
  });

  it("moment has static methods kibana depends on", () => {
    expect(typeof moment.utc).toBe("function");
    expect(typeof moment.isMoment).toBe("function");
    expect(typeof moment.duration).toBe("function");
    expect(typeof moment.locale).toBe("function");
    expect(typeof moment.localeData).toBe("function");
    expect(typeof moment.updateLocale).toBe("function");
    expect(typeof moment.relativeTimeRounding).toBe("function");
    expect(typeof moment.relativeTimeThreshold).toBe("function");
  });

  it("moment has ISO_8601 constant", () => {
    expect(moment.ISO_8601).toBeDefined();
  });

  it("Moment prototype has required methods", () => {
    const m = moment();
    expect(typeof m.format).toBe("function");
    expect(typeof m.valueOf).toBe("function");
    expect(typeof m.isValid).toBe("function");
    expect(typeof m.add).toBe("function");
    expect(typeof m.subtract).toBe("function");
    expect(typeof m.startOf).toBe("function");
    expect(typeof m.endOf).toBe("function");
    expect(typeof m.diff).toBe("function");
    expect(typeof m.clone).toBe("function");
    expect(typeof m.isBefore).toBe("function");
    expect(typeof m.isAfter).toBe("function");
    expect(typeof m.isSame).toBe("function");
    expect(typeof m.toDate).toBe("function");
    expect(typeof m.toISOString).toBe("function");
    expect(typeof m.year).toBe("function");
    expect(typeof m.month).toBe("function");
    expect(typeof m.date).toBe("function");
    expect(typeof m.hour).toBe("function");
    expect(typeof m.minute).toBe("function");
    expect(typeof m.second).toBe("function");
    expect(typeof m.millisecond).toBe("function");
    expect(typeof m.day).toBe("function");
    expect(typeof m.isoWeekday).toBe("function");
    expect(typeof m.locale).toBe("function");
    expect(typeof m.utc).toBe("function");
    expect(typeof m.local).toBe("function");
    expect(typeof m.isUTC).toBe("function");
    expect(typeof m.isLocal).toBe("function");
    expect(typeof m.set).toBe("function");
    expect(typeof m.get).toBe("function");
    expect(typeof m.fromNow).toBe("function");
    expect(typeof m.from).toBe("function");
  });

  it("Duration prototype has required methods", () => {
    const d = moment.duration(1, "hour");
    expect(typeof d.asMilliseconds).toBe("function");
    expect(typeof d.asSeconds).toBe("function");
    expect(typeof d.asMinutes).toBe("function");
    expect(typeof d.asHours).toBe("function");
    expect(typeof d.asDays).toBe("function");
    expect(typeof d.asWeeks).toBe("function");
    expect(typeof d.humanize).toBe("function");
    expect(typeof d.toISOString).toBe("function");
    expect(typeof d.isValid).toBe("function");
    expect(typeof d.valueOf).toBe("function");
    expect(typeof d.locale).toBe("function");
  });
});

describe("moment-timezone module export shape (Kibana expected)", () => {
  it("default export is a function (constructor with tz)", () => {
    expect(typeof mtz).toBe("function");
  });

  it("tz function has static methods", () => {
    expect(typeof mtz.tz).toBe("function");
    expect(typeof mtz.tz.zone).toBe("function");
    expect(typeof mtz.tz.names).toBe("function");
    expect(typeof mtz.tz.guess).toBe("function");
    expect(typeof mtz.tz.setDefault).toBe("function");
  });
});

import { describe, test, expect } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

describe("createFromFormattedStringInput", () => {
  describe("single format", () => {
    test("basic YYYY-MM-DD", () => {
      const m = moment("2024-01-15", "YYYY-MM-DD");
      expect(m.isValid()).toBe(true);
      expect(m.format("YYYY-MM-DD")).toBe("2024-01-15");
    });

    test("invalid format returns invalid", () => {
      const m = moment("hello", "YYYY");
      expect(m.isValid()).toBe(false);
    });

    test("format with locale as third arg", () => {
      const m = moment("2024-01-15", "YYYY-MM-DD", "en");
      expect(m.isValid()).toBe(true);
    });

    test("format with strict as third arg", () => {
      const m = moment("2024-01-15 extra", "YYYY-MM-DD", true);
      expect(m.isValid()).toBe(false);
    });

    test("format with locale + strict", () => {
      const m = moment("2024-01-15", "YYYY-MM-DD", "en", true);
      expect(m.isValid()).toBe(true);
    });

    test("format with strict as second arg", () => {
      const m = moment("2024-01-15", true);
      expect(m.isValid()).toBe(true);
    });

    test("defaults missing date fields like moment.js", () => {
      const oldNow = moment.now;
      const oldOriginalNow = originalMoment.now;
      const fixedNow = Date.UTC(2024, 5, 15, 18, 45);
      moment.now = () => fixedNow;
      originalMoment.now = () => fixedNow;
      try {
        for (const [input, format] of [
          ["12:13:14", "HH:mm:ss"],
          ["05", "DD"],
          ["05", "MM"],
          ["1996", "YYYY"],
        ]) {
          const actual = moment(input, format);
          const expected = originalMoment(input, format);
          expect(actual.format("YYYY-MM-DD HH:mm:ss")).toBe(expected.format("YYYY-MM-DD HH:mm:ss"));
          expect(actual.valueOf()).toBe(expected.valueOf());
        }
      } finally {
        moment.now = oldNow;
        originalMoment.now = oldOriginalNow;
      }
    });
  });

  describe("ISO_8601 as format string", () => {
    test("ISO date with ISO_8601 format", () => {
      const m = moment("2024-01-15", "ISO_8601");
      expect(m.isValid()).toBe(true);
    });

    test("ISO datetime with ISO_8601", () => {
      const m = moment("2024-01-15T10:30:00", "ISO_8601");
      expect(m.isValid()).toBe(true);
    });

    test("invalid ISO string returns invalid", () => {
      const m = moment("not-a-date", "ISO_8601");
      expect(m.isValid()).toBe(false);
    });
  });

  describe("RFC_2822 as format string", () => {
    test("RFC date with RFC_2822 format", () => {
      const m = moment("15 Jan 2024 10:30:00 +0000", "RFC_2822");
      expect(m.isValid()).toBe(true);
    });

    test("invalid RFC string returns invalid", () => {
      const m = moment("not-a-date", "RFC_2822");
      expect(m.isValid()).toBe(false);
    });
  });

  describe("multiple formats (array)", () => {
    test("picks first matching", () => {
      const m = moment("2024-01-15", ["YYYY-MM-DD", "MM-DD-YYYY"]);
      expect(m.isValid()).toBe(true);
      expect(m.year()).toBe(2024);
    });

    test("prefers better scoring format", () => {
      const m = moment("01-15-2024", ["YYYY-MM-DD", "MM-DD-YYYY"]);
      expect(m.isValid()).toBe(true);
    });

    test("strict rejects if no format matches exactly", () => {
      const m = moment("hello", ["YYYY", "MM"], true);
      expect(m.isValid()).toBe(false);
    });

    test("non-strict with no match returns invalid", () => {
      const m = moment("hello", ["YYYY", "MM"]);
      expect(m.isValid()).toBe(false);
    });

    test("empty format array returns invalid", () => {
      const m = moment("2024-01-15", []);
      expect(m.isValid()).toBe(false);
    });

    test("array with ISO_8601", () => {
      const m = moment("2024-01-15", ["ISO_8601", "YYYY-MM-DD"]);
      expect(m.isValid()).toBe(true);
    });

    test("array with RFC_2822 full date", () => {
      const m = moment("15 Jan 2024 10:30:00 +0000", ["RFC_2822", "YYYY-MM-DD"]);
      expect(m.isValid()).toBe(false);
    });

    test("defaults missing date fields for the selected format", () => {
      const oldNow = moment.now;
      const oldOriginalNow = originalMoment.now;
      const fixedNow = Date.UTC(2024, 5, 15, 18, 45);
      moment.now = () => fixedNow;
      originalMoment.now = () => fixedNow;
      try {
        const actual = moment("13:30", ["YYYY", "HH:mm"]);
        const expected = originalMoment("13:30", ["YYYY", "HH:mm"]);
        expect(actual.valueOf()).toBe(expected.valueOf());
        expect(actual.format("YYYY-MM-DD HH:mm")).toBe(expected.format("YYYY-MM-DD HH:mm"));
      } finally {
        moment.now = oldNow;
        originalMoment.now = oldOriginalNow;
      }
    });
  });

  describe("multiple formats with locale", () => {
    test("locale with array format", () => {
      const m = moment("2024-01-15", ["YYYY-MM-DD", "MM-DD-YYYY"], "en");
      expect(m.isValid()).toBe(true);
    });

    test("locale + strict with array format", () => {
      const m = moment("2024-01-15", ["YYYY-MM-DD"], "en", true);
      expect(m.isValid()).toBe(true);
    });
  });

  describe("format with no matching parser (custom not enabled)", () => {
    test("uses fallback when no custom parser", () => {
      const m = moment("2024-01-15", "YYYY-MM-DD");
      expect(m.isValid()).toBe(true);
    });
  });
});

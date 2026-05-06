import { expect, test } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

test("array-of-formats edge cases stay aligned with moment.js", () => {
  const cases = [
    {
      input: "11-02-1999",
      formats: ["MM-DD-YYYY", "DD-MM-YYYY"],
      expectedFormat: "MM-DD-YYYY",
    },
    {
      input: "11-02-10",
      formats: ["MM-DD-YY HH:mm", "YY MM DD"],
      expectedFormat: "YY MM DD",
    },
    {
      input: "13-10-1998",
      formats: ["DD MM YY", "DD MM YYYY"],
      expectedFormat: "DD MM YYYY",
    },
  ];

  for (const entry of cases) {
    const m2 = moment(entry.input, entry.formats as string[]);
    const orig = originalMoment(entry.input, entry.formats as string[]);
    expect((m2 as Record<string, unknown>)._f).toBe(entry.expectedFormat);
    expect((m2 as Record<string, unknown>)._f).toBe((orig as Record<string, unknown>)._f);
    expect(m2.isValid()).toBe(orig.isValid());
    if (m2.isValid() && orig.isValid()) {
      expect(m2.valueOf()).toBe(orig.valueOf());
    }
  }
});

test("strict array-of-formats rejects partial matches the same way as moment.js", () => {
  const cases = [
    { input: "0207", formats: ["MM-DD-YYYY", "DD-MM-YYYY"] },
    { input: "04- ", formats: ["MM-DD-YY HH:mm", "YY MM DD"] },
  ];

  for (const entry of cases) {
    const m2 = moment(entry.input, entry.formats as string[], true);
    const orig = originalMoment(entry.input, entry.formats as string[], true);
    expect((m2 as Record<string, unknown>)._f).toBe((orig as Record<string, unknown>)._f);
  }
});

test("strict single-format requires literal spaces like moment.js", () => {
  const cases = [
    { input: "051179", format: "DD MM YY" },
    { input: "05 11 79", format: "DD MM YY" },
  ];

  for (const entry of cases) {
    const m2 = moment(entry.input, entry.format as any, true);
    const orig = originalMoment(entry.input, entry.format as any, true);
    expect(m2.isValid()).toBe(orig.isValid());
    expect((m2 as any)._f).toBe((orig as any)._f);
  }
});

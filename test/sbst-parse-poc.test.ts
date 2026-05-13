import { expect, test } from "bun:test";
import moment from "../src/index.ts";
import originalMoment from "../moment/moment.js";

test("strict ISO branch examples stay aligned with moment.js", () => {
  const samples = ["2024-01-01T1234", "20240101T12:34", "2024-W12T1"];

  for (const sample of samples) {
    const m2 = moment(sample, "ISO_8601", true);
    const orig = originalMoment(sample, "ISO_8601", true);
    expect(m2.isValid()).toBe(false);
    expect(m2.isValid()).toBe(orig.isValid());
  }
});

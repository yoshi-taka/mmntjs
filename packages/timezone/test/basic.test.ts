/**
 * Minimal install/smoke checks.
 *
 * This file only verifies the module loads and the basic API surface works.
 * All behavioral tests are in the focused test files in this directory.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment } from "./helper";

describe("timezone module loads", () => {
  test("moment.tz is a function", () => {
    expect(typeof moment.tz).toBe("function");
  });

  test("moment.fn.tz is a function", () => {
    expect(typeof moment.fn.tz).toBe("function");
  });

  test("moment.tz.names is a function", () => {
    expect(typeof moment.tz.names).toBe("function");
  });

  test("moment.tz.guess is a function", () => {
    expect(typeof moment.tz.guess).toBe("function");
  });

  test("moment.tz.zone is a function", () => {
    expect(typeof moment.tz.zone).toBe("function");
  });

  test("moment.tz() with no args returns valid moment", () => {
    expect(moment.tz().isValid()).toBe(true);
  });

  test("moment.tz(zone) creates moment in zone", () => {
    const m = moment.tz("Asia/Tokyo");
    expect(m.isValid()).toBe(true);
    expect(typeof m.tz()).toBe("string");
  });
});

/* oxlint-disable no-explicit-any */
import { expect } from "bun:test";
import _moment from "mmntjs";
import { installTimezone } from "../src/install";
import _momentTimezone from "moment-timezone";

installTimezone(_moment as any);

export const moment = _moment as any;
export const momentTimezone = _momentTimezone as any;

export function oracleEqual(mm: any, om: any, opts?: { skipAbbr?: boolean }): void {
  expect(mm.isValid()).toBe(om.isValid());
  if (!om.isValid()) {
    return;
  }
  expect(mm.valueOf()).toBe(om.valueOf());
  expect(mm.utcOffset()).toBe(om.utcOffset());
  expect(mm.format()).toBe(om.format());
  expect(mm.format("YYYY-MM-DDTHH:mm:ss.SSSZ")).toBe(om.format("YYYY-MM-DDTHH:mm:ss.SSSZ"));
  if (!opts?.skipAbbr) {
    expect(mm.format("z")).toBe(om.format("z"));
  }
}

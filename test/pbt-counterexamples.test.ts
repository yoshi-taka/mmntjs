/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "bun:test";
import mmntjs from "../src/index.ts";
import moment from "../moment/moment.js";

function expectEqual(label: string, m2: any, mo: any) {
  expect({ label, v: m2.valueOf(), f: m2.format(), o: m2.utcOffset() })
    .toMatchObject({ label, v: mo.valueOf(), f: mo.format(), o: mo.utcOffset() });
}

test("endOf month -> utc(false) -> local(true) DST boundary", () => {
  const d = new Date("1990-03-01T08:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.endOf("month"); mo.endOf("month");
  m2.utc(false); mo.utc(false);
  m2.local(true); mo.local(true);
  expectEqual("endOf-utc-local", m2, mo);
});

test("utcOffset -1, false -> startOf day", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(-1, false); mo.utcOffset(-1, false);
  m2.startOf("day"); mo.startOf("day");
  expectEqual("offset-startOf", m2, mo);
});

test("utcOffset -1 -> clone -> startOf day", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(-1, false); mo.utcOffset(-1, false);
  m2.clone(); mo.clone();
  m2.startOf("day"); mo.startOf("day");
  expectEqual("offset-clone-startOf", m2, mo);
});

test("utcOffset -1 -> local true", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(-1, false); mo.utcOffset(-1, false);
  m2.local(true); mo.local(true);
  expectEqual("offset-local", m2, mo);
});

test("utcOffset -1, false", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(-1, false); mo.utcOffset(-1, false);
  expectEqual("offset-1", m2, mo);
});

test("utcOffset +1, false", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(1, false); mo.utcOffset(1, false);
  expectEqual("offset+1", m2, mo);
});

test("utcOffset -1 -> endOf year", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(-1, false); mo.utcOffset(-1, false);
  m2.endOf("year"); mo.endOf("year");
  expectEqual("offset-endOfYear", m2, mo);
});

test("utcOffset +1 -> utc(true)", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(1, false); mo.utcOffset(1, false);
  m2.utc(true); mo.utc(true);
  expectEqual("offset-utc-true", m2, mo);
});

test("utcOffset 0, true from local", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(0, true); mo.utcOffset(0, true);
  expectEqual("offset0-true", m2, mo);
});

test("add 7 months spring-forward DST (valueOf only)", () => {
  const d = new Date("2033-08-12T09:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.add(7, "months"); mo.add(7, "months");
  expect(m2.valueOf()).toBe(mo.valueOf());
});

test("utcOffset -1 -> add -1 years", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(-1, false); mo.utcOffset(-1, false);
  m2.add(-1, "years"); mo.add(-1, "years");
  expectEqual("offset-add-years", m2, mo);
});

test("utcOffset -1, false -> add(-1 hours) time unit", () => {
  const d = new Date("1970-01-01T00:00:00.000Z");
  const m2 = mmntjs(d); const mo = moment(d);
  m2.utcOffset(-1, false); mo.utcOffset(-1, false);
  m2.add(-1, "hours"); mo.add(-1, "hours");
  expectEqual("offset-add-hours", m2, mo);
});

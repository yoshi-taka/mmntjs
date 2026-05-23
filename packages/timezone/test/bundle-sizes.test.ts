import { test, expect, describe } from "bun:test";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const distDir = new URL("../dist/", import.meta.url);

type Sizes = { raw: number; gzip: number };

function measureSizes(file: string): Sizes {
  const buf = readFileSync(new URL(file, distDir));
  return { raw: buf.length, gzip: gzipSync(buf).length };
}

describe("timezone bundle sizes", () => {
  const results: Record<string, Sizes> = {};

  test("measure 10-year-range", () => {
    results["10-year-range"] = measureSizes("10-year-range.js");
  });

  test("measure 1970-2030", () => {
    results["1970-2030"] = measureSizes("1970-2030.js");
  });

  test("measure full (index)", () => {
    results["full"] = measureSizes("index.js");
  });

  test("10-year-range is smaller than 1970-2030", () => {
    expect(results["10-year-range"].raw).toBeLessThan(results["1970-2030"].raw);
    expect(results["10-year-range"].gzip).toBeLessThan(results["1970-2030"].gzip);
  });

  test("1970-2030 is smaller than full", () => {
    expect(results["1970-2030"].raw).toBeLessThan(results["full"].raw);
    expect(results["1970-2030"].gzip).toBeLessThan(results["full"].gzip);
  });
});

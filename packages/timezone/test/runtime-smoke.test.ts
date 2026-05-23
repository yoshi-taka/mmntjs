import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";

const distDir = new URL("../dist/", import.meta.url);
const hasDist = existsSync(new URL("index.js", distDir).pathname);

(hasDist ? describe : describe.skip)("timezone runtime smoke", () => {
  const dist = (path: string) => new URL(`../dist/${path}`, import.meta.url).pathname;

  test("esm import main entry", async () => {
    const mod = await import(dist("index.js"));
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.tz).toBe("function");
    expect(typeof mod.default.tz).toBe("function");
  });

  test("cjs require main entry", () => {
    const mod = require(dist("index.cjs"));
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.tz).toBe("function");
    expect(typeof mod.default.tz).toBe("function");
  });

  test("esm import logic entry", async () => {
    const mod = await import(dist("logic.js"));
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.tz).toBe("function");
  });

  test("esm import 1970-2030 entry", async () => {
    const mod = await import(dist("1970-2030.js"));
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.tz).toBe("function");
  });

  test("esm import 10-year-range entry", async () => {
    const mod = await import(dist("10-year-range.js"));
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.tz).toBe("function");
  });

  test("cjs require 10-year-range entry", () => {
    const mod = require(dist("10-year-range.cjs"));
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.tz).toBe("function");
  });
});

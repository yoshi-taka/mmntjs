import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import tzPkg from "../package.json";

const projectRoot = join(new URL("../../..", import.meta.url).pathname);
const distDir = (f: string) => join(projectRoot, "dist", f);
const tzDistDir = (f: string) => join(projectRoot, "packages", "timezone", "dist", f);

async function bundleAndGetCode(entryCode: string): Promise<string> {
  const dir = mkdtempSync(join(projectRoot, ".tz-tree-"));
  try {
    const entryPath = join(dir, "entry.mjs");
    writeFileSync(entryPath, entryCode, "utf-8");

    const result = await Bun.build({
      entrypoints: [entryPath],
      outdir: dir,
      format: "esm",
      minify: true,
      sourcemap: "none",
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBeGreaterThan(0);

    return readFileSync(result.outputs[0].path, "utf-8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function gzipSize(buf: Buffer): number {
  return gzipSync(buf).length;
}

describe("timezone tree-shaking", () => {
  test("sideEffects field exists and matches entry points", () => {
    const se = tzPkg.sideEffects as string[];
    expect(se).toBeDefined();
    expect(se).toBeInstanceOf(Array);
    // every entry point must declare side effects (installTimezone mutation)
    for (const entry of ["index", "logic", "1970-2030", "10-year-range"]) {
      expect(se).toContain(`./dist/${entry}.js`);
      expect(se).toContain(`./dist/${entry}.cjs`);
    }
  });

  test("core-only import excludes timezone code", async () => {
    const code = await bundleAndGetCode(
      `import m from "${distDir("index.js").replaceAll("\\", "\\\\")}"; console.log(m().format());`,
    );
    expect(code).not.toMatch(/installTimezone|zonesBlob/);
  });

  test("10-year-range import includes timezone code", async () => {
    const code = await bundleAndGetCode(
      `import m from "${tzDistDir("10-year-range.js").replaceAll("\\", "\\\\")}"; console.log(m().format());`,
    );
    expect(code).not.toMatch(/installTimezone/);
    expect(code).toMatch(/zonesBlob/);
  });

  test("10-year-range dist file is smaller than 1970-2030", () => {
    const f10 = readFileSync(tzDistDir("10-year-range.js"));
    const f70 = readFileSync(tzDistDir("1970-2030.js"));
    expect(f10.length).toBeLessThan(f70.length);
    expect(gzipSize(f10)).toBeLessThan(gzipSize(f70));
  });

  test("1970-2030 dist file is smaller than full (index)", () => {
    const f70 = readFileSync(tzDistDir("1970-2030.js"));
    const fFull = readFileSync(tzDistDir("index.js"));
    expect(f70.length).toBeLessThan(fFull.length);
    expect(gzipSize(f70)).toBeLessThan(gzipSize(fFull));
  });
});

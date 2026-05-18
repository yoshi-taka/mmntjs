import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
const projectRoot = join(import.meta.dir, "..");

async function bundleAndGetCode(entryCode: string): Promise<string> {
  const dir = mkdtempSync(join(projectRoot, ".bdl-smoke-"));
  try {
    const entryPath = join(dir, "entry.mjs");
    writeFileSync(entryPath, entryCode, "utf-8");

    const result = await Bun.build({
      entrypoints: [entryPath],
      outdir: dir,
      format: "esm",
      minify: false,
      sourcemap: "none",
    });

    expect(result.success).toBe(true);
    expect(result.outputs.length).toBeGreaterThan(0);

    return readFileSync(result.outputs[0].path, "utf-8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const srcDir = join(projectRoot, "src");
const esc = (p: string) => p.replaceAll("\\", "\\\\");

describe("bundle smoke: timezone isolation", () => {
  const timezonePatterns = [
    /Intl\.DateTimeFormat/,
    /mmntjs-timezone/,
    /installTimezone/,
    /tz\.add/,
  ];

  const entries = ["lite.ts", "index.ts", "full.ts"] as const;

  for (const entry of entries) {
    test(`${entry} does not contain timezone code`, async () => {
      const code = await bundleAndGetCode(
        `import m from "${esc(join(srcDir, entry))}"; console.log(m().format());`,
      );
      for (const pat of timezonePatterns) {
        expect(code).not.toMatch(pat);
      }
    });
  }
});

describe("bundle smoke: Temporal isolation", () => {
  const temporalPatterns = [/fromTemporal/, /toTemporal/, /@js-temporal\/polyfill/];

  test("lite does not contain Temporal bridge", async () => {
    const code = await bundleAndGetCode(
      `import m from "${esc(join(srcDir, "lite.ts"))}"; console.log(m().format());`,
    );
    for (const pat of temporalPatterns) {
      expect(code).not.toMatch(pat);
    }
  });

  test("default (index) does not contain Temporal bridge", async () => {
    const code = await bundleAndGetCode(
      `import m from "${esc(join(srcDir, "index.ts"))}"; console.log(m().format());`,
    );
    for (const pat of temporalPatterns) {
      expect(code).not.toMatch(pat);
    }
  });

  test("full does not contain Temporal bridge", async () => {
    const code = await bundleAndGetCode(
      `import m from "${esc(join(srcDir, "full.ts"))}"; console.log(m().format());`,
    );
    for (const pat of temporalPatterns) {
      expect(code).not.toMatch(pat);
    }
  });

  test("temporal entry DOES contain Temporal bridge", async () => {
    const code = await bundleAndGetCode(
      `import { toTemporal } from "${esc(join(srcDir, "temporal-entry.ts"))}"; console.log(toTemporal);`,
    );
    expect(code).toMatch(/toTemporal/);
  });
});

describe("bundle smoke: locale modularity", () => {
  test("importing ja locale does not include de locale data", async () => {
    const code = await bundleAndGetCode(
      `import { jaLocale } from "${esc(join(srcDir, "locale/ja.ts"))}"; console.log(jaLocale.months[0]);`,
    );
    expect(code).toMatch(/jaLocale/);
    expect(code).not.toMatch(/deLocale|Januar|Februar|März/);
  });

  test("importing de locale does not include ja locale data", async () => {
    const code = await bundleAndGetCode(
      `import { deLocale } from "${esc(join(srcDir, "locale/de.ts"))}"; console.log(deLocale.months[0]);`,
    );
    expect(code).toMatch(/deLocale/);
    expect(code).not.toMatch(/jaLocale|1月|2月|3月/);
  });

  test("locale files are standalone (no core moment)", async () => {
    const code = await bundleAndGetCode(
      `import { jaLocale } from "${esc(join(srcDir, "locale/ja.ts"))}"; console.log(jaLocale.months[0]);`,
    );
    expect(code).not.toMatch(/isMoment|isDate|Duration/);
  });

  test("importing one locale does not pull other locales", async () => {
    // Check that a single locale import doesn't bring in all locale data
    const jaCode = await bundleAndGetCode(
      `import { jaLocale } from "${esc(join(srcDir, "locale/ja.ts"))}"; console.log(jaLocale.months[0]);`,
    );
    // Count locale identifiers — should be ~1 not ~100+
    const localeMatches = jaCode.match(/Locale\s*[:=]/g);
    expect(localeMatches?.length ?? 0).toBeLessThan(5);
  });
});

describe("bundle smoke: entry point size boundaries", () => {
  test("lite is materially smaller than full", async () => {
    const lite = await (async () => {
      const result = await Bun.build({
        entrypoints: [join(srcDir, "lite.ts")],
        format: "esm",
        minify: true,
        sourcemap: "none",
        target: "browser",
      });
      expect(result.success).toBe(true);
      const text = await result.outputs[0].text();
      return Buffer.from(text).length;
    })();

    const full = await (async () => {
      const result = await Bun.build({
        entrypoints: [join(srcDir, "full.ts")],
        format: "esm",
        minify: true,
        sourcemap: "none",
        target: "browser",
      });
      expect(result.success).toBe(true);
      const text = await result.outputs[0].text();
      return Buffer.from(text).length;
    })();

    expect(lite).toBeLessThan(65_000);
    expect(full).toBeGreaterThan(lite);
    expect(full).toBeGreaterThan(150_000);
  });

  test("default import is same as full import size", async () => {
    const result1 = await Bun.build({
      entrypoints: [join(srcDir, "index.ts")],
      format: "esm",
      minify: true,
      sourcemap: "none",
      target: "browser",
    });
    const result2 = await Bun.build({
      entrypoints: [join(srcDir, "full.ts")],
      format: "esm",
      minify: true,
      sourcemap: "none",
      target: "browser",
    });
    const t1 = await result1.outputs[0].text();
    const t2 = await result2.outputs[0].text();
    expect(Buffer.from(t1).length).toEqual(Buffer.from(t2).length);
  });
});

describe("bundle smoke: CLI code exclusion", () => {
  test("full entry does not contain CLI code", async () => {
    const code = await bundleAndGetCode(
      `import m from "${esc(join(srcDir, "full.ts"))}"; console.log(m().format());`,
    );
    expect(code).not.toMatch(/mmntjs migrate|Migration CLI|bin\/cli/);
  });

  test("lite entry does not contain CLI code", async () => {
    const code = await bundleAndGetCode(
      `import m from "${esc(join(srcDir, "lite.ts"))}"; console.log(m().format());`,
    );
    expect(code).not.toMatch(/mmntjs migrate|Migration CLI|bin\/cli/);
  });
});

describe("bundle smoke: package.json contract", () => {
  test("sideEffects is declared false", async () => {
    const pkg = await import("../package.json");
    expect(pkg.default.sideEffects).toBe(false);
  });

  test("all entry points are declared in exports", async () => {
    const pkg = await import("../package.json");
    const ex = pkg.default.exports;
    expect(ex["."]).toBeDefined();
    expect(ex["./lite"]).toBeDefined();
    expect(ex["./full"]).toBeDefined();
    expect(ex["./temporal"]).toBeDefined();
    expect(ex["./locale/*"]).toBeDefined();
    expect(ex["./plugin/format-parse"]).toBeDefined();
    expect(ex["./plugin/utc"]).toBeDefined();
  });
});

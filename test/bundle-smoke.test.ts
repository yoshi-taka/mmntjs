import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
const projectRoot = join(import.meta.dir, "..");
const hasDist = existsSync(new URL("../dist/index.js", import.meta.url).pathname);

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
        entrypoints: [join(srcDir, "entry", "lite.ts")],
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
        entrypoints: [join(srcDir, "entry", "full.ts")],
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

  test("index barrels into entry/full with same exports", async () => {
    const result = await Bun.build({
      entrypoints: [join(srcDir, "index.ts")],
      format: "esm",
      minify: false,
      sourcemap: "none",
      target: "browser",
    });
    expect(result.success).toBe(true);
    const text = await result.outputs[0].text();
    // index.ts barrel must re-export the same names as entry/full
    for (const name of ["moment", "isMoment", "isDate", "Duration", "Locale"]) {
      expect(text).toInclude(name);
    }
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
  test("sideEffects only lists side-effect entries", async () => {
    const pkg = await import("../package.json");
    expect(pkg.default.sideEffects).toEqual([
      "./dist/locale-auto/*.js",
      "./dist/locale-auto/*.cjs",
      "./dist/plugin/*.js",
      "./dist/plugin/*.cjs",
    ]);
  });

  test("all entry points are declared in exports", async () => {
    const pkg = await import("../package.json");
    const ex = pkg.default.exports;
    expect(ex["."]).toBeDefined();
    expect(ex["./lite"]).toBeDefined();
    expect(ex["./full"]).toBeDefined();
    expect(ex["./temporal"]).toBeDefined();
    expect(ex["./locale/*"]).toBeDefined();
    expect(ex["./locale-auto/*"]).toBeDefined();
    expect(ex["./plugin/format-parse"]).toBeDefined();
    expect(ex["./plugin/utc"]).toBeDefined();
  });
});

(hasDist ? describe : describe.skip)("runtime smoke: dist artifact import/require", () => {
  const dist = (path: string) => new URL(`../dist/${path}`, import.meta.url).pathname;

  describe("mmntjs main entry", () => {
    test("esm import default", async () => {
      const m = await import(dist("index.js"));
      expect(m.default).toBeFunction();
      expect(m.default(0).isValid()).toBe(true);
    });
    test("esm import named moment", async () => {
      const { moment } = await import(dist("index.js"));
      expect(moment).toBeFunction();
      expect(moment(0).isValid()).toBe(true);
    });
    test("cjs require default", () => {
      const m = require(dist("index.cjs"));
      expect(m).toBeFunction();
      expect(m(0).isValid()).toBe(true);
      expect(m.isMoment).toBeFunction();
    });
  });

  describe("mmntjs/lite entry", () => {
    test("esm import lite", async () => {
      const m = await import(dist("lite.js"));
      expect(m.default).toBeFunction();
      expect(m.default(0).isValid()).toBe(true);
    });
    test("cjs require lite", () => {
      const m = require(dist("lite.cjs"));
      expect(m).toBeFunction();
      expect(m(0).isValid()).toBe(true);
    });
  });

  describe("mmntjs/full entry", () => {
    test("esm import full", async () => {
      const m = await import(dist("full.js"));
      expect(m.default).toBeFunction();
    });
    test("cjs require full", () => {
      const m = require(dist("full.cjs"));
      expect(m).toBeFunction();
    });
  });

  describe("locale data files", () => {
    test("esm import ja locale data", async () => {
      const loc = await import(dist("locale/ja.js"));
      expect(loc.jaLocale).toBeDefined();
      expect(loc.jaLocale.months).toBeArray();
      expect(loc.jaLocale.months[0]).toBe("1月");
    });
    test("cjs require de locale data", () => {
      const loc = require(dist("locale/de.cjs"));
      expect(loc.deLocale).toBeDefined();
      expect(loc.deLocale.months).toBeArray();
    });
    test("ja locale can be used with defineLocale", async () => {
      const mod = await import(dist("index.js"));
      const { jaLocale } = await import(dist("locale/ja.js"));
      mod.moment.defineLocale("ja", jaLocale);
      expect(mod.moment.locale("ja")).toBe("ja");
      mod.moment.locale("en");
    });
    test("esm import locale-auto/ja auto-registers locale", async () => {
      const mod = await import(dist("index.js"));
      mod.moment.locale("en");
      await import(dist("locale-auto/ja.js"));
      expect(mod.moment.locale()).toBe("ja");
      mod.moment.locale("en");
    });
    test("cjs require locale-auto/de auto-registers locale", () => {
      const mod = require(dist("index.cjs"));
      mod.locale("en");
      require(dist("locale-auto/de.cjs"));
      expect(mod.locale()).toBe("de");
      mod.locale("en");
    });
  });

  describe("plugin entries (side-effect only)", () => {
    test("esm import utc plugin loads without error", async () => {
      const p = await import(dist("plugin/utc.js"));
      // plugin is side-effect only; module namespace has no exports
      expect(Object.keys(p).length).toBe(0);
    });
    test("cjs require format-parse plugin loads without error", () => {
      const p = require(dist("plugin/format-parse.cjs"));
      expect(p).toEqual({});
    });
  });

  describe("temporal entry", () => {
    test("esm import temporal", async () => {
      const t = await import(dist("temporal-entry.js"));
      expect(t.toTemporal).toBeFunction();
      expect(t.fromTemporal).toBeFunction();
    });
    test("cjs require temporal", () => {
      const t = require(dist("temporal-entry.cjs"));
      expect(t.toTemporal).toBeFunction();
      expect(t.fromTemporal).toBeFunction();
    });
  });
});

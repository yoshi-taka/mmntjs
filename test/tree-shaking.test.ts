import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import pkg from "../package.json";

const projectRoot = join(import.meta.dir, "..");

async function bundleAndGetCode(entryCode: string): Promise<string> {
  const dir = mkdtempSync(join(projectRoot, ".tstree-"));
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

    const artifact = result.outputs[0];
    return readFileSync(artifact.path, "utf-8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function bundleEntryAndGetSize(entrypoint: string): Promise<{ raw: number; gzip: number }> {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    format: "esm",
    minify: true,
    sourcemap: "none",
    target: "browser",
  });

  expect(result.success).toBe(true);
  expect(result.outputs.length).toBeGreaterThan(0);

  const text = await result.outputs[0].text();
  return {
    raw: text.length,
    gzip: gzipSync(text).length,
  };
}

describe("tree-shaking", () => {
  const liteSourcePath = join(projectRoot, "src/lite.ts").replaceAll("\\", "\\\\");
  const fullSourcePath = join(projectRoot, "src/full.ts").replaceAll("\\", "\\\\");
  const jaLocaleSourcePath = join(projectRoot, "src/locale/ja.ts").replaceAll("\\", "\\\\");
  const deLocaleSourcePath = join(projectRoot, "src/locale/de.ts").replaceAll("\\", "\\\\");

  test("sideEffects only lists side-effect subpaths in package.json", () => {
    expect(pkg.sideEffects).toEqual([
      "./dist/locale-auto/*.js",
      "./dist/locale-auto/*.cjs",
      "./dist/plugin/*.js",
      "./dist/plugin/*.cjs",
    ]);
  });

  test("locale entry point is declared in exports", () => {
    expect(pkg.exports["./locale/*"]).toBeDefined();
  });

  test("entry points are declared in exports", () => {
    expect(pkg.exports["./lite"]).toBeDefined();
    expect(pkg.exports["./full"]).toBeDefined();
    expect(pkg.exports["./locale-auto/*"]).toBeDefined();
    expect(pkg.exports["./plugin/format-parse"]).toBeDefined();
    expect(pkg.exports["./plugin/utc"]).toBeDefined();
  });

  test("lite bundle stays materially smaller than full bundle", async () => {
    const lite = await bundleEntryAndGetSize(join(projectRoot, "src/lite.ts"));
    const full = await bundleEntryAndGetSize(join(projectRoot, "src/full.ts"));

    expect(lite.raw).toBeLessThan(60000);
    expect(lite.gzip).toBeLessThan(18000);
    expect(full.raw).toBeGreaterThan(lite.raw);
    expect(full.gzip).toBeGreaterThan(lite.gzip);
  });

  describe("via lite entry", () => {
    test("lite entry has utc static built-in", async () => {
      const mod = await import(`${join(projectRoot, "src/lite.ts")}?lite-has-utc`);
      const moment = mod.default as Record<string, unknown>;

      expect(typeof moment.utc).toBe("function");
    });

    test("format-parse plugin enables custom format parsing for lite entry", async () => {
      const litePath = `${join(projectRoot, "src/lite.ts")}?lite-format-plugin`;
      const pluginPath = `${join(projectRoot, "src/plugin/format-parse.ts")}?lite-format-plugin`;
      const lite = await import(litePath);
      await import(pluginPath);
      const moment = lite.default;

      expect(moment("2024-01-02", "YYYY-MM-DD", true).isValid()).toBe(true);
    });

    test("lite moment does not contain locale registry registration", async () => {
      const code = await bundleAndGetCode(
        `import moment from '${liteSourcePath}';\nconsole.log(moment().format());`,
      );

      expect(code).not.toMatch(/defineLocale|updateLocale|listLocales/);
    });

    test("full entry does not contain CLI code", async () => {
      const code = await bundleAndGetCode(
        `import moment from '${fullSourcePath}';\nconsole.log(moment().format());`,
      );

      expect(code).not.toMatch(/mmntjs migrate|Migration CLI/);
    });

    test("full entry does not contain Temporal bridge registration", async () => {
      const code = await bundleAndGetCode(
        `import moment from '${fullSourcePath}';\nconsole.log(moment().format());`,
      );

      expect(code).not.toMatch(/fromTemporal|toTemporal|js-temporal\/polyfill/);
    });
  });

  describe("locale", () => {
    test("importing ja locale entry does not include de locale", async () => {
      const code = await bundleAndGetCode(
        `import { jaLocale } from '${jaLocaleSourcePath}';\nconsole.log(jaLocale.months[0]);`,
      );

      expect(code).toMatch(/jaLocale/);
      expect(code).not.toMatch(/deLocale|Januar|Februar|März/);
    });

    test("importing de locale entry does not include ja locale", async () => {
      const code = await bundleAndGetCode(
        `import { deLocale } from '${deLocaleSourcePath}';\nconsole.log(deLocale.months[0]);`,
      );

      expect(code).toMatch(/deLocale/);
      expect(code).not.toMatch(/jaLocale/);
    });

    test("locale entries are standalone and do not include the core moment", async () => {
      const code = await bundleAndGetCode(
        `import { jaLocale } from '${jaLocaleSourcePath}';\nconsole.log(jaLocale.months[0]);`,
      );

      expect(code).not.toMatch(/isMoment|isDate|Duration/);
    });
  });
});

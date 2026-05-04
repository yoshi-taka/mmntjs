import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
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

describe("tree-shaking", () => {
  test("sideEffects is declared false in package.json", () => {
    expect(pkg.sideEffects).toBe(false);
  });

  test("locale entry point is declared in exports", () => {
    expect(pkg.exports["./locale/*"]).toBeDefined();
  });

  describe("via package name", () => {
    test("core moment does not contain Japanese locale data", async () => {
      const code = await bundleAndGetCode(
        `import { moment } from '@compat/moment2';\nconsole.log(moment().format());`,
      );

      expect(code).not.toMatch(/jaLocale|午前|午後/);
    });

    test("core moment does not contain CLI code", async () => {
      const code = await bundleAndGetCode(
        `import { moment } from '@compat/moment2';\nconsole.log(moment().format());`,
      );

      expect(code).not.toMatch(/moment2 migrate|Migration CLI/);
    });
  });

  describe("locale", () => {
    test("importing ja locale via @compat/moment2/locale/ja does not include de locale", async () => {
      const code = await bundleAndGetCode(
        `import { jaLocale } from '@compat/moment2/locale/ja';\nconsole.log(jaLocale.months[0]);`,
      );

      expect(code).toMatch(/jaLocale/);
      expect(code).not.toMatch(/deLocale|Januar|Februar|März/);
    });

    test("importing de locale via @compat/moment2/locale/de does not include ja locale", async () => {
      const code = await bundleAndGetCode(
        `import { deLocale } from '@compat/moment2/locale/de';\nconsole.log(deLocale.months[0]);`,
      );

      expect(code).toMatch(/deLocale/);
      expect(code).not.toMatch(/jaLocale/);
    });

    test("locale entries are standalone and do not include the core moment", async () => {
      const code = await bundleAndGetCode(
        `import { jaLocale } from '@compat/moment2/locale/ja';\nconsole.log(jaLocale.months[0]);`,
      );

      expect(code).not.toMatch(/isMoment|isDate|Duration/);
    });
  });
});

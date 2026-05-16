import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";

const projectRoot = join(import.meta.dir, "..");

interface SizeReport {
  raw: number;
  gzip: number;
}

interface Threshold {
  name: string;
  maxRaw: number;
  maxGzip: number;
}

interface Scenario {
  name: string;
  entryCode: string;
}

const KB = 1024;

// Thresholds must be updated when intentional size changes are made.
// These are based on minified + gzip bundle sizes from Bun.build (from source).
// Baselines (measured 2026-05-17):
//   lite:         ~12 KB gzip,  ~44 KB raw
//   default/full: ~39 KB gzip, ~149 KB raw
//   temporal:     ~40 KB gzip, ~152 KB raw
//   locale/ja:    ~2 KB gzip,   ~5 KB raw
//   locale (standalone): <1 KB gzip
const THRESHOLDS: Threshold[] = [
  { name: "mmntjs/lite", maxRaw: 60 * KB, maxGzip: 16 * KB },
  { name: "mmntjs (default)", maxRaw: 180 * KB, maxGzip: 47 * KB },
  { name: "mmntjs/full", maxRaw: 180 * KB, maxGzip: 47 * KB },
  { name: "mmntjs/temporal", maxRaw: 200 * KB, maxGzip: 50 * KB },
  { name: "locale/ja (standalone)", maxRaw: 8 * KB, maxGzip: 2.5 * KB },
  { name: "locale/de (standalone)", maxRaw: 8 * KB, maxGzip: 2.5 * KB },
];

function escapePath(p: string): string {
  return p.replaceAll("\\", "\\\\");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

async function bundleSize(entryCode: string): Promise<SizeReport> {
  const dir = mkdtempSync(join(projectRoot, ".size-guard-"));
  try {
    const entryPath = join(dir, "entry.mjs");
    writeFileSync(entryPath, entryCode, "utf-8");

    const result = await Bun.build({
      entrypoints: [entryPath],
      outdir: dir,
      format: "esm",
      minify: true,
      sourcemap: "none",
      target: "browser",
    });

    if (!result.success) {
      throw new Error(`Bundle failed: ${result.logs.map((l) => l.message).join("\n")}`);
    }

    const text = await result.outputs[0].text();
    const buf = Buffer.from(text);
    return {
      raw: buf.length,
      gzip: gzipSync(buf).length,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function checkContamination(
  entryCode: string,
  forbiddenPatterns: RegExp[],
): Promise<string[]> {
  const dir = mkdtempSync(join(projectRoot, ".size-guard-"));
  try {
    const entryPath = join(dir, "entry.mjs");
    writeFileSync(entryPath, entryCode, "utf-8");

    const result = await Bun.build({
      entrypoints: [entryPath],
      outdir: dir,
      format: "esm",
      minify: false,
      sourcemap: "none",
      target: "browser",
    });

    if (!result.success) return [];

    const text = readFileSync(result.outputs[0].path, "utf-8");
    const hits: string[] = [];
    for (const pat of forbiddenPatterns) {
      if (pat.test(text)) {
        hits.push(pat.source);
      }
    }
    return hits;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  let failures = 0;

  const srcDir = join(projectRoot, "src");

  const scenarios: Scenario[] = [
    {
      name: "mmntjs/lite",
      entryCode: `import m from "${escapePath(join(srcDir, "lite.ts"))}"; console.log(m().format("YYYY-MM-DD"));`,
    },
    {
      name: "mmntjs (default)",
      entryCode: `import m from "${escapePath(join(srcDir, "index.ts"))}"; console.log(m().format("YYYY-MM-DD"));`,
    },
    {
      name: "mmntjs/full",
      entryCode: `import m from "${escapePath(join(srcDir, "full.ts"))}"; console.log(m().format("YYYY-MM-DD"));`,
    },
    {
      name: "mmntjs/temporal",
      entryCode: `import { toTemporal } from "${escapePath(join(srcDir, "temporal-entry.ts"))}"; console.log(typeof toTemporal);`,
    },
    {
      name: "mmntjs/lite + locale/ja",
      entryCode: [
        `import m from "${escapePath(join(srcDir, "lite.ts"))}";`,
        `import "${escapePath(join(srcDir, "locale/ja.ts"))}";`,
        `m.locale("ja"); console.log(m().format("LL"));`,
      ].join("\n"),
    },
    {
      name: "mmntjs + locale/ja",
      entryCode: [
        `import m from "${escapePath(join(srcDir, "index.ts"))}";`,
        `import "${escapePath(join(srcDir, "locale/ja.ts"))}";`,
        `m.locale("ja"); console.log(m().format("LL"));`,
      ].join("\n"),
    },
    {
      name: "locale/ja (standalone)",
      entryCode: `import { jaLocale } from "${escapePath(join(srcDir, "locale/ja.ts"))}"; console.log(jaLocale.months[0]);`,
    },
    {
      name: "locale/de (standalone)",
      entryCode: `import { deLocale } from "${escapePath(join(srcDir, "locale/de.ts"))}"; console.log(deLocale.months[0]);`,
    },
  ];

  // 1. Size threshold check
  console.log("=== Size Guard: Bundle Size Thresholds ===\n");
  console.log(`${"Scenario".padEnd(30)} ${"Raw".padEnd(10)} ${"Gzip".padEnd(10)} ${"MaxRaw".padEnd(10)} ${"MaxGzip".padEnd(10)} ${"Status"}`);
  console.log("-".repeat(90));

  for (const scenario of scenarios) {
    const threshold = THRESHOLDS.find((t) => t.name === scenario.name);
    if (!threshold) continue;

    let report: SizeReport;
    try {
      report = await bundleSize(scenario.entryCode);
    } catch (e) {
      console.log(`${scenario.name.padEnd(30)} ${"ERR".padEnd(10)}`);
      failures++;
      continue;
    }

    const rawOk = report.raw <= threshold.maxRaw;
    const gzipOk = report.gzip <= threshold.maxGzip;
    const ok = rawOk && gzipOk;

    const status = ok ? "PASS" : "FAIL";

    console.log(
      `${scenario.name.padEnd(30)} ${formatBytes(report.raw).padEnd(10)} ${formatBytes(report.gzip).padEnd(10)} ${formatBytes(threshold.maxRaw).padEnd(10)} ${formatBytes(threshold.maxGzip).padEnd(10)} ${status}`,
    );

    if (!ok) {
      if (!rawOk) {
        console.error(`  FAIL: raw ${report.raw} > ${threshold.maxRaw}`);
      }
      if (!gzipOk) {
        console.error(`  FAIL: gzip ${report.gzip} > ${threshold.maxGzip}`);
      }
      failures++;
    }
  }

  // 2. Contamination checks
  console.log("\n=== Size Guard: Bundle Contamination Checks ===\n");

  const timezonePatterns = [
    /Intl\.DateTimeFormat/,
    /moment2-timezone/,
    /installTimezone/,
    /tz\.add/,
  ];

  const temporalPatterns = [
    /fromTemporal/,
    /toTemporal/,
  ];

  interface ContamScenario {
    name: string;
    entryCode: string;
    patterns: RegExp[];
    label: string;
  }

  const contamScenarios: ContamScenario[] = [
    {
      name: "mmntjs/lite",
      entryCode: `import m from "${escapePath(join(srcDir, "lite.ts"))}"; console.log(m().format());`,
      patterns: timezonePatterns,
      label: "timezone in lite",
    },
    {
      name: "mmntjs (default)",
      entryCode: `import m from "${escapePath(join(srcDir, "index.ts"))}"; console.log(m().format());`,
      patterns: timezonePatterns,
      label: "timezone in default",
    },
    {
      name: "mmntjs/lite",
      entryCode: `import m from "${escapePath(join(srcDir, "lite.ts"))}"; console.log(m().format());`,
      patterns: temporalPatterns,
      label: "Temporal in lite",
    },
    {
      name: "mmntjs (default)",
      entryCode: `import m from "${escapePath(join(srcDir, "index.ts"))}"; console.log(m().format());`,
      patterns: temporalPatterns,
      label: "Temporal in default",
    },
  ];

  console.log(`${"Check".padEnd(35)} ${"Status"}`);
  console.log("-".repeat(50));

  for (const cs of contamScenarios) {
    const hits = await checkContamination(cs.entryCode, cs.patterns);
    const ok = hits.length === 0;
    console.log(`${cs.label.padEnd(35)} ${ok ? "PASS" : "FAIL"}`);
    if (!ok) {
      console.error(`  Found forbidden patterns: ${hits.join(", ")}`);
      failures++;
    }
  }

  // 3. Locale modularity check: one locale should not contain another
  {
    console.log("\n=== Size Guard: Locale Modularity ===\n");
    const locales = ["ja", "de", "fr", "es"];
    for (const loc of locales) {
      const code = await (async () => {
        const dir = mkdtempSync(join(projectRoot, ".size-guard-"));
        try {
          const entryPath = join(dir, "entry.mjs");
          writeFileSync(
            entryPath,
            `import { ${loc}Locale } from "${escapePath(join(srcDir, `locale/${loc}.ts`))}"; console.log(${loc}Locale.months[0]);`,
            "utf-8",
          );
          const result = await Bun.build({
            entrypoints: [entryPath],
            outdir: dir,
            format: "esm",
            minify: false,
            sourcemap: "none",
            target: "browser",
          });
          if (!result.success) return "";
          return readFileSync(result.outputs[0].path, "utf-8");
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      })();

      const otherLocales = locales.filter((l) => l !== loc);
      let allOk = true;
      for (const other of otherLocales) {
        if (code.includes(`${other}Locale`) || code.includes(`"${other}"`)) {
          console.log(`  locale/${loc} contains ${other}: FAIL`);
          allOk = false;
          failures++;
        }
      }
      if (allOk) {
        console.log(`  locale/${loc} is isolated from other locales: PASS`);
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  if (failures > 0) {
    console.error(`FAILED: ${failures} check(s) failed.`);
    process.exit(1);
  } else {
    console.log("All size guard checks passed.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

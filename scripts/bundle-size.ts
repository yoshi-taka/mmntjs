import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

const projectRoot = join(import.meta.dir, "..");

interface Scenario {
  name: string;
  entryCode: string;
}

interface SizeReport {
  raw: number;
  gzip: number;
  brotli: number;
}

function escapePath(p: string): string {
  return p.replaceAll("\\", "\\\\");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

async function bundleFromSource(entryCode: string): Promise<SizeReport> {
  const dir = mkdtempSync(join(projectRoot, ".bundle-size-"));
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
      brotli: brotliCompressSync(buf).length,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function measureDistFile(filePath: string): SizeReport | null {
  if (!existsSync(filePath)) return null;
  const buf = readFileSync(filePath);
  return {
    raw: buf.length,
    gzip: gzipSync(buf).length,
    brotli: brotliCompressSync(buf).length,
  };
}

interface Measured {
  name: string;
  fromSource: SizeReport | null;
  distEsm: SizeReport | null;
  distCjs: SizeReport | null;
}

function makeEntry(name: string, relPath: string, hook?: string): Scenario {
  const absPath = escapePath(join(projectRoot, relPath));
  return {
    name,
    entryCode: `import m from "${absPath}"; console.log(m().format("YYYY-MM-DD"));`,
  };
}

async function main() {
  const scenarios: Scenario[] = [
    makeEntry("mmntjs (default)", "src/index.ts"),
    makeEntry("mmntjs/lite", "src/lite.ts"),
    makeEntry("mmntjs/full", "src/full.ts"),
    {
      name: "mmntjs/temporal",
      entryCode: `import { toTemporal, fromTemporal } from "${escapePath(join(projectRoot, "src/temporal-entry.ts"))}"; console.log(typeof toTemporal);`,
    },
    {
      name: "mmntjs/fns format",
      entryCode: `import { format } from "${escapePath(join(projectRoot, "src/fns/index.ts"))}"; console.log(format(new Date(2024, 5, 15), "YYYY-MM-DD"));`,
    },
    {
      name: "mmntjs/fns parseISO+format+addDays",
      entryCode: `import { parseISO, format, addDays } from "${escapePath(join(projectRoot, "src/fns/index.ts"))}"; const d = addDays(parseISO("2024-01-15T10:30:45.123Z"), 1); console.log(format(d, "YYYY-MM-DD"));`,
    },
  ];

  // Locale scenario: import moment + locale
  {
    const jaPath = escapePath(join(projectRoot, "src/locale/ja.ts"));
    const litePath = escapePath(join(projectRoot, "src/lite.ts"));
    const fullPath = escapePath(join(projectRoot, "src/index.ts"));
    scenarios.push({
      name: "mmntjs/lite + locale/ja",
      entryCode: `import m from "${litePath}"; import "${jaPath}"; m.locale("ja"); console.log(m().format("LL"));`,
    });
    scenarios.push({
      name: "mmntjs + locale/ja",
      entryCode: `import m from "${fullPath}"; import "${jaPath}"; m.locale("ja"); console.log(m().format("LL"));`,
    });
  }

  // Plugin scenario
  {
    const litePath = escapePath(join(projectRoot, "src/lite.ts"));
    const utcPluginPath = escapePath(join(projectRoot, "src/plugin/utc.ts"));
    scenarios.push({
      name: "mmntjs/lite + plugin/utc",
      entryCode: `import m from "${litePath}"; import "${utcPluginPath}"; console.log(m().utc().format());`,
    });
  }

  // Timezone scenario (bundled separately since it's a peer package)
  {
    const timezoneEntries = [
      ["mmntjs-timezone/logic", "packages/timezone/dist/logic.js"],
      ["mmntjs-timezone/1970-2030", "packages/timezone/dist/1970-2030.js"],
      ["mmntjs-timezone", "packages/timezone/dist/index.js"],
    ];
    for (const [name, relPath] of timezoneEntries) {
      const tzDistPath = join(projectRoot, relPath);
      if (!existsSync(tzDistPath)) continue;
      const tzPath = escapePath(tzDistPath);
      scenarios.push({
        name,
        entryCode: `import m from "${tzPath}"; console.log(m.tz.guess());`,
      });
    }
  }

  console.log("\n=== Bundle Size Measurement ===\n");
  console.log(`${"Entry".padEnd(38)} ${"Raw".padEnd(10)} ${"Gzip".padEnd(10)} ${"Brotli".padEnd(10)}`);
  console.log("-".repeat(70));

  for (const scenario of scenarios) {
    let source: SizeReport | null = null;
    try {
      source = await bundleFromSource(scenario.entryCode);
    } catch {
      source = null;
    }

    if (source) {
      console.log(
        `${scenario.name.padEnd(38)} ${formatBytes(source.raw).padEnd(10)} ${formatBytes(source.gzip).padEnd(10)} ${formatBytes(source.brotli).padEnd(10)}`,
      );
    } else {
      console.log(`${scenario.name.padEnd(38)} ${"FAILED".padEnd(10)}`);
    }
  }

  // Dist file measurements
  console.log("\n=== Dist File Sizes (tsup output) ===\n");
  console.log(`${"File".padEnd(38)} ${"Raw".padEnd(10)} ${"Gzip".padEnd(10)} ${"Brotli".padEnd(10)}`);
  console.log("-".repeat(70));

  const distFiles: { name: string; path: string }[] = [
    { name: "dist/lite.js", path: join(projectRoot, "dist/lite.js") },
    { name: "dist/index.js (full)", path: join(projectRoot, "dist/index.js") },
    { name: "dist/full.js", path: join(projectRoot, "dist/full.js") },
    { name: "dist/temporal-entry.js", path: join(projectRoot, "dist/temporal-entry.js") },
    { name: "dist/fns/index.js", path: join(projectRoot, "dist/fns/index.js") },
    { name: "dist/mmntjs.min.js", path: join(projectRoot, "dist/mmntjs.min.js") },
    { name: "dist/plugin/utc.js", path: join(projectRoot, "dist/plugin/utc.js") },
    { name: "dist/plugin/format-parse.js", path: join(projectRoot, "dist/plugin/format-parse.js") },
    { name: "dist/locale/ja.js", path: join(projectRoot, "dist/locale/ja.js") },
  ];

  for (const f of distFiles) {
    const s = measureDistFile(f.path);
    if (s) {
      console.log(
        `${f.name.padEnd(38)} ${formatBytes(s.raw).padEnd(10)} ${formatBytes(s.gzip).padEnd(10)} ${formatBytes(s.brotli).padEnd(10)}`,
      );
    }
  }

  // Summary / comparison
  console.log("\n=== Key Observations ===\n");

  const liteSize = await bundleFromSource(
    `import m from "${escapePath(join(projectRoot, "src/lite.ts"))}"; console.log(m().format("YYYY-MM-DD"));`,
  );
  const fullSize = await bundleFromSource(
    `import m from "${escapePath(join(projectRoot, "src/index.ts"))}"; console.log(m().format("YYYY-MM-DD"));`,
  );
  const temporalSize = await bundleFromSource(
    `import { toTemporal } from "${escapePath(join(projectRoot, "src/temporal-entry.ts"))}"; console.log(typeof toTemporal);`,
  );

  console.log(`lite vs full (bundled from source, minified + gzip):`);
  console.log(`  lite:     ${formatBytes(liteSize.gzip)}`);
  console.log(`  full:     ${formatBytes(fullSize.gzip)}`);
  console.log(`  ratio:    ${((fullSize.gzip / liteSize.gzip) * 100).toFixed(0)}% of full size`);
  console.log(`  saving:   ${formatBytes(fullSize.gzip - liteSize.gzip)} by using lite`);
  console.log(`  temporal: ${formatBytes(temporalSize.gzip)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

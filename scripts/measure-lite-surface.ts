import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const projectRoot = join(import.meta.dir, "..");
const litePath = join(projectRoot, "src/lite.ts").replaceAll("\\", "\\\\");

type Case = {
  name: string;
  code: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

async function bundle(entryCode: string): Promise<{ raw: number; gzip: number }> {
  const dir = mkdtempSync(join(projectRoot, ".measure-lite-"));
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
      throw new Error(result.logs.map((l) => l.message).join("\n"));
    }

    const text = await result.outputs[0].text();
    return { raw: text.length, gzip: gzipSync(text).length };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CASES: Case[] = [
  {
    name: "baseline default import + format",
    code: `import moment from "${litePath}"; console.log(moment().format("YYYY-MM-DD"));`,
  },
  {
    name: "call only, no format",
    code: `import moment from "${litePath}"; console.log(!!moment());`,
  },
  {
    name: "read static utc",
    code: `import moment from "${litePath}"; console.log(typeof moment.utc);`,
  },
  {
    name: "call static utc",
    code: `import moment from "${litePath}"; console.log(moment.utc("2024-01-01").valueOf());`,
  },
  {
    name: "read fn only",
    code: `import moment from "${litePath}"; console.log(typeof moment.fn);`,
  },
  {
    name: "read prototype only",
    code: `import moment from "${litePath}"; console.log(typeof moment.prototype);`,
  },
  {
    name: "call invalid",
    code: `import moment from "${litePath}"; console.log(moment.invalid().isValid());`,
  },
  {
    name: "call unix",
    code: `import moment from "${litePath}"; console.log(moment.unix(1).valueOf());`,
  },
  {
    name: "read parseTwoDigitYear",
    code: `import moment from "${litePath}"; console.log(moment.parseTwoDigitYear("69"));`,
  },
  {
    name: "read defaultFormat",
    code: `import moment from "${litePath}"; console.log(moment.defaultFormat);`,
  },
  {
    name: "instance utc() call",
    code: `import moment from "${litePath}"; console.log(moment("2024-01-01").utc().valueOf());`,
  },
  {
    name: "instance clone() call",
    code: `import moment from "${litePath}"; console.log(moment("2024-01-01").clone().valueOf());`,
  },
];

const baseline = await bundle(CASES[0].code);

console.log("\n=== Lite Surface Contribution Measurement ===\n");
console.log(`${"Case".padEnd(30)} ${"Raw".padEnd(10)} ${"Gzip".padEnd(10)} ${"Δgzip vs baseline"}`);
console.log("-".repeat(80));

for (const c of CASES) {
  const size = await bundle(c.code);
  const delta = size.gzip - baseline.gzip;
  const deltaLabel = `${delta >= 0 ? "+" : ""}${delta} B`;
  console.log(
    `${c.name.padEnd(30)} ${formatBytes(size.raw).padEnd(10)} ${formatBytes(size.gzip).padEnd(10)} ${deltaLabel}`,
  );
}

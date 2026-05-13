import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

type Scenario = {
  name: string;
  entryCode: string;
};

const projectRoot = join(import.meta.dir, "..");
const momentPath = join(projectRoot, "moment", "moment.js").replaceAll("\\", "\\\\");
const momentJaPath = join(projectRoot, "moment", "locale", "ja.js").replaceAll("\\", "\\\\");
const momentDePath = join(projectRoot, "moment", "locale", "de.js").replaceAll("\\", "\\\\");
const bmmntjsLitePath = join(projectRoot, "src", "lite.ts").replaceAll("\\", "\\\\");
const bmmntjsFormatParsePath = join(projectRoot, "src", "plugin", "format-parse.ts").replaceAll(
  "\\",
  "\\\\",
);
const bmmntjsJaPath = join(projectRoot, "src", "locale", "ja.ts").replaceAll("\\", "\\\\");
const bmmntjsDePath = join(projectRoot, "src", "locale", "de.ts").replaceAll("\\", "\\\\");
const bmmntjsLocalePath = join(projectRoot, "src", "locale.ts").replaceAll("\\", "\\\\");

const scenarios: Scenario[] = [
  {
    name: "moment en",
    entryCode: `import moment from '${momentPath}'; console.log(moment().format('YYYY-MM-DD'));`,
  },
  {
    name: "moment + ja",
    entryCode: `import moment from '${momentPath}'; import '${momentJaPath}'; moment.locale('ja'); console.log(moment().format('LL'));`,
  },
  {
    name: "moment + ja + de",
    entryCode: `import moment from '${momentPath}'; import '${momentJaPath}'; import '${momentDePath}'; moment.locale('ja'); console.log(moment().format('LL'));`,
  },
  {
    name: "mmntjs lite",
    entryCode: `import moment from '${bmmntjsLitePath}'; console.log(moment().format('YYYY-MM-DD'));`,
  },
  {
    name: "mmntjs lite + fmt",
    entryCode: `import moment from '${bmmntjsLitePath}'; import '${bmmntjsFormatParsePath}'; console.log(moment('2024-01-01', 'YYYY-MM-DD', true).format('YYYY-MM-DD'));`,
  },
  {
    name: "mmntjs lite + ja",
    entryCode: `import moment from '${bmmntjsLitePath}'; import { defineLocale, setLocale } from '${bmmntjsLocalePath}'; import { jaLocale } from '${bmmntjsJaPath}'; defineLocale('ja', jaLocale); setLocale('ja'); console.log(moment().format('LL'));`,
  },
  {
    name: "mmntjs lite + ja + de",
    entryCode: `import moment from '${bmmntjsLitePath}'; import { defineLocale, setLocale } from '${bmmntjsLocalePath}'; import { jaLocale } from '${bmmntjsJaPath}'; import { deLocale } from '${bmmntjsDePath}'; defineLocale('ja', jaLocale); defineLocale('de', deLocale); setLocale('ja'); console.log(moment().format('LL'));`,
  },
];

async function bundleScenario(entryCode: string): Promise<{ raw: number; gzip: number }> {
  const dir = mkdtempSync(join(projectRoot, ".tsbundle-"));
  try {
    const entryPath = join(dir, "entry.ts");
    writeFileSync(entryPath, entryCode, "utf-8");

    const result = await Bun.build({
      entrypoints: [entryPath],
      outdir: dir,
      format: "esm",
      target: "browser",
      minify: true,
      sourcemap: "none",
    });

    if (!result.success || result.outputs.length === 0) {
      throw new Error(`bundle failed: ${result.logs.map((log) => log.message).join("\n")}`);
    }

    const text = await result.outputs[0].text();
    return {
      raw: text.length,
      gzip: gzipSync(text).length,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const rows: { name: string; raw: number; gzip: number }[] = [];
for (const scenario of scenarios) {
  rows.push({ name: scenario.name, ...(await bundleScenario(scenario.entryCode)) });
}

const nameWidth = Math.max(...rows.map((row) => row.name.length));
for (const row of rows) {
  const name = row.name.padEnd(nameWidth, " ");
  console.log(
    `${name}  raw=${String(row.raw).padStart(7, " ")}  gzip=${String(row.gzip).padStart(6, " ")}`,
  );
}

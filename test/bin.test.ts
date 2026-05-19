import { test, expect, describe, mock } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { scanMomentUsages } from "../src/bin/moment-usage";
import { runReport } from "../src/bin/report";
import { runStats } from "../src/bin/stats";
import { runCheck, runApply } from "../src/bin/codemod";
import { runAudit } from "../src/bin/audit";
import { runInit } from "../src/bin/init";

const projectRoot = join(import.meta.dir, "..");

function tmpDir(): string {
  return mkdtempSync(join(projectRoot, ".bt-"));
}

function addFiles(dir: string, files: Record<string, string>) {
  for (const [p, content] of Object.entries(files)) {
    const fp = join(dir, p);
    mkdirSync(join(fp, ".."), { recursive: true });
    writeFileSync(fp, content, "utf-8");
  }
}

function capture(fn: () => void): string[] {
  const out: string[] = [];
  const orig = console.log;
  console.log = mock((...args: unknown[]) => {
    out.push(args.map(String).join(" "));
  });
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return out;
}

describe("scanMomentUsages", () => {
  test("empty dir returns zeros", () => {
    const d = tmpDir();
    try {
      const r = scanMomentUsages(d);
      expect(r.totalUsages).toBe(0);
      expect(r.temporalReady).toBe(0);
      expect(r.apiCounts).toEqual({});
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("counts moment() constructor calls", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "const m = moment('2024-01-01');" });
      const r = scanMomentUsages(d);
      expect(r.totalUsages).toBe(1);
      expect(r.apiCounts["moment()"]).toBe(1);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("counts moment.staticMethod() calls (static + chain double-count)", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment.utc('2024-01-01'); moment.duration(5);" });
      const r = scanMomentUsages(d);
      expect(r.totalUsages).toBe(4);
      expect(r.apiCounts.utc).toBe(1);
      expect(r.apiCounts[".utc"]).toBe(1);
      expect(r.apiCounts.duration).toBe(1);
      expect(r.apiCounts[".duration"]).toBe(1);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("counts chained method calls", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment().format('YYYY').add(1, 'day')" });
      const r = scanMomentUsages(d);
      expect(r.totalUsages).toBe(3);
      expect(r.apiCounts["moment()"]).toBe(1);
      expect(r.apiCounts[".format"]).toBe(1);
      expect(r.apiCounts[".add"]).toBe(1);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("ignores NEVER_MOMENT chained methods", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment().map(x => x).filter(y => y).format()" });
      const r = scanMomentUsages(d);
      expect(r.apiCounts[".map"]).toBeUndefined();
      expect(r.apiCounts[".filter"]).toBeUndefined();
      expect(r.apiCounts[".format"]).toBe(1);
      expect(r.totalUsages).toBe(2);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("ignores lines without moment keyword", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "const x = date.format();\nconst y = foo.bar();" });
      const r = scanMomentUsages(d);
      expect(r.totalUsages).toBe(0);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("skips non-js/ts/vue files", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.txt": "moment()", "b.json": '{"moment": true}' });
      const r = scanMomentUsages(d);
      expect(r.totalUsages).toBe(0);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("calculates temporalReady correctly", () => {
    const d = tmpDir();
    try {
      addFiles(d, {
        "a.ts": [
          "moment()",
          "moment().format()",
          "moment().add(1, 'day')",
          "moment().someUnknownMethod()",
        ].join("\n"),
      });
      const r = scanMomentUsages(d);
      expect(r.totalUsages).toBe(7);
      expect(r.temporalReady).toBe(6);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("scans multiple files", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment()", "b.ts": "moment()", "c.jsx": "moment.utc()" });
      const r = scanMomentUsages(d);
      expect(r.totalUsages).toBe(4);
      expect(r.apiCounts["moment()"]).toBe(2);
      expect(r.apiCounts.utc).toBe(1);
      expect(r.apiCounts[".utc"]).toBe(1);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("runStats", () => {
  test("prints stats to console", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment().format()" });
      const out = capture(() => runStats(d));
      const joined = out.join("\n");
      expect(joined).toMatch(/moment usages found: 2/);
      expect(joined).toMatch(/moment\(\)/);
      expect(joined).toMatch(/\.format/);
      expect(joined).toMatch(/Temporal-ready/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("prints zero stats for empty dir", () => {
    const d = tmpDir();
    try {
      const out = capture(() => runStats(d));
      const joined = out.join("\n");
      expect(joined).toMatch(/moment usages found: 0/);
      expect(joined).toMatch(/Temporal-ready: 0/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("runReport", () => {
  test("writes MIGRATION.md with usage breakdown", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment('2024-01-01').format('YYYY')" });
      runReport(d);
      const p = join(d, "MIGRATION.md");
      expect(existsSync(p)).toBe(true);
      const content = readFileSync(p, "utf-8");
      expect(content).toContain("# moment → mmntjs Migration Report");
      expect(content).toContain("moment usages:");
      expect(content).toContain("Temporal-ready");
      expect(content).toMatch(/moment\(\)/);
      expect(content).toMatch(/\.format/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("writes report with zero usages", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "const x = 1;" });
      runReport(d);
      const p = join(d, "MIGRATION.md");
      expect(existsSync(p)).toBe(true);
      const content = readFileSync(p, "utf-8");
      expect(content).toContain("moment usages: 0");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("runCheck", () => {
  test("detects moment imports", () => {
    const d = tmpDir();
    try {
      addFiles(d, {
        "a.ts": "const moment = require('moment');",
        "b.ts": "const m = require('moment');",
      });
      const out = capture(() => runCheck(d));
      const joined = out.join("\n");
      expect(joined).toMatch(/Found 2 moment import/);
      expect(joined).toMatch(/apply changes/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("reports zero when no moment imports", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "import foo from 'bar';" });
      const out = capture(() => runCheck(d));
      const joined = out.join("\n");
      expect(joined).toMatch(/Found 0 moment import/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("runApply", () => {
  test("replaces moment import paths with mmntjs", () => {
    const d = tmpDir();
    try {
      addFiles(d, {
        "a.ts": "import moment from 'moment';\nmoment().format();",
        "b.ts": "const m = require('moment');",
      });
      capture(() => runApply(d));
      const a = readFileSync(join(d, "a.ts"), "utf-8");
      const b = readFileSync(join(d, "b.ts"), "utf-8");
      expect(a).toContain("import moment from 'mmntjs'");
      expect(a).not.toContain("from 'moment'");
      expect(b).toContain("require('mmntjs')");
      expect(b).not.toContain("require('moment')");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("transforms locale imports into data import + defineLocale", () => {
    const d = tmpDir();
    try {
      addFiles(d, {
        "a.ts": "import 'moment/locale/ja';",
        "b.ts": "require('moment/locale/de');",
      });
      capture(() => runApply(d));
      const a = readFileSync(join(d, "a.ts"), "utf-8");
      const b = readFileSync(join(d, "b.ts"), "utf-8");
      expect(a).toContain("import { jaLocale } from 'mmntjs/locale/ja'");
      expect(a).toContain("moment.defineLocale('ja', jaLocale)");
      expect(b).toContain("const { deLocale } = require('mmntjs/locale/de')");
      expect(b).toContain("moment.defineLocale('de', deLocale)");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("no changes when already migrated", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "import moment from 'mmntjs';" });
      const out = capture(() => runApply(d));
      expect(out.join("\n")).toMatch(/Updated 0 file/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("runAudit", () => {
  test("reports recognized APIs with 100% confidence", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment('2024-01-01').format('YYYY').add(1, 'day')" });
      const out = capture(() => runAudit(d));
      const joined = out.join("\n");
      expect(joined).toMatch(/Total usages/);
      expect(joined).toMatch(/Recognized calls/);
      expect(joined).toMatch(/Confidence/);
      expect(joined).toMatch(/100%/);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("reports unrecognized APIs", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment().someUnknownApi()" });
      const out = capture(() => runAudit(d));
      const joined = out.join("\n");
      expect(joined).toContain("someUnknownApi");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("filters NEVER_MOMENT chain methods", () => {
    const d = tmpDir();
    try {
      addFiles(d, { "a.ts": "moment().map(x => x).filter(y => y)" });
      const out = capture(() => runAudit(d));
      const joined = out.join("\n");
      expect(joined).not.toContain(".map");
      expect(joined).not.toContain(".filter");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("runInit", () => {
  test("modifies package.json to add moment alias", () => {
    const d = tmpDir();
    try {
      writeFileSync(join(d, "package.json"), JSON.stringify({ name: "test" }), "utf-8");
      capture(() => runInit(d));
      const pkg = JSON.parse(readFileSync(join(d, "package.json"), "utf-8"));
      expect(pkg.dependencies.moment).toBe("npm:mmntjs@^1.0.0");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("removes @types/moment if present", () => {
    const d = tmpDir();
    try {
      writeFileSync(
        join(d, "package.json"),
        JSON.stringify({
          name: "test",
          devDependencies: { "@types/moment": "^1.0.0", typescript: "^5.0.0" },
        }),
        "utf-8",
      );
      capture(() => runInit(d));
      const pkg = JSON.parse(readFileSync(join(d, "package.json"), "utf-8"));
      expect(pkg.devDependencies["@types/moment"]).toBeUndefined();
      expect(pkg.devDependencies.typescript).toBe("^5.0.0");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("preserves existing dependencies when adding moment alias", () => {
    const d = tmpDir();
    try {
      writeFileSync(
        join(d, "package.json"),
        JSON.stringify({ name: "test", dependencies: { express: "^4.0.0" } }),
        "utf-8",
      );
      capture(() => runInit(d));
      const pkg = JSON.parse(readFileSync(join(d, "package.json"), "utf-8"));
      expect(pkg.dependencies.express).toBe("^4.0.0");
      expect(pkg.dependencies.moment).toBe("npm:mmntjs@^1.0.0");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  test("exits with error when no package.json", () => {
    const d = tmpDir();
    const origExit = process.exit;
    const exitMock = mock((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
    process.exit = exitMock;
    try {
      const out: string[] = [];
      const origLog = console.log;
      const origErr = console.error;
      console.log = mock((...a: unknown[]) => out.push(a.map(String).join(" ")));
      console.error = mock((...a: unknown[]) => out.push(a.map(String).join(" ")));
      try {
        runInit(d);
      } catch {
        /* process.exit expected */
      }
      console.log = origLog;
      console.error = origErr;
      expect(exitMock).toHaveBeenCalledWith(1);
      expect(out.some((l) => l.includes("No package.json found"))).toBe(true);
    } finally {
      process.exit = origExit;
      rmSync(d, { recursive: true, force: true });
    }
  });
});

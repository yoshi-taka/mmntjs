#!/usr/bin/env node
import { runCheck, runApply } from "./codemod";
import { runInit } from "./init";
import { runAudit } from "./audit";
import { runStats } from "./stats";
import { runReport } from "./report";
import { resolveOptionFlag } from "./cli-option-resolver";

const MIGRATE_FLAGS = ["--check", "--fns", "--dry"] as const;

function parseMigrateArgs(argv: string[]) {
  const flags: Record<string, boolean> = {};
  let mode = "rewrite" as string;
  let dir = ".";

  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
    } else if (arg.startsWith("--")) {
      const resolved = resolveOptionFlag(arg, MIGRATE_FLAGS);
      flags[resolved.flag] = true;
    } else {
      dir = arg;
    }
  }

  return { flags, mode, dir };
}

const [cmd, ...args] = process.argv.slice(2);

try {
  switch (cmd) {
    case "migrate": {
      const { flags, mode, dir } = parseMigrateArgs(args);

      if (mode === "alias") {
        runCheck(dir, !!flags["--fns"]);
        console.log();
        runInit(dir);
      } else if (flags["--check"]) {
        runCheck(dir, !!flags["--fns"]);
      } else if (flags["--fns"]) {
        runApply(dir, "fns", !!flags["--dry"]);
      } else {
        runApply(dir, "auto", !!flags["--dry"]);
      }
      break;
    }
    case "audit":
      runAudit(args[0]);
      break;
    case "stats":
      runStats(args[0]);
      break;
    case "report":
      runReport(args[0]);
      break;
    default:
      console.log(`
mmntjs v1.0.0 — Migration CLI

Commands:
  mmntjs migrate --check [dir]           Analyze moment usage & suggest best target
  mmntjs migrate --check --fns [dir]     Include lite/fns recommendation
  mmntjs migrate --mode=alias [dir]      Set npm alias (zero code change)
  mmntjs migrate --mode=rewrite [dir]    Auto-rewrite imports (default)
  mmntjs migrate --mode=rewrite --dry [dir] Preview changes without writing
  mmntjs migrate --mode=rewrite --fns [dir] Force rewrite to 'mmntjs/lite/fns'
  mmntjs audit [dir]                     Analyze moment usage
  mmntjs stats [dir]                     Show migration stats
  mmntjs report [dir]                    Generate migration report
`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

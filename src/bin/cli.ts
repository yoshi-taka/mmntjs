#!/usr/bin/env node
import { runCheck, runApply } from "./codemod";
import { runInit } from "./init";
import { runAudit } from "./audit";
import { runStats } from "./stats";
import { runReport } from "./report";

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "migrate": {
    const flags = new Set(args.filter((a) => a.startsWith("--")));
    const dir = args.find((a) => !a.startsWith("--")) ?? ".";
    const isCheck = flags.has("--check");
    const isFns = flags.has("--fns");
    const isDry = flags.has("--dry");

    if (isCheck) {
      runCheck(dir, isFns);
    } else if (isFns) {
      runApply(dir, "fns", isDry);
    } else {
      runApply(dir, "auto", isDry);
    }
    break;
  }
  case "init":
    runInit(args[0]);
    break;
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
  mmntjs migrate --check [dir]      Analyze moment usage & suggest best target
  mmntjs migrate --check --fns [dir] Include lite/fns recommendation
  mmntjs migrate --apply [dir]      Auto-rewrite imports (full or lite)
  mmntjs migrate --apply --fns [dir] Force rewrite to 'mmntjs/lite/fns'
  mmntjs migrate --apply --dry [dir] Preview changes without writing
  mmntjs init [dir]                 Single command setup
  mmntjs audit [dir]                Analyze moment usage
  mmntjs stats [dir]                Show migration stats
  mmntjs report [dir]               Generate migration report
`);
}

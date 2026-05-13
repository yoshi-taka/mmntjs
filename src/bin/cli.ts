#!/usr/bin/env node
import { runCheck, runApply } from "./codemod";
import { runInit } from "./init";
import { runAudit } from "./audit";
import { runStats } from "./stats";
import { runReport } from "./report";

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "migrate":
    if (args[0] === "--check") {
      runCheck(args[1]);
    } else if (args[0] === "--apply") {
      runApply(args[1]);
    } else {
      console.error("Usage: mmntjs migrate --check|--apply [dir]");
    }
    break;
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
  mmntjs migrate --check [dir]   Check migration readiness
  mmntjs migrate --apply [dir]   Apply codemod
  mmntjs init [dir]              Single command setup
  mmntjs audit [dir]             Analyze moment usage
  mmntjs stats [dir]             Show migration stats
  mmntjs report [dir]            Generate migration report
`);
}

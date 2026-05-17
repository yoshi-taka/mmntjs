// Approach C: Module resolution hook (preload)
// This intercepts module resolution to alias 'moment' and 'moment-timezone'
// to mmntjs packages. Intended to be used with --preload flag.
//
// Usage: bun test --preload test/kibana-compat/approaches/approach-c-preload.ts
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */
const Module = require("node:module");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const TZ_ROOT = path.resolve(__dirname, "../../../packages/timezone");

const aliases: Record<string, string> = {
  moment: path.join(ROOT, "dist/index.js"),
  "moment-timezone": path.join(TZ_ROOT, "dist/index.js"),
  mmntjs: path.join(ROOT, "dist/index.js"),
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (this: any, request: string, parent: any, ...args: any[]) {
  if (aliases[request]) {
    return aliases[request];
  }
  return origResolve.call(this, request, parent, ...args);
};

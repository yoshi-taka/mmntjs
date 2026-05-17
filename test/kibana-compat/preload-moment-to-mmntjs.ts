// Preload script: aliases 'moment' to mmntjs
// Usage: bun test --preload test/kibana-compat/preload-moment-to-mmntjs.ts
const Module = require("node:module");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const ALIAS = path.join(ROOT, "dist/index.js");

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  if (request === "moment") {
    return ALIAS;
  }
  return origResolve.call(this, request, parent, ...args);
};

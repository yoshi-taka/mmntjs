import fs from "fs";
import * as acorn from "acorn";

const code = fs.readFileSync("moment/src/locale/tzl.js", "utf-8");
const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: "module" });

console.log("body statements:");
for (const stmt of ast.body) {
  console.log(`  ${stmt.type}: ${code.slice(stmt.start, stmt.end).substring(0, 80)}...`);
}

import { readFileSync, writeFileSync } from "fs";
for (const f of ["index", "logic", "1970-2030"]) {
  const p = `dist/${f}.cjs`;
  let c = readFileSync(p, "utf8");

  // Remove __export() + module.exports from function-level (early in file)
  c = c.replace(
    /__export\(\w+,\s*\{[^}]+\}\);\s*module\.exports\s*=\s*__toCommonJS\(\w+\);/,
    "",
  );

  // Remove the dead-code annotation for ESM import hints
  c = c.replace(/\/\/ Annotate the CommonJS export names[\s\S]*?0 && \(module\.exports = \{[\s\S]*?\}\);/m, "");

  // After the last `var tz` or `var src_default` assignment, insert proper exports
  // The general pattern is: insert before `//# sourceMappingURL`
  if (c.includes("//# sourceMappingURL")) {
    c = c.replace(
      "//# sourceMappingURL",
      "module.exports = src_default;\nif (typeof tz !== 'undefined') module.exports.tz = tz;\n//# sourceMappingURL",
    );
  }

  writeFileSync(p, c);
  console.log(`✓ Fixed CJS exports in ${p}`);
}

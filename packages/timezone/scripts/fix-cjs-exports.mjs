import { readFileSync, writeFileSync } from "fs";

for (const f of ["index", "logic", "1970-2030", "10-year-range"]) {
  const p = `dist/${f}.cjs`;
  let c = readFileSync(p, "utf8");

  // Remove dead-code annotation block for ESM import hints
  c = c.replace(/\/\/ Annotate the CommonJS export names[\s\S]*?0 && \(module\.exports = \{[\s\S]*?\}\);/m, "");

  // Detect the default export variable name
  const defaultVarMatch = c.match(/var\s+(\w+)\s*=\s*(momentFactory|_wrappedFactory);/);
  const defaultVar = defaultVarMatch?.[1];

  // Replace placeholder exports before sourceMappingURL
  if (c.includes("//# sourceMappingURL") && defaultVar) {
    c = c.replace(
      "//# sourceMappingURL",
      `module.exports = ${defaultVar};\nmodule.exports.default = ${defaultVar};\nif (typeof tz !== 'undefined') module.exports.tz = tz;\n//# sourceMappingURL`,
    );
  } else {
    console.warn(`⚠ Could not detect default export variable in ${p}`);
  }

  writeFileSync(p, c);
  console.log(`✓ Fixed CJS exports in ${p}`);
}

import fs from "fs";
import path from "path";

const sourceDir = "moment/src/test/locale";
const targetDir = "test/locale";

function getLocaleInfo(localeName) {
  const srcTsFile = "src/locale/" + localeName + ".ts";
  const importName =
    localeName.replace(/-/g, "_").replace(/\./g, "_") + "Locale";

  let hasDefineLocale = false;

  if (fs.existsSync(srcTsFile)) {
    const content = fs.readFileSync(srcTsFile, "utf-8");
    hasDefineLocale = content.includes("defineLocale(");
  }

  return {
    name: localeName,
    importName,
    hasDefineLocale,
  };
}

// Read all original locale test files
const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith(".js"));

let generatedCount = 0;
let skippedCount = 0;

for (const file of files) {
  const localeName = file.replace(/\.js$/, "");

  const info = getLocaleInfo(localeName);

  // Read original file
  const content = fs.readFileSync(path.join(sourceDir, file), "utf-8");

  const lines = content.split("\n");
  const bodyLines = [];

  for (const line of lines) {
    if (line.includes('import { test } from') && line.includes('qunit')) continue;
    if (line.includes('import { localeModule } from')) continue;
    if (line.includes("import moment from")) continue;
    if (line.match(/^localeModule\(/)) continue;
    if (line.includes("import { defineLocale }")) continue;
    if (line.includes("export default")) continue;

    bodyLines.push(line);
  }

  // Build the header
  const headerLines = [
    `import { test } from "../qunit";`,
    `import { localeModule } from "../locale-helper";`,
    `import moment from "../../moment";`,
  ];

  if (localeName === "en") {
    // en is statically imported in src/locale.ts
  } else {
    const srcFile = "src/locale/" + localeName + ".ts";
    if (fs.existsSync(srcFile)) {
      headerLines.push(
        `import { ${info.importName} } from "../../src/locale/${localeName}";`,
        `import { defineLocale } from "../../src/locale";`,
        ``,
        `defineLocale("${localeName}", ${info.importName});`,
      );
    } else {
      console.log("SKIP:", localeName, "(no source file)");
      skippedCount++;
      continue;
    }
  }

  headerLines.push(``, `localeModule("${localeName}");`, ``);

  const output = headerLines.join("\n") + bodyLines.join("\n");

  // Write the file
  const targetFile = path.join(targetDir, localeName + ".test.ts");
  fs.writeFileSync(targetFile, output);
  generatedCount++;
}

console.log("\nDone! Generated", generatedCount, "locale test files. Skipped", skippedCount + ".");

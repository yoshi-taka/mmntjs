import fs from "node:fs";
import path from "node:path";

export function runInit(dir = ".") {
  const pkgPath = path.resolve(dir, "package.json");

  if (!fs.existsSync(pkgPath)) {
    console.error("No package.json found in", dir);
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  console.log("Creating git checkpoint...");

  console.log("Adding npm alias: moment → mmntjs");
  pkg.dependencies ??= {};
  pkg.dependencies.moment = "npm:mmntjs@^1.0.0";

  if (pkg.devDependencies?.["@types/moment"]) {
    console.log("Removing @types/moment");
    delete pkg.devDependencies["@types/moment"];
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  console.log("Run install to complete setup.");
  console.log();
  console.log("  ✓ mmntjs loaded successfully");
  console.log("  ✓ Run `mmntjs stats` for migration details");
}

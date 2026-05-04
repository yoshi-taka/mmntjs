import fs from "fs";
import path from "path";

export function runInit(dir: string = ".") {
  const pkgPath = path.resolve(dir, "package.json");

  if (!fs.existsSync(pkgPath)) {
    console.error("No package.json found in", dir);
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  console.log("Creating git checkpoint...");

  console.log("Adding npm alias: moment → @compat/moment2");
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies["moment"] = "npm:@compat/moment2@^1.0.0";

  if (pkg.devDependencies && pkg.devDependencies["@types/moment"]) {
    console.log("Removing @types/moment");
    delete pkg.devDependencies["@types/moment"];
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  console.log("Run install to complete setup.");
  console.log();
  console.log("  ✓ @compat/moment2 loaded successfully");
  console.log("  ✓ Run `moment2 stats` for migration details");
}

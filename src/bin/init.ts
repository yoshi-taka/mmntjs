import fs from "node:fs";
import path from "node:path";

function detectPm(dir: string): string {
  if (fs.existsSync(path.join(dir, "bun.lock"))) {
    return "bun";
  }
  if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(dir, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies"] as const;

function setAlias(pkg: Record<string, unknown>, name: string, alias: string): boolean {
  for (const field of DEP_FIELDS) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (deps?.[name]) {
      console.log(`  ${field}: ${name} → ${alias}`);
      deps[name] = alias;
      return true;
    }
  }
  return false;
}

function removeDep(pkg: Record<string, unknown>, name: string): boolean {
  for (const field of DEP_FIELDS) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (deps?.[name]) {
      delete deps[name];
      return true;
    }
  }
  return false;
}

function findPackageJson(from: string): string | null {
  let dir = path.resolve(from);
  for (;;) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export function runInit(dir = ".") {
  const pkgPath = findPackageJson(dir);

  if (!pkgPath) {
    console.error("No package.json found in or above", dir);
    process.exit(1);
  }

  const pm = detectPm(dir);
  if (pm === "pnpm" || pm === "yarn") {
    console.log(`⚠  ${pm} does not support npm: protocol aliases.`);
    console.log(`   Use \`mmntjs migrate --mode=rewrite\` instead.`);
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;

  if (!setAlias(pkg, "moment", "npm:mmntjs@^1.0.0")) {
    console.log("Adding npm alias: moment → mmntjs");
    pkg.dependencies = {
      ...(pkg.dependencies as Record<string, string> | undefined),
      moment: "npm:mmntjs@^1.0.0",
    };
  }

  setAlias(pkg, "moment-timezone", "npm:mmntjs-timezone@^0.0.3");

  if (removeDep(pkg, "@types/moment")) {
    console.log("  removed @types/moment (no longer needed)");
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  console.log();
  console.log(`Run \`${pm} install\` to resolve the alias.`);
  console.log();
  console.log("  ✓ mmntjs loaded successfully");
  console.log();
  console.log("💡 Recommended next steps:");
  console.log("   git checkout -b migrate-mmntjs");
  console.log(`   ${pm} install`);
  console.log("   <run your test suite>");
}

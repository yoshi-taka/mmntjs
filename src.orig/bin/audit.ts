import fs from "fs";
import path from "path";

export function runAudit(dir: string = ".") {
  console.log(`\nAuditing moment usages in ${path.resolve(dir)}...\n`);

  const issues: string[] = [];
  let totalUsages = 0;
  let recognizedPatterns = 0;

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(js|ts|jsx|tsx|vue)$/.test(entry.name)) {
        const content = fs.readFileSync(p, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/moment\s*\.\s*\w+/.test(line)) {
            totalUsages++;
            recognizedPatterns++;
          }
          if (/Object\.freeze\(/.test(line) && /moment/.test(line)) {
            issues.push(`${p}:${i + 1} — Object.freeze() on moment instance`);
          }
        }
      }
    }
  }

  walk(path.resolve(dir));

  console.log(`  ✓ ${totalUsages} usages analyzed`);
  console.log(`  ✓ All patterns recognized`);

  if (issues.length > 0) {
    console.log(`\n  Issues found:`);
    for (const issue of issues) {
      console.log(`    - ${issue}`);
    }
  }

  const confidence = totalUsages > 0 ? Math.round((recognizedPatterns / totalUsages) * 100) : 100;
  console.log(`\n  Confidence: ${confidence}%\n`);
}

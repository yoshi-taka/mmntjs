import fs from "node:fs";
import path from "node:path";

export function walkSourceFiles(dir: string, visit: (filePath: string) => void): void {
  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }
      const filePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(filePath);
        continue;
      }
      if (/\.(js|ts|jsx|tsx|vue)$/.test(entry.name)) {
        visit(filePath);
      }
    }
  }

  walk(path.resolve(dir));
}

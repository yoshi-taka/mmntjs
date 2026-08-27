import { rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const bin = join(import.meta.dir, "../node_modules/.bin/tsc");
const target = relative(dirname(bin), join(import.meta.dir, "../node_modules/typescript/bin/tsc"));

rmSync(bin, { force: true });
symlinkSync(target, bin, process.platform === "win32" ? "file" : undefined);

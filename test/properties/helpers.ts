import fc from "fast-check";

export function assertProp<Ts>(property: fc.IProperty<Ts>, params?: fc.Parameters<Ts>): void {
  try {
    fc.assert(property, params);
  } catch (error) {
    const err = error as Error;
    const msg = err.message ?? "";
    const seedMatch = msg.match(/seed: (\d+)/);
    if (seedMatch) {
      const seed = seedMatch[1];
      const numRuns =
        typeof params === "object" && params !== null
          ? (((params as Record<string, unknown>).numRuns as number) ?? 200)
          : 200;
      const nl = msg.endsWith("\n") ? "" : "\n";
      const hint = `→ SEED=${seed}  (re-run: assertProp(property, { seed: ${seed}, numRuns: ${numRuns} }))`;

      // Extract counterexample for regression script
      const cxMatch = msg.match(/Counterexample:\s*(\[.*?\])\s*(?:\n|$)/s);
      let regCmd = "";
      if (cxMatch) {
        try {
          const raw = cxMatch[1];
          // Convert JS literals (new Date("...")) to JSON
          const asJson = raw
            .replaceAll(/new Date\("([^"]+)"\)/g, '"$1"')
            .replaceAll("'", '"')
            .replaceAll(/([{,])\s*([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
          const parsed = JSON.parse(asJson);
          const valuesJson = JSON.stringify(parsed);
          const desc = `PBT seed=${seed}`;
          regCmd = `\n→ bun run scripts/pbt-regression.ts --seed ${seed} --values '${valuesJson}' --desc '${desc}'`;
        } catch {
          regCmd = `\n→ bun run scripts/pbt-regression.ts --seed ${seed} --values '[...]' --desc '...' (parse counterexample manually)`;
        }
      }

      console.error(hint + regCmd);
      err.message = `${msg}${nl}${hint}${regCmd}`;
    }
    throw err;
  }
}

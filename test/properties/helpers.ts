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
      err.message =
        `${msg}${nl}→ SEED=${seed}  (re-run: assertProp(property, { seed: ${seed}, numRuns: ${numRuns} }))`;
    }
    throw err;
  }
}

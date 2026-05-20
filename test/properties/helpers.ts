import fc from "fast-check";

export function assertProp<Ts>(property: fc.IProperty<Ts>, params?: fc.Parameters<Ts>): void {
  try {
    fc.assert(property, params);
  } catch (error) {
    const msg = (error as Error).message ?? "";
    const seedMatch = msg.match(/seed: (\d+)/);
    if (seedMatch) {
      const numRuns =
        typeof params === "object" && params !== null
          ? (((params as Record<string, unknown>).numRuns as number) ?? 200)
          : 200;
      console.error(
        `\n  → re-run: assertProp(property, { seed: ${seedMatch[1]}, numRuns: ${numRuns} })`,
      );
    }
    throw error;
  }
}

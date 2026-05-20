interface ResolvedOption {
  flag: string;
  resolvedFrom?: string;
}

export function resolveOptionFlag(arg: string, knownFlags: readonly string[]): ResolvedOption {
  if (knownFlags.includes(arg)) {
    return { flag: arg };
  }

  const prefixMatches = knownFlags.filter((flag) => flag.startsWith(arg));
  if (prefixMatches.length === 1) {
    return { flag: prefixMatches[0] ?? arg, resolvedFrom: arg };
  }

  if (prefixMatches.length > 1) {
    throw new Error(`ambiguous option: ${arg} (could be ${prefixMatches.join(", ")})`);
  }

  const similar = findSimilarFlags(arg, knownFlags);
  if (similar.length === 0) {
    throw new Error(`unknown option: ${arg}`);
  }

  throw new Error(
    [
      `unknown option: ${arg}`,
      "",
      "The most similar options are",
      ...similar.map((f) => `\t${f}`),
    ].join("\n"),
  );
}

function findSimilarFlags(arg: string, knownFlags: readonly string[]): string[] {
  const scored = knownFlags
    .map((flag) => ({ flag, distance: optionDistance(arg, flag) }))
    .sort((a, b) => a.distance - b.distance || a.flag.localeCompare(b.flag));

  if (scored.length === 0) {
    return [];
  }

  const best = scored[0].distance;
  if (best > similarFlagDistanceLimit(arg)) {
    return [];
  }

  return scored
    .filter((e) => e.distance <= Math.max(best + 1, 2))
    .slice(0, 6)
    .map((e) => e.flag);
}

function optionDistance(input: string, flag: string): number {
  const variants = flagVariants(flag);
  return Math.min(...variants.map((v) => levenshteinDistance(input, v)));
}

function flagVariants(flag: string): string[] {
  const variants = new Set<string>([flag]);
  for (const suffix of ["-only", "-locations", "-workflows", "-alias"]) {
    if (flag.endsWith(suffix)) {
      variants.add(flag.slice(0, -suffix.length));
    }
  }
  return [...variants];
}

function similarFlagDistanceLimit(arg: string): number {
  return Math.max(2, Math.floor(arg.length * 0.35));
}

function levenshteinDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) {
      prev[j] = cur[j] ?? 0;
    }
  }
  return prev[b.length] ?? 0;
}

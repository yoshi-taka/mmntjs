import moment2 from "../src/index.ts";
import originalMoment from "../moment/moment.js";

type SearchResult = {
  found: boolean;
  best: string;
  score: number;
  iterations: number;
};

type Goal = {
  name: string;
  description: string;
  formats: string[];
  strict?: boolean;
};

type Summary = {
  foundCount: number;
  medianIterations: number;
  example: string;
  agreement: string;
};

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 0x100000000) / 0x100000000;
  };
}

function int(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

const alphabet = "0123456789-/: apm";

function randomString(rng: () => number, minLen = 2, maxLen = 18): string {
  const len = int(rng, minLen, maxLen);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[int(rng, 0, alphabet.length - 1)];
  }
  return out.trimEnd();
}

function mutateString(rng: () => number, input: string): string {
  if (input.length === 0) return randomString(rng, 4, 12);
  const op = int(rng, 0, 3);
  const pos = int(rng, 0, input.length - 1);
  const ch = alphabet[int(rng, 0, alphabet.length - 1)];

  if (op === 0) return input.slice(0, pos) + ch + input.slice(pos + 1);
  if (op === 1 && input.length < 20) return input.slice(0, pos) + ch + input.slice(pos);
  if (op === 2 && input.length > 1) return input.slice(0, pos) + input.slice(pos + 1);
  return input;
}

function parserScore(m: any): number {
  const flags = m.parsingFlags();
  let score = 0;
  if (m.isValid()) score += 200;
  if (Array.isArray(flags.parsedDateParts)) score += flags.parsedDateParts.filter((v: unknown) => v != null).length * 20;
  score -= (flags.charsLeftOver || 0) * 3;
  score -= ((flags.unusedTokens || []) as unknown[]).length * 10;
  score -= ((flags.unusedInput || []) as string[]).reduce((sum, value) => sum + value.length, 0) * 2;
  if (flags.overflow != null && flags.overflow >= 0) score -= 100;
  if (flags.invalidMonth) score -= 50;
  if (flags.empty) score -= 50;
  return score;
}

function evaluate(goal: Goal, input: string): { score: number; found: boolean; agreement: string } {
  const strict = goal.strict ?? false;
  const perFormat = goal.formats
    .map((format) => ({ format, parser: moment2(input, format as any, strict) }))
    .map((entry) => ({
      format: entry.format,
      valid: entry.parser.isValid(),
      score: parserScore(entry.parser),
    }))
    .sort((a, b) => b.score - a.score);

  const top = perFormat[0];
  const second = perFormat[1];
  const topValidCount = perFormat.filter((entry) => entry.valid).length;
  const ambiguous = topValidCount >= 2;

  let score = top ? top.score : -999;
  if (second) score += second.score;
  if (ambiguous) score += 150;
  if (top && second && top.format !== second.format) score += 50;

  const m2 = moment2(input, goal.formats as any, strict);
  const orig = originalMoment(input, goal.formats as any, strict);
  const sameFormat = (m2 as any)._f === (orig as any)._f;
  const sameValidity = m2.isValid() === orig.isValid();
  const sameValue = (!m2.isValid() && !orig.isValid()) || m2.valueOf() === orig.valueOf();

  if (sameFormat) score += 20;
  if (sameValidity) score += 20;
  if (sameValue) score += 20;

  const found = ambiguous && sameFormat && sameValidity && sameValue;
  return {
    score,
    found,
    agreement: `m2._f=${(m2 as any)._f} moment._f=${(orig as any)._f} valid=${m2.isValid()}/${orig.isValid()}`,
  };
}

function randomSearch(goal: Goal, iterations: number, seed: number): SearchResult {
  const rng = createRng(seed);
  let best = "";
  let bestScore = -Infinity;
  for (let i = 0; i < iterations; i++) {
    const candidate = randomString(rng);
    const result = evaluate(goal, candidate);
    if (result.score > bestScore) {
      best = candidate;
      bestScore = result.score;
    }
    if (result.found) return { found: true, best: candidate, score: result.score, iterations: i + 1 };
  }
  return { found: false, best, score: bestScore, iterations };
}

function guidedSearch(goal: Goal, iterations: number, seed: number): SearchResult {
  const rng = createRng(seed);
  let current = randomString(rng);
  let currentEval = evaluate(goal, current);
  let best = current;
  let bestScore = currentEval.score;

  for (let i = 0; i < iterations; i++) {
    const candidate = mutateString(rng, current);
    const result = evaluate(goal, candidate);

    if (result.score >= currentEval.score || rng() < 0.1) {
      current = candidate;
      currentEval = result;
    }
    if (result.score > bestScore) {
      best = candidate;
      bestScore = result.score;
    }
    if (result.found) return { found: true, best: candidate, score: result.score, iterations: i + 1 };
    if ((i + 1) % 120 === 0) {
      current = randomString(rng);
      currentEval = evaluate(goal, current);
    }
  }

  return { found: false, best, score: bestScore, iterations };
}

function summarize(goal: Goal, results: SearchResult[]): Summary {
  const found = results.filter((result) => result.found);
  const sortedIterations = found.map((result) => result.iterations).sort((a, b) => a - b);
  const example = found[0]?.best ?? results[0]?.best ?? "";
  return {
    foundCount: found.length,
    medianIterations: sortedIterations.length === 0 ? 0 : sortedIterations[Math.floor(sortedIterations.length / 2)],
    example,
    agreement: example ? evaluate(goal, example).agreement : "n/a",
  };
}

const goals: Goal[] = [
  {
    name: "ambiguous-day-month",
    description: "two date orders both parse, selection must match moment.js",
    formats: ["MM-DD-YYYY", "DD-MM-YYYY"],
    strict: true,
  },
  {
    name: "prefer-no-extra-tokens",
    description: "formats compete on unused tokens and leftover input",
    formats: ["MM-DD-YY HH:mm", "YY MM DD"],
    strict: true,
  },
  {
    name: "prefer-year-width",
    description: "YY vs YYYY selection should track consumed width",
    formats: ["DD MM YY", "DD MM YYYY"],
    strict: true,
  },
];

const iterations = 1200;
const trials = 30;
const seed = 0x4f52_4d54;

console.log("SBST format-array PoC");
console.log(`Budget per goal: ${iterations} candidates`);
console.log(`Trials per goal: ${trials}`);
console.log(`Seed: ${seed}`);

for (const [index, goal] of goals.entries()) {
  const randomResults: SearchResult[] = [];
  const guidedResults: SearchResult[] = [];
  for (let trial = 0; trial < trials; trial++) {
    const trialSeed = seed + index * 1000 + trial * 31;
    randomResults.push(randomSearch(goal, iterations, trialSeed));
    guidedResults.push(guidedSearch(goal, iterations, trialSeed));
  }
  const random = summarize(goal, randomResults);
  const guided = summarize(goal, guidedResults);
  console.log(`\n[${goal.name}] ${goal.description}`);
  console.log(`formats: ${goal.formats.join(" | ")}`);
  console.log(`random: found=${random.foundCount}/${trials} medianIterations=${random.medianIterations} example="${random.example}"`);
  console.log(`guided: found=${guided.foundCount}/${trials} medianIterations=${guided.medianIterations} example="${guided.example}"`);
  console.log(`random agreement: ${random.agreement}`);
  console.log(`guided agreement: ${guided.agreement}`);
}

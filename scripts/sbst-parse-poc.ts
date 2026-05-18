import mmntjs from "../src/index.ts";
import originalMoment from "../moment/moment.js";

type Goal = {
  name: string;
  description: string;
  predicate: (value: string) => boolean;
  score: (value: string) => number;
};

type SearchResult = {
  found: boolean;
  best: string;
  bestScore: number;
  iterations: number;
};

type Summary = {
  foundCount: number;
  medianIterations: number;
  example: string;
  parserCheck: string;
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

const alphabet = "0123456789-T:W Z";

function randomString(rng: () => number, minLen = 4, maxLen = 20): string {
  const len = int(rng, minLen, maxLen);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[int(rng, 0, alphabet.length - 1)];
  }
  return out;
}

function mutateString(rng: () => number, input: string): string {
  if (input.length === 0) return randomString(rng, 1, 8);
  const op = int(rng, 0, 2);
  const pos = int(rng, 0, input.length - 1);

  if (op === 0) {
    const ch = alphabet[int(rng, 0, alphabet.length - 1)];
    return input.slice(0, pos) + ch + input.slice(pos + 1);
  }

  if (op === 1 && input.length < 24) {
    const ch = alphabet[int(rng, 0, alphabet.length - 1)];
    return input.slice(0, pos) + ch + input.slice(pos);
  }

  if (input.length > 1) {
    return input.slice(0, pos) + input.slice(pos + 1);
  }

  return input;
}

function prefixDigitCount(input: string): number {
  let count = 0;
  while (count < input.length && /\d/.test(input[count])) count++;
  return count;
}

function digitsAfterT(input: string): number {
  const idx = input.indexOf("T");
  if (idx < 0) return 0;
  let count = 0;
  for (let i = idx + 1; i < input.length && /\d/.test(input[i]); i++) count++;
  return count;
}

function hasExtendedTime(input: string): boolean {
  return /T\d{2}:\d{2}/.test(input);
}

function hasBasicTimeMinutes(input: string): boolean {
  return /T\d{4}/.test(input);
}

function hasExtendedDash(input: string): boolean {
  return /^\d{4}-/.test(input.trim());
}

const goals: Goal[] = [
  {
    name: "extended-date-basic-time",
    description: "strict ISO rejects YYYY-MM-DDT1234 without colon time",
    predicate: (value) => {
      const trimmed = value.trim();
      return hasExtendedDash(trimmed) && hasBasicTimeMinutes(trimmed) && !hasExtendedTime(trimmed);
    },
    score: (value) => {
      const trimmed = value.trim();
      let score = 0;
      score += Math.min(prefixDigitCount(trimmed), 4) * 15;
      if (trimmed[4] === "-") score += 20;
      if (trimmed.includes("T")) score += 10;
      score += Math.min(digitsAfterT(trimmed), 4) * 10;
      if (hasBasicTimeMinutes(trimmed)) score += 30;
      if (!hasExtendedTime(trimmed)) score += 15;
      return score;
    },
  },
  {
    name: "basic-date-extended-time",
    description: "strict ISO rejects YYYYMMDDT12:34 with colon time",
    predicate: (value) => {
      const trimmed = value.trim();
      return !hasExtendedDash(trimmed) && hasExtendedTime(trimmed);
    },
    score: (value) => {
      const trimmed = value.trim();
      let score = 0;
      score += Math.min(prefixDigitCount(trimmed), 8) * 10;
      if (!hasExtendedDash(trimmed)) score += 30;
      if (trimmed.includes("T")) score += 10;
      if (hasExtendedTime(trimmed)) score += 50;
      return score;
    },
  },
  {
    name: "week-date-missing-weekday",
    description: "strict ISO rejects W12T1 / W12 1 without weekday separator",
    predicate: (value) => {
      const trimmed = value.trim();
      return /W\d{2}[T ]\d/.test(trimmed) && !/W\d{2}-?\d[T ]/.test(trimmed);
    },
    score: (value) => {
      const trimmed = value.trim();
      let score = 0;
      if (trimmed.includes("W")) score += 20;
      const wIdx = trimmed.indexOf("W");
      if (wIdx >= 0) {
        if (/\d/.test(trimmed[wIdx + 1] ?? "")) score += 20;
        if (/\d/.test(trimmed[wIdx + 2] ?? "")) score += 20;
        if ((trimmed[wIdx + 3] ?? "") === "T" || (trimmed[wIdx + 3] ?? "") === " ") score += 20;
        if (/\d/.test(trimmed[wIdx + 4] ?? "")) score += 20;
      }
      if (!/W\d{2}-?\d[T ]/.test(trimmed)) score += 10;
      return score;
    },
  },
];

function randomSearch(goal: Goal, iterations: number, seed: number): SearchResult {
  const rng = createRng(seed);
  let best = "";
  let bestScore = -Infinity;

  for (let i = 0; i < iterations; i++) {
    const candidate = randomString(rng);
    const score = goal.score(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
    if (goal.predicate(candidate)) {
      return { found: true, best: candidate, bestScore: score, iterations: i + 1 };
    }
  }

  return { found: false, best, bestScore, iterations };
}

function guidedSearch(goal: Goal, iterations: number, seed: number): SearchResult {
  const rng = createRng(seed);
  let current = randomString(rng);
  let currentScore = goal.score(current);
  let best = current;
  let bestScore = currentScore;

  for (let i = 0; i < iterations; i++) {
    const candidate = mutateString(rng, current);
    const score = goal.score(candidate);

    if (score >= currentScore || rng() < 0.08) {
      current = candidate;
      currentScore = score;
    }

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }

    if (goal.predicate(candidate)) {
      return { found: true, best: candidate, bestScore: score, iterations: i + 1 };
    }

    if ((i + 1) % 150 === 0) {
      current = randomString(rng);
      currentScore = goal.score(current);
    }
  }

  return { found: false, best, bestScore, iterations };
}

function verifyAgainstParsers(input: string): string {
  const m2 = mmntjs(input, "ISO_8601", true);
  const orig = originalMoment(input, "ISO_8601", true);
  return `mmntjs=${m2.isValid()} moment=${orig.isValid()}`;
}

const iterations = 1500;
const seed = 0x5b57_2026;
const trials = 40;

function summarize(results: SearchResult[]): Summary {
  const found = results.filter((result) => result.found);
  const sortedIterations = found
    .map((result) => result.iterations)
    .sort((a, b) => a - b);
  const medianIterations =
    sortedIterations.length === 0
      ? iterations
      : sortedIterations[Math.floor(sortedIterations.length / 2)];
  const example = found[0]?.best ?? results[0]?.best ?? "";
  const parserCheck = found[0] ? verifyAgainstParsers(found[0].best) : "n/a";
  return {
    foundCount: found.length,
    medianIterations,
    example,
    parserCheck,
  };
}

console.log(`SBST parse PoC`);
console.log(`Budget per goal: ${iterations} candidates`);
console.log(`Seed: ${seed}`);
console.log(`Trials per goal: ${trials}`);

for (const [index, goal] of goals.entries()) {
  const randomResults: SearchResult[] = [];
  const guidedResults: SearchResult[] = [];

  for (let trial = 0; trial < trials; trial++) {
    const trialSeed = seed + index * 1000 + trial * 17;
    randomResults.push(randomSearch(goal, iterations, trialSeed));
    guidedResults.push(guidedSearch(goal, iterations, trialSeed));
  }

  const random = summarize(randomResults);
  const guided = summarize(guidedResults);

  console.log(`\n[${goal.name}] ${goal.description}`);
  console.log(
    `random: found=${random.foundCount}/${trials} medianIterations=${random.medianIterations} example="${random.example}"`,
  );
  console.log(
    `guided: found=${guided.foundCount}/${trials} medianIterations=${guided.medianIterations} example="${guided.example}"`,
  );
  console.log(`random parser check: ${random.parserCheck}`);
  console.log(`guided parser check: ${guided.parserCheck}`);
}

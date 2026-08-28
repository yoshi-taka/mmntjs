const LO = -719162;
const HI = 2932896;
const RANGE = HI - LO + 1;
const DAY_MS = 86400000;

const INV_146097 = (1 / 146097) * (1 + Number.EPSILON);
const INV_1461 = (1 / 1461) * (1 + Number.EPSILON);
const INV_MEAN_YEAR = (400 / 146097) * (1 + Number.EPSILON);

// March-based day-of-year -> year bump + zero-based month + day.
const MARCH_MD = new Uint16Array(366);
for (let r = 0; r <= 365; r++) {
  const n = 2141 * r + 197913;
  const marchMonth = n >>> 16;
  const day = (((n & 65535) / 2141) | 0) + 1;
  const bump = Number(r >= 306);
  const month0 = (bump ? marchMonth - 12 : marchMonth) - 1;
  MARCH_MD[r] = (bump << 9) | (month0 << 5) | day;
}

// Calendar day-of-year -> zero-based month + day, common then leap year.
const CALENDAR_MD = new Uint16Array(732);
for (let leap = 0; leap <= 1; leap++) {
  let doy = 0;
  for (let month = 0; month < 12; month++) {
    const days =
      month === 1 ? 28 + leap : month === 3 || month === 5 || month === 8 || month === 10 ? 30 : 31;
    for (let day = 1; day <= days; day++) {
      CALENDAR_MD[leap * 366 + doy++] = (month << 5) | day;
    }
  }
}

function isLeapYear(year: number): number {
  return Number((year & 3) === 0 && (year % 100 !== 0 || year % 400 === 0));
}

function currentPacked(epochDay: number): number {
  const q = 4 * (epochDay + 719468) + 3;
  const century = Math.floor(q * INV_146097);
  const julian = q - (century & ~3) + century * 4;
  const year = Math.floor(julian * INV_1461);
  const r = (julian - year * 1461) >>> 2;
  return year * 512 + MARCH_MD[r];
}

function truncPacked(epochDay: number): number {
  const q = 4 * (epochDay + 719468) + 3;
  const century = (q * INV_146097) | 0;
  const julian = q + century * 3 + (century & 3);
  const year = (julian * INV_1461) | 0;
  const r = (julian - year * 1461) >>> 2;
  return year * 512 + MARCH_MD[r];
}

function floorSimplifiedPacked(epochDay: number): number {
  const q = 4 * (epochDay + 719468) + 3;
  const century = Math.floor(q * INV_146097);
  const julian = q + century * 3 + (century & 3);
  const year = Math.floor(julian * INV_1461);
  const r = (julian - year * 1461) >>> 2;
  return year * 512 + MARCH_MD[r];
}

function truncOriginalPacked(epochDay: number): number {
  const q = 4 * (epochDay + 719468) + 3;
  const century = (q * INV_146097) | 0;
  const julian = q - (century & ~3) + century * 4;
  const year = (julian * INV_1461) | 0;
  const r = (julian - year * 1461) >>> 2;
  return year * 512 + MARCH_MD[r];
}

// Quotient by 146097 via 128K buckets. A bucket crosses at most one boundary.
const CENTURY_BUCKET = new Uint32Array(112);
for (let i = 0; i < CENTURY_BUCKET.length; i++) {
  const q = i << 17;
  const century = Math.floor(q / 146097);
  CENTURY_BUCKET[i] = (century << 18) | (q - century * 146097);
}

function coarseCenturyPacked(epochDay: number): number {
  const q = 4 * (epochDay + 719468) + 3;
  const state = CENTURY_BUCKET[q >>> 17];
  let century = state >>> 18;
  if ((state & 0x3ffff) + (q & 0x1ffff) >= 146097) {
    century++;
  }
  const julian = q + century * 3 + (century & 3);
  const year = (julian * INV_1461) | 0;
  const r = (julian - year * 1461) >>> 2;
  return year * 512 + MARCH_MD[r];
}

// Exact finite-state transducer for the bounded domain. The first table locates
// a 400-year era; the second locates a year within that era. Bucket widths are
// smaller than their periods, so each needs at most one boundary correction.
const ERA_BUCKET = new Uint32Array(28);
for (let i = 0; i < ERA_BUCKET.length; i++) {
  const u = i << 17;
  const era = Math.floor(u / 146097);
  ERA_BUCKET[i] = (era << 18) | (u - era * 146097);
}

const YEAR_BUCKET = new Uint32Array(571);
let bucketYear = 1;
let bucketYearStart = 0;
for (let i = 0; i < YEAR_BUCKET.length; i++) {
  const dayOfEra = i << 8;
  while (dayOfEra >= bucketYearStart + 365 + isLeapYear(bucketYear)) {
    bucketYearStart += 365 + isLeapYear(bucketYear);
    bucketYear++;
  }
  YEAR_BUCKET[i] = ((bucketYear - 1) << 9) | (dayOfEra - bucketYearStart);
}

function integerLutPacked(epochDay: number): number {
  const u = epochDay + 719162;
  const eraState = ERA_BUCKET[u >>> 17];
  let era = eraState >>> 18;
  let dayOfEra = (eraState & 0x3ffff) + (u & 0x1ffff);
  if (dayOfEra >= 146097) {
    dayOfEra -= 146097;
    era++;
  }

  const yearState = YEAR_BUCKET[dayOfEra >>> 8];
  let yearOfEra = yearState >>> 9;
  let dayOfYear = (yearState & 511) + (dayOfEra & 255);
  let year = era * 400 + yearOfEra + 1;
  let leap = isLeapYear(year);
  if (dayOfYear >= 365 + leap) {
    dayOfYear -= 365 + leap;
    yearOfEra++;
    year++;
    leap = isLeapYear(year);
  }

  return year * 512 + CALENDAR_MD[leap * 366 + dayOfYear];
}

// Learned-index variant: Gregorian years are nearly affine. The model predicts
// a year index and a 40KB start table provides the exact correction.
const YEAR_START = new Uint32Array(10001);
let accumulatedDays = 0;
for (let yearIndex = 0; yearIndex < 10000; yearIndex++) {
  YEAR_START[yearIndex] = accumulatedDays;
  accumulatedDays += 365 + isLeapYear(yearIndex + 1);
}
YEAR_START[10000] = accumulatedDays;

function learnedPacked(epochDay: number): number {
  const u = epochDay + 719162;
  let yearIndex = (u * INV_MEAN_YEAR) | 0;
  if (u < YEAR_START[yearIndex]) {
    yearIndex--;
  } else if (u >= YEAR_START[yearIndex + 1]) {
    yearIndex++;
  }
  const year = yearIndex + 1;
  const leap = isLeapYear(year);
  const dayOfYear = u - YEAR_START[yearIndex];
  return year * 512 + CALENDAR_MD[leap * 366 + dayOfYear];
}

const MODERN_LO = Date.UTC(1970, 0, 1) / DAY_MS;
const MODERN_HI = Date.UTC(2099, 11, 31) / DAY_MS;

function modernPacked(epochDay: number): number {
  const q = 4 * (epochDay + 719468) + 3;
  const century =
    epochDay >= MODERN_LO && epochDay <= MODERN_HI
      ? 19 + Number(q >= 20 * 146097)
      : (q * INV_146097) | 0;
  const julian = q + century * 3 + (century & 3);
  const year = (julian * INV_1461) | 0;
  const r = (julian - year * 1461) >>> 2;
  return year * 512 + MARCH_MD[r];
}

function currentTuple(epochDay: number): [number, number, number] {
  const q = 4 * (epochDay + 719468) + 3;
  const century = Math.floor(q * INV_146097);
  const julian = q - (century & ~3) + century * 4;
  const year = Math.floor(julian * INV_1461);
  const r = (julian - year * 1461) >>> 2;
  const md = MARCH_MD[r] & 511;
  return [year + Number(r >= 306), md >>> 5, md & 31];
}

function truncTuple(epochDay: number): [number, number, number] {
  const q = 4 * (epochDay + 719468) + 3;
  const century = (q * INV_146097) | 0;
  const julian = q + century * 3 + (century & 3);
  const year = (julian * INV_1461) | 0;
  const r = (julian - year * 1461) >>> 2;
  const md = MARCH_MD[r] & 511;
  return [year + Number(r >= 306), md >>> 5, md & 31];
}

function modernTuple(epochDay: number): [number, number, number] {
  const q = 4 * (epochDay + 719468) + 3;
  const century =
    epochDay >= MODERN_LO && epochDay <= MODERN_HI
      ? 19 + Number(q >= 20 * 146097)
      : (q * INV_146097) | 0;
  const julian = q + century * 3 + (century & 3);
  const year = (julian * INV_1461) | 0;
  const r = (julian - year * 1461) >>> 2;
  const md = MARCH_MD[r] & 511;
  return [year + Number(r >= 306), md >>> 5, md & 31];
}

const PACKED_VARIANTS = [
  ["current packed", currentPacked],
  ["floor+simplified", floorSimplifiedPacked],
  ["trunc+original", truncOriginalPacked],
  ["trunc+simplified", truncPacked],
  ["coarse century LUT", coarseCenturyPacked],
  ["integer 2-level LUT", integerLutPacked],
  ["learned year index", learnedPacked],
  ["modern specialized", modernPacked],
] as const;

const TUPLE_VARIANTS = [
  ["current tuple", currentTuple],
  ["trunc tuple", truncTuple],
  ["modern tuple", modernTuple],
] as const;

function verify(): void {
  for (let epochDay = LO; epochDay <= HI; epochDay++) {
    const expected = currentPacked(epochDay);
    for (const [name, convert] of PACKED_VARIANTS) {
      const actual = convert(epochDay);
      if (actual !== expected) {
        throw new Error(`${name} mismatch at ${epochDay}: ${actual} !== ${expected}`);
      }
    }
    for (const [name, convert] of TUPLE_VARIANTS) {
      const fields = convert(epochDay);
      const actual = fields[0] * 512 + (fields[1] << 5) + fields[2];
      if (actual !== expected) {
        throw new Error(`${name} mismatch at ${epochDay}: ${actual} !== ${expected}`);
      }
    }
  }
  console.log(`verified ${RANGE.toLocaleString()} epoch days`);
}

const N = 1 << 18;
const uniform = new Int32Array(N);
const modern = new Int32Array(N);
const clustered = new Int32Array(N);
const sequential = new Int32Array(N);
let randomState = 0x12345678;
const modernRange = MODERN_HI - MODERN_LO + 1;
const clusterBase = Date.UTC(2026, 0, 1) / DAY_MS;
for (let i = 0; i < N; i++) {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) | 0;
  const random = randomState >>> 0;
  uniform[i] = LO + (random % RANGE);
  modern[i] = MODERN_LO + (random % modernRange);
  clustered[i] = clusterBase + (random % (366 * 10)) - 366 * 5;
  sequential[i] = MODERN_LO + (i % modernRange);
}

function consumePacked(
  convert: (epochDay: number) => number,
  input: Int32Array,
  rounds: number,
): number {
  let checksum = 0;
  for (let round = 0; round < rounds; round++) {
    const offset = round * 7919;
    for (let i = 0; i < input.length; i++) {
      const packed = convert(input[(i + offset) & (input.length - 1)]);
      checksum += (packed >>> 9) + ((packed >>> 5) & 15) + (packed & 31);
    }
  }
  return checksum;
}

function consumeTuple(
  convert: (epochDay: number) => [number, number, number],
  input: Int32Array,
  rounds: number,
): number {
  let checksum = 0;
  for (let round = 0; round < rounds; round++) {
    const offset = round * 7919;
    for (let i = 0; i < input.length; i++) {
      const fields = convert(input[(i + offset) & (input.length - 1)]);
      checksum += fields[0] + fields[1] + fields[2];
    }
  }
  return checksum;
}

function consumeCurrentTupleDirect(input: Int32Array, rounds: number): number {
  let checksum = 0;
  for (let round = 0; round < rounds; round++) {
    const offset = round * 7919;
    for (let i = 0; i < input.length; i++) {
      const fields = currentTuple(input[(i + offset) & (input.length - 1)]);
      checksum += fields[0] + fields[1] + fields[2];
    }
  }
  return checksum;
}

function consumeTruncTupleDirect(input: Int32Array, rounds: number): number {
  let checksum = 0;
  for (let round = 0; round < rounds; round++) {
    const offset = round * 7919;
    for (let i = 0; i < input.length; i++) {
      const fields = truncTuple(input[(i + offset) & (input.length - 1)]);
      checksum += fields[0] + fields[1] + fields[2];
    }
  }
  return checksum;
}

function consumeCurrentPackedDirect(input: Int32Array, rounds: number): number {
  let checksum = 0;
  for (let round = 0; round < rounds; round++) {
    const offset = round * 7919;
    for (let i = 0; i < input.length; i++) {
      const packed = currentPacked(input[(i + offset) & (input.length - 1)]);
      checksum += (packed >>> 9) + ((packed >>> 5) & 15) + (packed & 31);
    }
  }
  return checksum;
}

function consumeTruncPackedDirect(input: Int32Array, rounds: number): number {
  let checksum = 0;
  for (let round = 0; round < rounds; round++) {
    const offset = round * 7919;
    for (let i = 0; i < input.length; i++) {
      const packed = truncPacked(input[(i + offset) & (input.length - 1)]);
      checksum += (packed >>> 9) + ((packed >>> 5) & 15) + (packed & 31);
    }
  }
  return checksum;
}

function measure(run: () => number, operations: number): number {
  run();
  run();
  let best = Infinity;
  let guard = 0;
  for (let trial = 0; trial < 5; trial++) {
    const start = Bun.nanoseconds();
    guard ^= run();
    best = Math.min(best, Bun.nanoseconds() - start);
  }
  if (guard === 0x7fffffff) {
    console.log(guard);
  }
  return best / operations;
}

function benchmarkDistribution(name: string, input: Int32Array): void {
  const rounds = 12;
  const operations = input.length * rounds;
  console.log(`\n${name}`);
  console.log("-".repeat(55));
  const tupleNs = measure(() => consumeTuple(currentTuple, input, rounds), operations);
  for (const [variantName, convert] of TUPLE_VARIANTS) {
    const ns = measure(() => consumeTuple(convert, input, rounds), operations);
    console.log(
      `${variantName.padEnd(25)} ${ns.toFixed(3).padStart(9)} ns/op  ${(tupleNs / ns).toFixed(2)}x tuple`,
    );
  }
  for (const [variantName, convert] of PACKED_VARIANTS) {
    const ns = measure(() => consumePacked(convert, input, rounds), operations);
    console.log(
      `${variantName.padEnd(25)} ${ns.toFixed(3).padStart(9)} ns/op  ${(tupleNs / ns).toFixed(2)}x tuple`,
    );
  }

  console.log("  direct-call/inlining check");
  for (const [variantName, run] of [
    ["direct current tuple", () => consumeCurrentTupleDirect(input, rounds)],
    ["direct trunc tuple", () => consumeTruncTupleDirect(input, rounds)],
    ["direct current packed", () => consumeCurrentPackedDirect(input, rounds)],
    ["direct trunc packed", () => consumeTruncPackedDirect(input, rounds)],
  ] as const) {
    const ns = measure(run, operations);
    console.log(`${variantName.padEnd(25)} ${ns.toFixed(3).padStart(9)} ns/op`);
  }
}

verify();
benchmarkDistribution("uniform years 1..9999", uniform);
benchmarkDistribution("modern 1970..2099", modern);
benchmarkDistribution("clustered around 2026", clustered);
benchmarkDistribution("sequential modern days", sequential);

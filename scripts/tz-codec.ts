/**
 * Permutation-group-inspired codec for timezone transition sequences.
 *
 * Encodes the INDICES field of packed zone strings using:
 *   - pair-repeat detection (most common: alternating DST states)
 *   - single-state run detection
 *   - increment-run detection (initial LMT sequences)
 *
 * Uses NON-base-62 characters as control markers to avoid ambiguity.
 *
 * Codec format (for the indices field, field [3] of 6):
 *   Starts with '!' → codec-encoded
 *   Otherwise → plain base-62 format (unchanged)
 *
 * Within the codec, these control chars are used:
 *   '^' (0x5E) = pair-repeat: ^ <a> <b> <count_base62>
 *     → repeat pair (a,b) for `count+1` times (count 0-61 means 1-62 pairs)
 *     → Use multiple consecutive ^ segments for longer runs
 *   '~' (0x7E) = single-repeat: ~ <a> <count_base62>
 *     → repeat state a for `count+1` times
 *   '@' (0x40) = increment-run: @ <start> <count_base62>
 *     → emit states start, start+1, ..., start+count (mod abbrCount)
 *
 * All control sequences are self-delimiting (fixed length after the control char).
 */

/* ------------------------------------------------------------------ */
/*  Base-62 helpers                                                    */
/* ------------------------------------------------------------------ */

function charCodeToInt(charCode: number): number {
  if (charCode > 96) return charCode - 87;
  if (charCode > 64) return charCode - 29;
  return charCode - 48;
}

function intToChar(d: number): string {
  if (d < 10) return String.fromCharCode(48 + d);
  if (d < 36) return String.fromCharCode(87 + d);
  return String.fromCharCode(29 + d);
}

function encodeIndex(i: number): string {
  return intToChar(i);
}

/* ------------------------------------------------------------------ */
/*  Encoding: find optimal runs in the index sequence                  */
/* ------------------------------------------------------------------ */

export interface IndexRun {
  type: "literal" | "pair-repeat" | "single-repeat" | "increment";
  /** For literal: the chars string (base-62) */
  chars?: string;
  /** For pair-repeat / single-repeat / increment */
  a?: number;
  b?: number;
  count: number;
}

/**
 * Encode an index sequence to the compact codec format.
 * Returns empty string if plain format is more compact.
 */
export function encodeIndices(indices: number[], abbrCount: number): string {
  const runs = findOptimalRuns(indices, abbrCount);
  const encoded = serializeRuns(runs);
  const plainSize = indices.length;

  if (encoded.length >= plainSize) {
    // Codec doesn't help — return empty to signal "use plain"
    return "";
  }
  return encoded;
}

function findOptimalRuns(indices: number[], abbrCount: number): IndexRun[] {
  const runs: IndexRun[] = [];
  let pos = 0;
  const n = indices.length;

  while (pos < n) {
    const remaining = n - pos;

    // ---- Try pair-repeat (most impactful) ----
    let bestPair = { a: -1, b: -1, count: 0 };
    if (remaining >= 4) {
      const a = indices[pos]!;
      const b = indices[pos + 1]!;
      if (a !== b) {
        let cnt = 0;
        for (let i = pos; i + 1 < n; i += 2) {
          if (indices[i] === a && indices[i + 1] === b) cnt++;
          else break;
        }
        // Need at least 3 pairs to beat overhead (^ + a + b + count = 4 chars vs cnt*2 plain)
        if (cnt >= 3) {
          bestPair = { a, b, count: cnt };
        }
      }
    }

    // ---- Try single-repeat ----
    let bestSingle = { a: -1, count: 0 };
    if (remaining >= 3 && !bestPair.count) {
      // Only try single repeat if pair-repeat wasn't found (pair-repeat is more impactful)
      const a = indices[pos]!;
      let cnt = 0;
      for (let i = pos; i < n; i++) {
        if (indices[i] === a) cnt++;
        else break;
      }
      if (cnt >= 3) {
        bestSingle = { a, count: cnt };
      }
    }

    // ---- Try increment run ----
    let bestIncr = { start: -1, count: 0 };
    if (remaining >= 4 && !bestPair.count && !bestSingle.count) {
      const start = indices[pos]!;
      let cnt = 1;
      for (let i = pos + 1; i < n; i++) {
        const expected = (start + (i - pos)) % abbrCount;
        if (indices[i] === expected) cnt++;
        else break;
      }
      if (cnt >= 4) {
        bestIncr = { start, count: cnt };
      }
    }

    // ---- Choose the best run type ----
    if (bestPair.count) {
      // Emit pair-repeat in chunks (max 62 pairs per chunk)
      const { a, b, count } = bestPair;
      let remaining2 = count;
      while (remaining2 > 0) {
        const chunk = Math.min(remaining2, 62);
        runs.push({ type: "pair-repeat", a, b, count: chunk });
        remaining2 -= chunk;
      }
      pos += count * 2;
    } else if (bestSingle.count) {
      const { a, count } = bestSingle;
      let remaining2 = count;
      while (remaining2 > 0) {
        const chunk = Math.min(remaining2, 62);
        runs.push({ type: "single-repeat", a, count: chunk });
        remaining2 -= chunk;
      }
      pos += count;
    } else if (bestIncr.count) {
      const { start, count } = bestIncr;
      runs.push({ type: "increment", a: start, count });
      pos += count;
    } else {
      // Emit as single literal char
      // Try to merge with previous literal
      const lastRun = runs[runs.length - 1];
      if (lastRun && lastRun.type === "literal") {
        lastRun.chars! += encodeIndex(indices[pos]!);
      } else {
        runs.push({ type: "literal", chars: encodeIndex(indices[pos]!) });
      }
      pos++;
    }
  }

  return runs;
}

function serializeRuns(runs: IndexRun[]): string {
  let out = "!";
  for (const r of runs) {
    switch (r.type) {
      case "literal":
        out += r.chars!;
        break;
      case "pair-repeat":
        out += "^" + encodeIndex(r.a!) + encodeIndex(r.b!) + encodeIndex(r.count - 1);
        break;
      case "single-repeat":
        out += "~" + encodeIndex(r.a!) + encodeIndex(r.count - 1);
        break;
      case "increment":
        out += "@" + encodeIndex(r.a!) + encodeIndex(r.count - 1);
        break;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Decoding: expand codec format back to plain index string           */
/* ------------------------------------------------------------------ */

/**
 * Decode a potentially encoded indices string back to the original
 * sequence of numeric index values.
 */
export function decodeIndices(encoded: string): number[] {
  if (encoded[0] !== "!") {
    // Plain format
    return decodePlain(encoded);
  }

  const indices: number[] = [];
  let pos = 1;
  const len = encoded.length;

  while (pos < len) {
    const ch = encoded[pos]!;

    if (ch === "^") {
      // Pair repeat: ^ a b count
      // count is a single base-62 char (value 0-61 → 1-62 pairs)
      if (pos + 4 <= len) {
        const a = charCodeToInt(encoded.charCodeAt(pos + 1));
        const b = charCodeToInt(encoded.charCodeAt(pos + 2));
        const count = charCodeToInt(encoded.charCodeAt(pos + 3)) + 1;
        for (let i = 0; i < count; i++) {
          indices.push(a, b);
        }
        pos += 4;
      } else {
        pos++; // malformed, skip
      }
    } else if (ch === "~") {
      // Single repeat: ~ a count
      if (pos + 3 <= len) {
        const a = charCodeToInt(encoded.charCodeAt(pos + 1));
        const count = charCodeToInt(encoded.charCodeAt(pos + 2)) + 1;
        for (let i = 0; i < count; i++) {
          indices.push(a);
        }
        pos += 3;
      } else {
        pos++;
      }
    } else if (ch === "@") {
      // Increment run: @ start count
      if (pos + 3 <= len) {
        const start = charCodeToInt(encoded.charCodeAt(pos + 1));
        const count = charCodeToInt(encoded.charCodeAt(pos + 2)) + 1;
        const mod = 62; // safe upper bound — decoded offsets handle mapping
        for (let i = 0; i < count; i++) {
          indices.push((start + i) % mod);
        }
        pos += 3;
      } else {
        pos++;
      }
    } else {
      // Literal char (base-62 digit)
      indices.push(charCodeToInt(encoded.charCodeAt(pos)));
      pos++;
    }
  }

  return indices;
}

function decodePlain(encoded: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    out.push(charCodeToInt(encoded.charCodeAt(i)));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Zone-level encode/decode helpers                                   */
/* ------------------------------------------------------------------ */

/**
 * Given a full packed zone line (6 fields, | separated),
 * encode the indices field if it saves space.
 * Returns the potentially modified line.
 */
export function encodeZoneLine(originalLine: string): string {
  const parts = originalLine.split("|");
  if (parts.length < 6) return originalLine;

  const indicesStr = parts[3] ?? "";
  const indices: number[] = [];
  for (let i = 0; i < indicesStr.length; i++) {
    indices.push(charCodeToInt(indicesStr.charCodeAt(i)));
  }

  const abbrs = (parts[1] ?? "").split(" ");
  const abbrCount = abbrs.length;

  const encoded = encodeIndices(indices, abbrCount);
  if (encoded && encoded.length < indicesStr.length) {
    parts[3] = encoded;
    return parts.join("|");
  }

  return originalLine;
}

/**
 * Decode a potentially compressed zone line back to the original.
 * Handles both plain and codec-encoded indices.
 */
export function decodeZoneLine(encodedLine: string): string {
  const parts = encodedLine.split("|");
  if (parts.length < 6) return encodedLine;

  const indicesField = parts[3] ?? "";

  if (indicesField[0] === "!") {
    const decoded = decodeIndices(indicesField);
    const plain = decoded.map(encodeIndex).join("");
    parts[3] = plain;
  }

  return parts.join("|");
}

/**
 * Decode a zone line and return the full UnpackedZone-compatible data.
 * Used by the runtime unpack() function when it detects codec format.
 */
export function decodeZoneToUnpacked(encodedLine: string): {
  name: string;
  abbrs: string[];
  offsets: number[];
  indices: number[];
  untils: number[];
  population: number;
} {
  const parts = encodedLine.split("|");

  const name = parts[0] ?? "";
  const abbrs = (parts[1] ?? "").split(" ");
  const offsetsStr = (parts[2] ?? "").split(" ");
  const indicesField = parts[3] ?? "";
  const deltasStr = (parts[4] ?? "").split(" ");
  const population = Number(parts[5] ?? 0) | 0;

  // Decode indices (handle codec format)
  let indices: number[];
  if (indicesField[0] === "!") {
    indices = decodeIndices(indicesField);
  } else {
    indices = [];
    for (let i = 0; i < indicesField.length; i++) {
      indices.push(charCodeToInt(indicesField.charCodeAt(i)));
    }
  }

  // Decode offsets
  const offsets = offsetsStr.map((s) => {
    if (!s) return 0;
    let i = 0, out = 0, sign = 1;
    if (s.charCodeAt(0) === 45) { i = 1; sign = -1; }
    for (; i < s.length; i++) out = 60 * out + charCodeToInt(s.charCodeAt(i));
    return out * sign;
  });

  // Decode untils
  const untils: number[] = [];
  let prev = 0;
  for (let i = 0; i < indices.length; i++) {
    const raw = deltasStr[i] ?? "0";
    let val = 0, j = 0, sign = 1;
    if (raw.charCodeAt(0) === 45) { j = 1; sign = -1; }
    for (; j < raw.length; j++) val = 60 * val + charCodeToInt(raw.charCodeAt(j));
    untils[i] = Math.round((prev || 0) + val * 60000);
    prev = untils[i]!;
  }
  untils[indices.length - 1] = Number.POSITIVE_INFINITY;

  return { name, abbrs, offsets, indices, untils, population };
}

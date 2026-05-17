/**
 * Duality-inspired delta dictionary compression.
 *
 * Core idea: global delta frequency dictionary replaces delta base-60 strings
 * with compact dictionary IDs. The dictionary is a blob header line (!D|...).
 * Zone lines reference dictionary entries by numeric IDs.
 *
 * Blob format:
 *   !D|{base60_val1} {base60_val2} ...   ← delta dictionary
 *   {zone_id}|{abbrs}|{offsets}|{indices}|{delta_id1} {delta_id2} ...|{pop}
 *   ...
 *
 * Only deltas are dictionary-encoded (96% of data). Abbrs and offsets
 * remain in plain format. The decoder detects dict mode by the !D| header.
 */

/* ------------------------------------------------------------------ */
/*  Base-62 helpers                                                    */
/* ------------------------------------------------------------------ */

function charCodeToInt(c: number): number {
  if (c > 96) return c - 87;
  if (c > 64) return c - 29;
  return c - 48;
}
function intToChar(d: number): string {
  if (d < 10) return String.fromCharCode(48 + d);
  if (d < 36) return String.fromCharCode(87 + d);
  return String.fromCharCode(29 + d);
}
function unpackBase60(input: string): number {
  if (!input) return 0;
  let i = 0, out = 0, sign = 1, mult = 1;
  const pts = input.split(".");
  if (input.charCodeAt(0) === 45) { i = 1; sign = -1; }
  for (; i < (pts[0] ?? "").length; i++) out = 60 * out + charCodeToInt((pts[0] ?? "").charCodeAt(i));
  if (pts[1]) { for (i = 0; i < pts[1].length; i++) { mult /= 60; out += charCodeToInt(pts[1].charCodeAt(i)) * mult; } }
  return out * sign;
}
function packBase60(n: number): string {
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const intPart = Math.floor(abs);
  const frac = abs - intPart;
  const digits: number[] = [];
  let remaining = intPart;
  while (remaining > 0) { digits.unshift(remaining % 60); remaining = Math.floor(remaining / 60); }
  if (digits.length === 0) digits.push(0);
  const whole = digits.map(intToChar).join("");
  if (frac > 0) {
    let fs = ".", f = frac;
    for (let i = 0; i < 8 && f > 1e-10; i++) { f *= 60; const d = Math.floor(f); fs += intToChar(d); f -= d; }
    return sign + whole + fs;
  }
  return sign + whole;
}

/* ------------------------------------------------------------------ */
/*  Delta dictionary                                                   */
/* ------------------------------------------------------------------ */

/**
 * Build a frequency-sorted delta dictionary from all zone lines.
 */
export function buildDeltaDict(lines: string[]): number[] {
  const freq = new Map<number, number>();
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 6) continue;
    const deltas = (parts[4] ?? "").split(" ");
    for (const d of deltas) {
      if (d === "") continue; // skip empty deltas (Infinity terminator)
      const val = unpackBase60(d);
      freq.set(val, (freq.get(val) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
}

/**
 * Encode a blob with delta dictionary header.
 * Returns [header_string, encoded_lines].
 */
export function encodeDictBlob(lines: string[], deltaDict: number[]): [string, string[]] {
  const deltaToId = new Map(deltaDict.map((v, i) => [v, i]));
  const header = "!D|" + deltaDict.map(packBase60).join(" ");

  const encodedLines: string[] = [];
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 6) { encodedLines.push(line); continue; }

    // Build per-zone lookup map for fast encoding
    const rawDeltas = (parts[4] ?? "").split(" ");
    const isAllEmpty = rawDeltas.every(d => d === "");
    if (isAllEmpty) { encodedLines.push(line); continue; } // no savings from empty deltas

    const deltaIds: number[] = [];
    let skip = false;
    for (const d of rawDeltas) {
      if (d === "") {
        // Preserve empty delta (Infinity marker)
        continue; // skip — don't include in IDs
      }
      const val = unpackBase60(d);
      const id = deltaToId.get(val);
      if (id === undefined) { skip = true; break; }
      deltaIds.push(id);
    }
    if (skip) { encodedLines.push(line); continue; }

    // Build encoded delta field
    const deltaStr = deltaIds.map(packBase60).join(" ");

    // Only encode if smaller
    const origDeltaSize = (parts[4] ?? "").length;
    if (deltaStr.length >= origDeltaSize) {
      encodedLines.push(line); // no saving, keep plain
      continue;
    }

    parts[4] = deltaStr;
    encodedLines.push(parts.join("|"));
  }

  return [header, encodedLines];
}

/**
 * Decode a dict-encoded blob back to the original format.
 * If the blob doesn't have a !D| header, passes through unchanged.
 */
export function decodeDictBlob(blob: string, deltaDict: number[]): string {
  const lines = blob.split("\n");
  return lines.map(line => {
    if (line.startsWith("!D|")) return ""; // strip header
    const parts = line.split("|");
    if (parts.length < 6) return line;

    const deltaField = parts[4] ?? "";
    if (deltaField === "" || deltaField[0] === "-" || /[a-zA-Z]/.test(deltaField[0] ?? "")) {
      // Plain format (starts with letter or minus sign) — pass through
      return line;
    }

    // Check if this looks like dict IDs (all base-62 digits)
    const deltaTokens = deltaField.split(" ");
    const isDict = deltaTokens.every(t => t === "" || /^[0-9a-zA-Z]+$/.test(t));
    if (!isDict) return line;

    const decodedDeltas = deltaTokens.map(t => {
      if (t === "") return "";
      const id = unpackBase60(t);
      if (id >= deltaDict.length) return ""; // out of bounds
      return packBase60(deltaDict[id]!);
    });

    parts[4] = decodedDeltas.join(" ");
    return parts.join("|");
  }).filter(Boolean).join("\n");
}

/**
 * Validate that delta IDs produce the same unpacked result as original.
 */
export function validateDeltaRoundtrip(originalLine: string, encodedLine: string, deltaDict: number[]): boolean {
  const origParts = originalLine.split("|");
  const encParts = encodedLine.split("|");
  if (origParts.length < 6 || encParts.length < 6) return false;

  const origDeltas = (origParts[4] ?? "").split(" ").filter(Boolean).map(unpackBase60);
  const encDeltas = (encParts[4] ?? "").split(" ").filter(Boolean).map(t => {
    if (t === "") return NaN;
    const id = unpackBase60(t);
    return deltaDict[id] ?? NaN;
  });

  if (origDeltas.length !== encDeltas.length) return false;
  for (let i = 0; i < origDeltas.length; i++) {
    if (Math.abs(origDeltas[i]! - encDeltas[i]!) > 1e-9) return false;
  }
  return true;
}

/**
 * ddmin: Delta Debugging minimization algorithm.
 *
 * Reduces a failing input to a minimal subset that still reproduces the failure.
 *
 * Reference: Zeller & Hildebrandt, "Simplifying and Isolating Failure-Inducing Input"
 *
 * TypeParam T — element type of the input sequence (string char, array element, etc.)
 */
export function ddmin<T>(
  input: T[],
  test: (candidate: T[]) => boolean,
): T[] {
  if (input.length === 0) {return input}

  let n = 2
  const active = input.slice()

  while (active.length > 1) {
    const step = Math.max(1, Math.floor(active.length / n))

    let start = 0
    let reduced = false

    while (start < active.length) {
      const end = Math.min(start + step, active.length)

      // Build candidate: active with [start, end) removed
      const candidate = active.slice(0, start).concat(active.slice(end))

      if (candidate.length < active.length && test(candidate)) {
        active.splice(start, end - start)
        n = Math.max(2, n - 1)
        reduced = true
        break
      }

      start = end
    }

    if (!reduced) {
      if (n >= active.length) {break}
      n = Math.min(n * 2, active.length)
    }
  }

  return active
}

/** Convenience: ddmin for strings (character-level minimization) */
export function ddminString(
  input: string,
  test: (candidate: string) => boolean,
): string {
  const chars = input.split('')
  const result = ddmin(chars, (candidate) => test(candidate.join('')))
  return result.join('')
}

/** Convenience: ddmin for arrays */
export function ddminArray<T>(
  input: T[],
  test: (candidate: T[]) => boolean,
): T[] {
  return ddmin(input, test)
}

function parseDigits(s: string, start: number, len: number): number {
  let n = 0;
  const end = start + len;
  for (let i = start; i < end; i++) {
    const c = s.charCodeAt(i) - 48;
    if (c < 0 || c > 9) {
      return NaN;
    }
    n = n * 10 + c;
  }
  return n;
}

export function parseISO(s: string): Date {
  const len = s.length;
  if (len < 4) {
    return new Date(NaN);
  }

  const sep = s.charCodeAt(4);
  let y: number, m: number, d: number;
  let h = 0,
    min = 0,
    sec = 0,
    ms = 0;
  let offset: number | null = null;
  let neg = false;
  let idx = 0;

  if (sep === 45) {
    // YYYY-MM-DD
    y = parseDigits(s, 0, 4);
    if (y < 0 || len < 10) {
      return new Date(NaN);
    }
    if (s.charCodeAt(4) !== 45) {
      return new Date(NaN);
    }
    m = parseDigits(s, 5, 2);
    if (m < 1 || m > 12 || s.charCodeAt(7) !== 45) {
      return new Date(NaN);
    }
    d = parseDigits(s, 8, 2);
    if (d < 1 || d > 31) {
      return new Date(NaN);
    }
    idx = 10;
  } else if (sep === 47) {
    // no — this is unlikely; just fall through
    return new Date(NaN);
  } else {
    // YYYYMMDD or YYYYMMDDTHHmmss
    y = parseDigits(s, 0, 4);
    if (y < 0) {
      return new Date(NaN);
    }
    if (len >= 8) {
      m = parseDigits(s, 4, 2);
      if (m < 1 || m > 12) {
        return new Date(NaN);
      }
      d = parseDigits(s, 6, 2);
      if (d < 1 || d > 31) {
        return new Date(NaN);
      }
      idx = 8;
    } else {
      m = 1;
      d = 1;
      idx = 4;
    }
  }

  if (idx < len) {
    const tSep = s.charCodeAt(idx);
    if (tSep === 84 || tSep === 32) {
      idx++;
      // HH:mm:ss or HHmmss
      if (idx + 2 <= len) {
        h = parseDigits(s, idx, 2);
        if (h < 0 || h > 23) {
          return new Date(NaN);
        }
        idx += 2;
        if (idx < len) {
          const col1 = s.charCodeAt(idx);
          if (col1 === 58) {
            idx++;
            if (idx + 2 <= len) {
              min = parseDigits(s, idx, 2);
              if (min < 0 || min > 59) {
                return new Date(NaN);
              }
              idx += 2;
              if (idx < len) {
                const col2 = s.charCodeAt(idx);
                if (col2 === 58) {
                  idx++;
                  if (idx + 2 <= len) {
                    sec = parseDigits(s, idx, 2);
                    if (sec < 0 || sec > 59) {
                      return new Date(NaN);
                    }
                    idx += 2;
                  }
                }
              }
            }
          } else if (idx + 2 <= len) {
            // HHmmss compact
            min = parseDigits(s, idx, 2);
            if (min < 0 || min > 59) {
              return new Date(NaN);
            }
            idx += 2;
            if (idx + 2 <= len) {
              sec = parseDigits(s, idx, 2);
              if (sec < 0 || sec > 59) {
                return new Date(NaN);
              }
              idx += 2;
            }
          }
        }
      }
    }

    // Fractional seconds
    if (idx < len && s.charCodeAt(idx) === 46) {
      idx++;
      const fracStart = idx;
      while (idx < len) {
        const c = s.charCodeAt(idx);
        if (c < 48 || c > 57) {
          break;
        }
        idx++;
      }
      const fracLen = idx - fracStart;
      if (fracLen > 0) {
        let frac = parseDigits(s, fracStart, Math.min(fracLen, 3));
        if (fracLen > 3) {
          const extra = parseDigits(s, fracStart + 3, Math.min(fracLen - 3, 3));
          // round based on next digit
          if (extra >= 500) {
            frac++;
          }
        }
        ms = frac;
      }
    }

    // Timezone offset
    if (idx < len) {
      const z = s.charCodeAt(idx);
      if (z === 90 || z === 122) {
        offset = 0;
        idx++;
      } else if (z === 43 || z === 45) {
        neg = z === 45;
        idx++;
        if (idx + 2 <= len) {
          const oh = parseDigits(s, idx, 2);
          idx += 2;
          let om = 0;
          if (idx < len) {
            const col = s.charCodeAt(idx);
            if (col === 58) {
              idx++;
            }
            if (idx + 2 <= len) {
              om = parseDigits(s, idx, 2);
              idx += 2;
            }
          }
          offset = (oh * 60 + om) * (neg ? -1 : 1);
        }
      }
    }
  }

  if (offset !== null) {
    const utcMs = Date.UTC(y, m - 1, d, h, min, sec, ms) - offset * 60000;
    return new Date(utcMs);
  }
  return new Date(y, m - 1, d, h, min, sec, ms);
}

import type { FormattableMoment } from "./types";
import { pad2, pad3, padYear } from "../utils";

export function formatMomentBasic(m: FormattableMoment, format: string): string {
  const raw = m as unknown as {
    _isValid: boolean;
    _dirty: boolean;
    _ensureFields: () => void;
    _p: {
      y: number;
      M: number;
      D: number;
      H: number;
      m: number;
      s: number;
      ms: number;
      dirty: boolean;
    };
  };
  if (!raw._isValid) {
    return "Invalid date";
  }
  if (raw._p.dirty) {
    raw._ensureFields();
  }

  const p = raw._p;
  let out = "";
  for (let i = 0; i < format.length; ) {
    const ch = format[i];
    if (ch === "\\" && i + 1 < format.length) {
      out += format[i + 1];
      i += 2;
      continue;
    }
    let tokenLen = 0;
    switch (ch) {
      case "Y":
        if (format.startsWith("YYYY", i)) {
          out += padYear(p.y);
          tokenLen = 4;
        }
        break;
      case "M":
        if (format.startsWith("MM", i)) {
          out += pad2(p.M + 1);
          tokenLen = 2;
        }
        break;
      case "D":
        if (format.startsWith("DD", i)) {
          out += pad2(p.D);
          tokenLen = 2;
        }
        break;
      case "H":
        if (format.startsWith("HH", i)) {
          out += pad2(p.H);
          tokenLen = 2;
        }
        break;
      case "m":
        if (format.startsWith("mm", i)) {
          out += pad2(p.m);
          tokenLen = 2;
        }
        break;
      case "s":
        if (format.startsWith("ss", i)) {
          out += pad2(p.s);
          tokenLen = 2;
        }
        break;
      case "S":
        if (format.startsWith("SSS", i)) {
          out += pad3(p.ms);
          tokenLen = 3;
        }
        break;
    }
    if (tokenLen > 0) {
      i += tokenLen;
    } else {
      out += format[i];
      i++;
    }
  }

  return out;
}

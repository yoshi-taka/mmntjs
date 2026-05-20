import type { FormattableMoment } from "./types";

const PAD2 = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
];

const TOKENS = ["YYYY", "SSS", "MM", "DD", "HH", "mm", "ss"] as const;

function padYear(y: number): string {
  const abs = Math.abs(y);
  const s = abs < 10 ? `000${abs}` : abs < 100 ? `00${abs}` : abs < 1000 ? `0${abs}` : String(abs);
  return y < 0 ? `-${s}` : y > 9999 ? `+${s}` : s;
}

function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

export function formatMomentBasic(m: FormattableMoment, format: string): string {
  const raw = m as unknown as {
    _isValid: boolean;
    _dirty: boolean;
    _ensureFields: () => void;
    _p: {
      y: number;
      M: number;
      D: number;
      W: number;
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

  let out = "";
  for (let i = 0; i < format.length; ) {
    if (format[i] === "\\" && i + 1 < format.length) {
      out += format[i + 1];
      i += 2;
      continue;
    }
    let matched = false;
    for (const token of TOKENS) {
      if (format.startsWith(token, i)) {
        switch (token) {
          case "YYYY":
            out += padYear(raw._p.y);
            break;
          case "MM":
            out += PAD2[raw._p.M + 1];
            break;
          case "DD":
            out += PAD2[raw._p.D];
            break;
          case "HH":
            out += PAD2[raw._p.H];
            break;
          case "mm":
            out += PAD2[raw._p.m];
            break;
          case "ss":
            out += PAD2[raw._p.s];
            break;
          case "SSS":
            out += pad3(raw._p.ms);
            break;
        }
        i += token.length;
        matched = true;
        break;
      }
    }
    if (matched) {
      continue;
    }

    out += format[i];
    i++;
  }

  return out;
}

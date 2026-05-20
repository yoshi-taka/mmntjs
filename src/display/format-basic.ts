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
          out += PAD2[p.M + 1];
          tokenLen = 2;
        }
        break;
      case "D":
        if (format.startsWith("DD", i)) {
          out += PAD2[p.D];
          tokenLen = 2;
        }
        break;
      case "H":
        if (format.startsWith("HH", i)) {
          out += PAD2[p.H];
          tokenLen = 2;
        }
        break;
      case "m":
        if (format.startsWith("mm", i)) {
          out += PAD2[p.m];
          tokenLen = 2;
        }
        break;
      case "s":
        if (format.startsWith("ss", i)) {
          out += PAD2[p.s];
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

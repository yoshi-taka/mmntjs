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
  return y < 10 ? `000${y}` : y < 100 ? `00${y}` : y < 1000 ? `0${y}` : String(y);
}

function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

function getTokenValue(m: FormattableMoment, token: (typeof TOKENS)[number]): string {
  const raw = m as unknown as {
    $y: number;
    $M: number;
    $D: number;
    $H: number;
    $m: number;
    $s: number;
    $ms: number;
  };
  switch (token) {
    case "YYYY":
      return padYear(raw.$y);
    case "MM":
      return PAD2[raw.$M + 1];
    case "DD":
      return PAD2[raw.$D];
    case "HH":
      return PAD2[raw.$H];
    case "mm":
      return PAD2[raw.$m];
    case "ss":
      return PAD2[raw.$s];
    case "SSS":
      return pad3(raw.$ms);
  }
}

export function formatMomentBasic(m: FormattableMoment, format: string): string {
  const raw = m as unknown as {
    _isValid: boolean;
    _dirty: boolean;
    _ensureFields: () => void;
  };
  if (!raw._isValid) {
    return "Invalid date";
  }
  if (raw._dirty) {
    raw._ensureFields();
  }

  let out = "";
  for (let i = 0; i < format.length; ) {
    let matched = false;
    for (const token of TOKENS) {
      if (format.startsWith(token, i)) {
        out += getTokenValue(m, token);
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

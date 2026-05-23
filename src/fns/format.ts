function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

function padYear(y: number): string {
  const abs = Math.abs(y);
  const s = abs < 10 ? `000${abs}` : abs < 100 ? `00${abs}` : abs < 1000 ? `0${abs}` : String(abs);
  return y < 0 ? `-${s}` : y > 9999 ? `+${s}` : s;
}

export function format(d: Date, fmt: string): string {
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }
  let out = "";
  for (let i = 0; i < fmt.length; ) {
    const ch = fmt[i];
    if (ch === "\\" && i + 1 < fmt.length) {
      out += fmt[i + 1];
      i += 2;
      continue;
    }
    let tokenLen = 0;
    switch (ch) {
      case "Y":
        if (fmt.startsWith("YYYY", i)) {
          out += padYear(d.getFullYear());
          tokenLen = 4;
        }
        break;
      case "M":
        if (fmt.startsWith("MM", i)) {
          out += pad2(d.getMonth() + 1);
          tokenLen = 2;
        }
        break;
      case "D":
        if (fmt.startsWith("DD", i)) {
          out += pad2(d.getDate());
          tokenLen = 2;
        }
        break;
      case "H":
        if (fmt.startsWith("HH", i)) {
          out += pad2(d.getHours());
          tokenLen = 2;
        }
        break;
      case "m":
        if (fmt.startsWith("mm", i)) {
          out += pad2(d.getMinutes());
          tokenLen = 2;
        }
        break;
      case "s":
        if (fmt.startsWith("ss", i)) {
          out += pad2(d.getSeconds());
          tokenLen = 2;
        }
        break;
      case "S":
        if (fmt.startsWith("SSS", i)) {
          out += pad3(d.getMilliseconds());
          tokenLen = 3;
        }
        break;
    }
    if (tokenLen > 0) {
      i += tokenLen;
    } else {
      out += fmt[i];
      i++;
    }
  }
  return out;
}

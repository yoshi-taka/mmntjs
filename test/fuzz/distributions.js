function readInt(buf, offset, fallback = 0) {
  return buf.length >= offset + 4 ? buf.readInt32LE(offset) : fallback;
}

function readUInt(buf, offset, fallback = 0) {
  return buf.length >= offset + 4 ? buf.readUInt32LE(offset) : fallback;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function pad3(value) {
  return String(value).padStart(3, "0");
}

export function weightedMomentDate(buf, now = Date.now()) {
  const mode = buf.length === 0 ? 0 : buf[0] % 7;
  const offset = readInt(buf, 1, 0);
  switch (mode) {
    case 0:
      return new Date(now + offset);
    case 1: {
      const year = 2000 + (readUInt(buf, 5, 0) % 41);
      const month = buf.length > 9 ? buf[9] % 12 : 1;
      const day = 28 + (buf.length > 10 ? buf[10] % 4 : 0);
      const hour = buf.length > 11 ? buf[11] % 24 : 12;
      return new Date(year, month, day, hour, 30, 0, 0);
    }
    case 2: {
      const year = 1996 + (readUInt(buf, 5, 0) % 48);
      const leapYear = year - (year % 4);
      const hour = buf.length > 9 ? buf[9] % 24 : 12;
      return new Date(leapYear, 1, 29, hour, 0, 0, 0);
    }
    case 3:
      return new Date(0 + offset);
    case 4:
      return new Date(-2208988800000 + offset);
    case 5:
      return new Date(1615687199000 + (offset % 172800000));
    default:
      return new Date(1636243199000 + (offset % 172800000));
  }
}

export function weightedParseInput(buf) {
  const mode = buf.length === 0 ? 0 : buf[0] % 8;
  const year = 1990 + (readUInt(buf, 1, 0) % 80);
  const month = (buf.length > 5 ? buf[5] : 0) % 12;
  const day = 1 + ((buf.length > 6 ? buf[6] : 0) % 31);
  const hour = (buf.length > 7 ? buf[7] : 0) % 24;
  const minute = (buf.length > 8 ? buf[8] : 0) % 60;
  const second = (buf.length > 9 ? buf[9] : 0) % 60;
  const ms = readUInt(buf, 10, 0) % 1000;
  const month1 = month + 1;
  switch (mode) {
    case 0:
      return buf.toString("utf-8");
    case 1:
      return `${String(year).padStart(4, "0")}-${pad2(month1)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}.${pad3(ms)}`;
    case 2:
      return `${String(year).padStart(4, "0")}-${pad2(month1)}-${pad2(28 + (day % 4))}`;
    case 3: {
      const leapYear = year + ((4 - (year % 4)) % 4);
      return `${String(leapYear).padStart(4, "0")}-02-${pad2(28 + (day % 2))}`;
    }
    case 4:
      return `not-a-date-${year}-${month1}-${day}`;
    case 5:
      return `invalid ${readUInt(buf, 1, 0)}`;
    case 6:
      return `++++${String(year).padStart(4, "0")}`;
    default:
      return `NaN-${year}-${month1}-${day}`;
  }
}

const TZS = [
  "UTC",
  "Asia/Tokyo",
  "America/New_York",
  "Europe/London",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Asia/Shanghai",
  "Europe/Berlin",
];

export function applyRandomTZ(buf) {
  const idx = buf.length > 0 ? (buf[0] & 0xff) % TZS.length : 0;
  const tz = TZS[idx];
  if (process.env.TZ !== tz) {
    process.env.TZ = tz;
  }
}

# mmntjs-timezone

Drop-in replacement for `moment-timezone`.

## Architecture

mmntjs-timezone is moving toward a compatibility-first architecture:

- Moment Timezone compatible packed-data APIs remain the public boundary
- runtime-loaded zones/links/countries are stored in an internal registry
- built-in IANA zone fallback currently still uses `Intl` until bundled authoritative data lands
- the long-term target is full tzdata-backed compatibility with lazy decode and compact storage

```
moment-timezone          mmntjs-timezone
     │                        │
     ├─ packed tzdb      ──   Intl.DateTimeFormat
     ├─ add/link data    ──   Intl.supportedValuesOf
     ├─ zone().abbr()    ──   timeZoneName: "short"
     └─ zone().offset()  ──   formatToParts → UTC comparison
```

## Behavioral Compatibility

| Feature | Status | Notes |
|---------|--------|-------|
| `moment.tz(input, zone)` | ✅ | Parse wall-clock in zone |
| `moment.tz(input, format, zone)` | ✅ | Parse with format in zone |
| `moment.tz(input, format, strict, zone)` | ✅ | Strict format dispatch |
| `moment(ts).tz(zone)` | ✅ | Convert instant to zone |
| `moment.utc(ts).tz(zone)` | ✅ | Convert UTC to zone |
| `moment.parseZone(s).tz(zone)` | ✅ | Convert parsed offset to zone |
| `moment.tz().format("z")` | ✅ | Timezone abbreviation |
| `moment.tz().format("Z")` | ✅ | Offset display |
| `moment.tz().utcOffset()` | ✅ | Numeric offset |
| `moment.tz().zoneAbbr()` | ✅ | Abbreviation API |
| `moment.tz().zoneName()` | ✅ | Long zone name API |
| `moment.tz.zone(name)` | ✅ | Zone object API |
| `moment.tz.names()` | ✅ | List all zone names |
| `moment.tz.guess()` | ✅ | Runtime timezone detection |
| `moment.tz.setDefault(z)` | ⚠️ Partial | Stores zone name; apply requires core changes |
| DST spring-forward | ✅ | Adjusted forward by 1h |
| DST fall-back | ✅ | First-occurrence (DST side) |
| `moment.tz(input, zone).valueOf()` | ✅ | Matches moment-timezone |
| `zone.abbr(ts)` | ✅ | Matches moment-timezone |
| `zone.offset(ts)` | ✅ | Matches moment-timezone |
| `zone.utcOffset(ts)` | ✅ | Matches moment-timezone |

### Oracle verification

All behavioral tests compare mmntjs-timezone output against moment-timezone.
Hand-written expected strings are NOT used for timezone-specific values.

### Deterministic

- Fixed random seed for property tests
- Cached `Intl.DateTimeFormat` per timezone
- Offset cache uses `Math.floor(timestamp / 1000)` — deterministic per-second
- All tests pass across 6 timezone environments (UTC, America/New_York, Europe/Berlin, Asia/Tokyo, Australia/Sydney, America/Los_Angeles)

## Current Status

The package now exposes the core packed-data compatibility APIs and preloads bundled authoritative tzdata generated from `moment-timezone` at build time:

- `moment.tz.add(data)`
- `moment.tz.link(links)`
- `moment.tz.load(bundle)`
- `moment.tz.unpack(data)`
- `moment.tz.unpackBase60(input)`
- `moment.tz.countries()`
- `moment.tz.zonesForCountry(code)`

Current limitation:

- internal storage still uses unpacked JS arrays/objects rather than the planned compact typed-array / lazy-decode representation

### Intl-backed abbreviation limitations

`zone.abbr()` uses `Intl.DateTimeFormat` with `timeZoneName: "short"`. This differs from moment-timezone's packed tzdb:

- **Historical abbreviations**: Intl may not know pre-1970 abbreviations (e.g., "BST" for pre-WW2 London). The oracle tests in `zone-object.test.ts` verify this for epoch=0.
- **Generic vs standard/daylight**: Some zones return generic "CT" or "MT" instead of "CST"/"CDT" or "EST"/"EDT". `tryLocaleAbbr()` filters out non-standard results via heuristic (2-5 uppercase letters, no "GMT" prefix).
- **Known overrides**: Zones like `Asia/Taipei`, `Africa/Cairo` use `KNOWN_ABBR` table (line 217) where Intl doesn't provide a short name.
- **Fallback**: When Intl fails to produce a short name, the abbreviation is synthesized as `GMT{±HHMM}` (e.g., "GMT+0530" for Asia/Kolkata).
- **Locale probing**: Multiple locales (`en-US`, `ja-JP`, `zh-CN`, etc.) are tried since different locales sometimes yield a short name where others produce a long name. The winning locale is cached per zone.

Abbreviation behavior is oracle-tested against moment-timezone in `regression.test.ts` (including DST transitions and cache ordering).

- **Default timezone**: `moment.tz.setDefault()` stores the zone name. Full integration (making `moment()` respect the default) requires changes to the mmntjs core. The current behavior is:
  - `moment.defaultZone` is set
  - `moment.tz(explicit, zone)` still uses the explicit zone
  - `moment.utc()` is unaffected
  - `moment()` does NOT automatically create in the default zone

## Testing

```bash
# Run all tests
bun test

# Run across 6 timezones
bash ../../scripts/run-timezone-tests.sh

# Run property tests
bun test test/property.test.ts
bun test test/properties-intensive.test.ts
```

## License

MIT

## Bundle Size

Current measured outputs from this repo's build artifacts.

### Full data (all historical zones)

| | raw | gzip |
|---|---|---|
| `builtin-data.generated.ts` | 293KB | 32.1KB |
| `mmntjs-timezone/index.js` (ESM dist) | **318KB** | **39.0KB** |
| bundled browser entry importing `mmntjs-timezone` | **477KB** | **81.1KB** |

### 1970–2030 subset

| | raw | gzip |
|---|---|---|
| `mmntjs-timezone/1970-2030.js` (ESM dist) | **94.7KB** | **25.3KB** |

### Logic only (no tzdata, load-your-own)

| | raw | gzip |
|---|---|---|
| `mmntjs-timezone/logic.js` (ESM dist) | **30.0KB** | **7.3KB** |

The full, 1970–2030, and 10-year-range entries all use the same packed blob format generated from the upstream `moment-timezone` npm package at build time. Dist outputs stay relatively compact because the zone blob remains packed until first access, while bundled browser entries grow further because they inline both core and timezone code together.

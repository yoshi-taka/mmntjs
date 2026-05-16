# mmntjs-timezone

Drop-in replacement for `moment-timezone` — powered by native Intl API.

## Architecture

mmntjs-timezone is a **thin compatibility layer** over the native `Intl.DateTimeFormat` API.

It does NOT bundle the IANA timezone database. All timezone data comes from the runtime.

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

## Intentional Compatibility Limits

These APIs exist as **no-op compatibility shims** and do NOT provide full drop-in behavior:

| API | Behavior | Rationale |
|-----|----------|-----------|
| `moment.tz.add(data)` | No-op (warns via console) | Timezone data comes from runtime Intl, not packed tzdb |
| `moment.tz.link(links)` | No-op | Zone aliases use Intl's resolution |
| `moment.tz.countries()` | Returns `[]` | Country data requires external data source |
| `moment.tz.zonesForCountry(code)` | Returns `[]` | Country → zone mapping requires external data |

### Why not full parity?

- **No packed tzdb**: moment-timezone bundles the IANA timezone database (~35KB gzipped). mmntjs-timezone relies on the host environment's `Intl` support. This means:
  - Smaller bundle size
  - Always up-to-date with the OS timezone data
  - No data loading step
  - Some DST transition edge cases may differ from moment-timezone (the IANA database has exact transition rules; Intl resolves transitions at the API level)

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

# mmntjs-timezone Compatibility-First Architecture

## Current Architecture Risks

- The current `packages/timezone` implementation is `Intl`-backed and therefore cannot be the authoritative source of truth for exact Moment Timezone compatibility.
- `moment.tz.add()` is currently a no-op, `moment.tz.link()` is currently a no-op, and `countries()` / `zonesForCountry()` are currently empty. That breaks real Moment Timezone API compatibility.
- Runtime `Intl` probing makes behavior depend on host tzdata version, alias resolution, abbreviation support, and browser/OS differences.
- Historical correctness is not stable under `Intl` because pre-1970 transitions, abbreviations, and legacy links are not guaranteed to match Moment Timezone.
- The current approach pays repeated runtime costs in `toLocaleString()` / `DateTimeFormat` setup rather than using compact authoritative transition data.
- JS object and `Map` overhead amplifies memory use compared with packed transition tables and typed arrays.

## Safe Optimizations

These optimizations preserve exact compatibility while reducing bundle cost, parse/eval overhead, memory, or startup work.

### 1. Precompiled authoritative tzdata blob

- Description: Build from full Moment Timezone compatible packed data at publish time, then emit a compact runtime blob rather than a large decoded JS object graph.
- Expected bundle impact: Large reduction in parse/eval cost, moderate reduction in minified size.
- Runtime impact: Faster startup, less GC pressure.
- Complexity: Medium.
- Compatibility risk: Very low if the build step preserves packed semantics exactly.

### 2. Lazy decode per canonical zone

- Description: Keep zone metadata resident, but decode transition tables only when a zone is actually used.
- Expected bundle impact: Neutral.
- Runtime impact: Much lower startup cost and lower steady-state memory when only a small subset of zones is used.
- Complexity: Medium.
- Compatibility risk: Very low if public APIs remain synchronous.

### 3. Alias/link indirection instead of duplicated zone payloads

- Description: Represent `link()` aliases and bundled aliases as names pointing at a canonical zone payload.
- Expected bundle impact: Medium reduction.
- Runtime impact: Lower memory use with one extra pointer hop.
- Complexity: Low.
- Compatibility risk: Very low if alias names still exist as first-class public keys.

### 4. Typed array decoded layout

- Description: Store decoded `untils`, `offsets`, and abbreviation indices in typed arrays instead of arrays of JS objects.
- Expected bundle impact: Small direct bundle win, large runtime heap win.
- Runtime impact: Faster binary search, lower per-zone heap overhead, less GC churn.
- Complexity: Medium.
- Compatibility risk: Very low.

### 5. Delta encoding of transitions in the compiled blob

- Description: Store transition instants as deltas and offsets/abbr indices as compact integer streams.
- Expected bundle impact: Medium to large reduction depending on encoding.
- Runtime impact: Small one-time decode cost on first zone use.
- Complexity: Medium.
- Compatibility risk: Very low if decode is lossless.

### 6. String interning

- Description: Intern zone names, abbreviations, country codes, and repeated metadata strings into a shared table.
- Expected bundle impact: Small to medium reduction.
- Runtime impact: Lower retained heap and fewer duplicate strings.
- Complexity: Low.
- Compatibility risk: Very low.

### 7. Split country metadata from transition payloads

- Description: Keep `countries()` / `zonesForCountry()` metadata in a separate compact index so apps that never call those APIs do not pay to decode them.
- Expected bundle impact: Neutral.
- Runtime impact: Lower cold-start work.
- Complexity: Low.
- Compatibility risk: Very low.

### 8. Preserve public `unpack()` and `unpackBase60()` while bypassing them internally on startup

- Description: Keep the compat API surface, but do not route bundled data through string unpacking on import.
- Expected bundle impact: Neutral.
- Runtime impact: Lower startup work.
- Complexity: Low.
- Compatibility risk: Very low.

### 9. Small decode/result caches near transition lookups

- Description: Cache decoded canonical zones permanently and optionally cache hot parse decisions near DST boundaries.
- Expected bundle impact: None.
- Runtime impact: Better steady-state latency for repeated formatting/parsing.
- Complexity: Low.
- Compatibility risk: Very low.

### 10. Optional multi-entry distribution, but sync full-data default

- Description: Make the default package fully compatible and synchronous, while allowing optional pre-split data bundles for advanced consumers.
- Expected bundle impact: Better consumer choice without weakening default behavior.
- Runtime impact: Better app-level tradeoffs when explicitly chosen.
- Complexity: Medium.
- Compatibility risk: Low if the default import remains full parity.

## Dangerous Optimizations

### Using `Intl` as the source of truth

This breaks exact compatibility because the host environment may ship different tzdata versions, different aliases, different historical abbreviations, and different locale behavior. `Intl` can be an accelerator or validator, but not the authoritative offset engine.

### Truncating timezone history

Dropping old transitions or limiting to modern ranges breaks historical dashboards, replay systems, archived business records, and any app expecting Moment Timezone parity on old timestamps.

### Replacing exact transition data with algorithmic DST rules

Many zones changed base offsets, DST observance, abbreviations, or political boundaries. Exact historical behavior cannot be reconstructed safely from a generic rules engine.

### Canonicalizing aliases away

Legacy names such as `US/Eastern` matter for ecosystem compatibility. Removing them or exposing only canonical zones breaks `zone()`, `names()`, config files, stored user preferences, and runtime `link()` behavior.

### Synthesizing abbreviations from numeric offsets only

Returning only `GMT+/-HH:mm` or similar strings breaks formatting compatibility, dashboards, snapshot tests, and public APIs such as `abbr()` / `zoneAbbr()`.

### Async zone loading behind synchronous APIs

Moment Timezone APIs are synchronous. Hidden async loading changes failure modes and forces semantic changes in `moment.tz()`, `moment.tz.zone()`, `countries()`, and `zonesForCountry()`.

### Minute-only offset storage

Some historical tzdata uses sub-minute offsets. Rounding those offsets breaks exact formatting, parsing, and instant mapping.

### Deduplicating by current offset only

Gap/fold parsing semantics depend on adjacent transitions, not only the active offset. Offset-only dedup loses ambiguity behavior.

### Omitting country metadata

This looks like an easy bundle win but breaks public API compatibility and ecosystem consumers that populate zone pickers or dashboards from `countries()` and `zonesForCountry()`.

## Recommended Internal Data Model

### 1. Authoritative registry layers

- `packedRegistry`: always-resident metadata keyed by public zone name.
- `canonicalRegistry`: maps canonical zone ids to compact transition payload descriptors.
- `linkRegistry`: maps alias name ids to canonical zone ids.
- `countryRegistry`: compact country metadata loaded separately from transitions.

### 2. Public name table

Use a single interned string table for:

- zone names
- abbreviations
- country codes
- optional long names or metadata fields if needed later

Each zone record stores only numeric ids into that table.

### 3. Packed zone record

Suggested resident structure:

```ts
type PackedZoneRecord = {
  nameId: number;
  canonicalId: number;
  blobOffset: number;
  blobLength: number;
  population?: number;
};
```

Alias zones point to the same `canonicalId` but retain their own `nameId`.

### 4. Decoded canonical payload

Suggested decoded structure:

```ts
type DecodedZone = {
  untilsMs: Float64Array;
  offsetsSec: Int32Array;
  abbrIds: Uint16Array | Uint32Array;
};
```

Notes:

- Store offsets in seconds, not minutes, to preserve historical sub-minute correctness.
- `untilsMs` should preserve the exact Moment Timezone transition semantics.
- `abbrIds` index into the global string table.

### 5. Zone wrapper objects

`moment.tz.zone(name)` should return a lightweight wrapper that exposes the public API but resolves through shared canonical decoded data.

Suggested wrapper shape:

```ts
type ZoneWrapper = {
  name: string;
  abbr(ts: number): string;
  utcOffset(ts: number): number;
  offset(ts: number): number;
  parse(ts: number): number;
};
```

The wrapper itself should stay small and avoid embedding duplicate arrays.

### 6. Country metadata layout

Suggested structure:

```ts
type CountryIndex = {
  countries: string[];
  countryZoneStarts: Uint32Array;
  countryZoneCounts: Uint16Array;
  zoneIds: Uint32Array;
};
```

This preserves synchronous `countries()` / `zonesForCountry()` while keeping country payloads compact.

### 7. Runtime mutation support

`moment.tz.add()` and `moment.tz.link()` must remain first-class mutating operations.

- Runtime-added zones should be converted into the same packed/decoded internal model.
- Runtime-added links should update the alias registry immediately.
- `names()`, `zone()`, `countries()`, and `zonesForCountry()` should observe updates just as Moment Timezone does.

## Loading Strategy

### Default behavior

- The default `mmntjs-timezone` entry should be synchronous and fully data-complete.
- Import should register the full zone/link/name index and version metadata.
- Import should not eagerly decode every zone.

### Startup path

On import, do only this work:

- load `version` and `dataVersion`
- register packed zone name index
- register link/alias index
- register country index headers
- initialize empty decode caches

Do not do this on import:

- unpack every packed zone string
- build JS arrays for every transition table
- create zone wrapper instances for every name

### First-use decode path

On first `zone(name)` or `tz(name)` access:

- resolve alias to canonical id
- decode the canonical payload from the blob if absent
- materialize or reuse a tiny wrapper for the requested public name
- cache both the canonical payload and the wrapper

### Cache behavior

- Keep packed metadata always resident.
- Keep decoded canonical payloads cached after use.
- Optionally use LRU only if memory pressure evidence justifies it.
- Cache zone wrappers by public name so aliases preserve identity expectations.

### Regional chunking

Regional chunking is safe only as an explicit distribution choice, not as implicit default behavior.

Recommended distribution model:

- `mmntjs-timezone`: full bundled data, sync, compatibility-first default
- `mmntjs-timezone/data/*`: optional prebuilt region/full blobs for advanced users
- `mmntjs-timezone/runtime`: optional runtime-only loader for apps that explicitly manage data

The default import must remain fully compatible and must not depend on async fetches.

## Benchmark Strategy

### Bundle size

Measure:

- raw emitted bytes
- minified bytes
- gzip bytes
- brotli bytes

Compare:

- current `Intl` implementation
- upstream `moment-timezone`
- proposed compiled-blob implementation

### Parse/eval time

Measure:

- import/require wall time in Node
- browser parse + compile time
- time to first `moment.tz.version`
- time to first `moment.tz.zone("America/New_York")`

### Cold startup

Measure:

- import only
- import + first names lookup
- import + first parse-in-zone call
- import + first DST-boundary parse

### Memory usage

Measure retained heap after:

- import
- `names()`
- first zone decode
- decoding 10 popular zones
- decoding 100 zones
- repeated parse/format loops near transitions

### Lookup latency

Measure hot and cold timings for:

- `zone.utcOffset(ts)`
- `zone.abbr(ts)`
- `zone.parse(localTs)`
- `moment.tz(input, zone)`

### DST correctness cost

Measure separately around spring-forward and fall-back windows, since ambiguous and nonexistent local times exercise different logic paths.

## Differential Testing Strategy

### Version-locked oracle

- Compare against the exact upstream `moment-timezone` release matching bundled `version` and `dataVersion`.
- Fail builds on tzdata drift or public API drift.

### Random timestamp fuzzing

For many random `(zone, timestamp)` pairs, compare:

- `zone.abbr(ts)`
- `zone.utcOffset(ts)`
- `zone.offset(ts)`
- formatted `Z`, `ZZ`, `z`, `zz`
- `isDST()` where relevant

### DST boundary tests

For every selected high-risk zone, test timestamps before, at, and after each transition.

Include:

- spring-forward gap parsing
- fall-back fold parsing
- explicit offset disambiguation inside folds
- exact `valueOf()` and wall-clock field comparisons

### Historical transition tests

Include:

- pre-1970 timestamps
- zones with many political changes
- zones with sub-minute historical offsets
- zones with non-hour DST deltas

### Alias and link tests

Verify:

- built-in legacy aliases
- runtime `moment.tz.link()` aliases
- `zone(alias)` behavior
- `names()` inclusion and stability
- parse/format parity through aliases

### `add()` / `link()` / `unpack()` compat tests

Verify:

- packed string ingestion
- arrays of packed strings
- runtime-added zones become visible immediately
- `unpack()` output shape matches upstream
- `unpackBase60()` numeric decoding matches upstream exactly

### Country metadata tests

Verify:

- `countries()` parity
- `zonesForCountry(code)` parity
- ordering behavior if upstream ordering is observable

### Ambiguity and invalid-local-time tests

Verify exact Moment Timezone behavior for:

- ambiguous repeated local times
- nonexistent skipped local times
- any supported global ambiguity flags
- explicit-offset inputs inside DST folds

### Property and corpus testing

- random timestamp fuzzing across all bundled zones
- fixed regression corpus from known DST and history edge cases
- targeted corpora for aliases, country metadata, and runtime `add()` / `link()` mutations

## Recommended Direction

The safest architecture is not a smarter `Intl` layer. It is a compatibility-first data engine:

- full authoritative tzdata bundled by default
- compact compiled blob representation
- lazy per-zone decoding
- typed-array-backed canonical transition tables
- alias indirection instead of duplicate payloads
- exact preservation of Moment Timezone public APIs, including `add`, `link`, `zone`, `countries`, `zonesForCountry`, `unpack`, `unpackBase60`, `version`, and `dataVersion`

Priority order should remain:

1. correctness and Moment Timezone parity
2. runtime memory and startup efficiency
3. bundle size

If an optimization weakens synchronous API compatibility or exact historical transition behavior, it should be rejected.

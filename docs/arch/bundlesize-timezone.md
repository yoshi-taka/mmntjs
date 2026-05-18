# Bundle Size Optimization: Timezone Data

All techniques are **lossless**: no public API changes, all tests pass, and every zone is reproduced exactly.

## Final Sizes

| Target | Before | After | Reduction |
|--------|-------:|------:|----------:|
| `builtin-data.generated.ts` raw | 711 KB | 293 KB | **-59%** |
| `dist/index.js` raw | 621 KB | 316 KB | **-49%** |
| `dist/index.js` gzip | 40.7 KB | 38.1 KB | **-6.2%** |
| `dist/index.js` brotli | 27.9 KB | 30.2 KB | +8% (see below) |

## Techniques

### 1. Name Dictionary Encoding (commit `44d8f761`)

**File**: `scripts/generate-timezone-data.ts`
**Method**: Replace long zone names with short base-60 numeric IDs.

- Zone names (e.g. `America/New_York`, 14 chars) → `2O` (2 chars)
- `namesBlob` (`N`) stores the `index → name` mapping
- All zone names in zonesBlob, linksBlob, and countriesBlob are encoded
- Runtime `ensureIndexBuilt()` reverses the IDs back to names before materializing

### 2. Permutation-Group Index Codec (commit `9f949083`)

**Files**: `scripts/tz-codec.ts`, `install-core.ts`, `install.ts`
**Method**: Compress DST transition index sequences using run-length encoding over permutation orbits.

Zone index fields (e.g. `0121212121...`) are mostly alternating DST patterns decomposed into runs:

| Run type | Control char | Format | Example |
|----------|-------------|--------|---------|
| pair-repeat | `^` | `^abN` | `12` repeated 62 times = 4 bytes |
| single-repeat | `~` | `~aN` | state `0` repeated 10 times = 3 bytes |
| increment | `@` | `@aN` | `0,1,2,3,...` = 3 bytes |

- Control characters (`^`, `~`, `@`) are chosen to avoid colliding with the base-62 alphabet
- Counts use a single base-62 char (0-61 = 1-62 reps), chained for longer runs
- Zones where encoding would bloat the data keep the plain format
- **Result**: indices 119 KB → 7 KB (**94.1% reduction**)
- **Decode speed**: ~5 ns/index, ~2 μs/zone
- The warm path is plain typed-array lookup after caching

### 3. Delta Frequency Dictionary (commit `db67beab`)

**Files**: `scripts/tz-dual-codec.ts`, `install-core.ts`, `install.ts`
**Method**: Tokenize all zone delta values into a global frequency dictionary.

- The first line of the zones blob stores the dictionary as `!D|{base60_val1} {base60_val2} ...`
- Each zone's deltas field is replaced with dictionary IDs (base-60 numbers)
- Frequent deltas get shorter IDs (most frequent `342660` = ID `0`)
- Dictionary entries: 1744 (unique values across 119K transitions)
- Runtime detects the `!D|` header line, parses `_deltaDict`, and does one dictionary lookup in `unpack()`
- **Result**: deltas 562 KB → 256 KB (**54.4% reduction**)

### 4. Zone Sorting (commit `db67beab`)

**File**: `scripts/generate-timezone-data.ts`
**Method**: Sort zones by region → offset schema to improve compressibility.

- Primary key: region (`America/`, `Europe/`, etc.)
- Secondary key: offset string (a proxy for DST pattern)
- Helps gzip detect cross-zone patterns
- **Result**: gzip -2.5%, brotli -0.9%

## Combined Effect

```
raw:
original:      ━━━━━━━━━━━━━━━━━━━━━━━━ 711KB
+name dict:    ━━━━━━━━━━━━━━━━━━━━━━━━ 711KB (names moved outside blob)
+index codec:  ━━━━━━━━━━━━━━━━━━━━     599KB (-16%)
+delta dict:   ━━━━━━━━━━━━━━━━         293KB (-59%)
+sorted:       ━━━━━━━━━━━━━━━━         293KB (gzip only)

gzip:
original:      ━━━━━━━━━━━━━━━━━━━━━━ 34.8KB
+all:          ━━━━━━━━━━━━━━━━━━━━   31.8KB (-8.6%)
```

## Architecture Decisions

### Why keep per-zone row format
- `materializeZone()` slices and processes one zone row from the blob
- Keeping the per-row format means the index structure works as-is
- Full columnar storage would require rewriting `ensureIndexBuilt` and was not worth the trade-off

### Why delta dictionary only
- Deltas account for **96.2%** of the zone blob (562 KB / 584 KB)
- Dictionary encoding for abbrs+offsets would save at most ~6 KB at the cost of significant complexity
- Abbreviation-detection heuristics proved too fragile

### Why brotli regressed
- Original base-60 delta values (`1zb0 Op0 1zb0 Op0 ...`) mix letters and numbers, which fit brotli's context model well
- After dictionary encoding (`0 1 0 1 ...`), the values are purely numeric with less contextual diversity, reducing brotli efficiency
- **Trade-off**: gzip +6.2% improvement vs brotli +8% regression, with raw -59% reduction prioritized

## File Layout

| File | Role |
|------|------|
| `scripts/tz-codec.ts` | Permutation-group index codec encoder/decoder |
| `scripts/tz-dual-codec.ts` | Delta dictionary build/encode/decode |
| `scripts/generate-timezone-data.ts` | Build pipeline — applies all codecs in sequence |
| `packages/timezone/src/install-core.ts` | Runtime decoder (full bundle) |
| `packages/timezone/src/install.ts` | Runtime decoder (logic bundle) |

## Running

```sh
# Regenerate data (codec + dict + sort)
bun run scripts/generate-timezone-data.ts

# Build
cd packages/timezone && bun run build

# Test
TZ=UTC bun run test
TZ=Asia/Tokyo bun run test
```

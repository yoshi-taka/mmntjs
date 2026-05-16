# Type-Safety Improvements: Bundle Size Focus

## Evaluation of 8 Proposals

| # | Idea | Verdict | Bundle Δ (min) | Runtime Δ |
|---|------|---------|---------------|-----------|
| 1 | `normalizeUnitCode` returns `UnitCode`, never `undefined` | Already done (bb49d56) | — | — |
| 2 | Zero-runtime branded types | REJECTED | 0 B | 0 B |
| 3 | `InternalParsedData` variants | REJECTED | 0 B | 0 B |
| 4 | `StrictValidParsedData` after parse | REJECTED | 0 B | 0 B |
| 5 | Avoid TS enum | Already satisfied | — | — |
| 6 | Group `FormatToken` categories | REJECTED | 0 B | 0 B |
| 7 | **Consolidate alias lookup tables** | **IMPLEMENTED** | **-210 B** | **0 B** |
| 8 | Keep type-only changes in .ts | Already the case | — | — |

### Adopted: Consolidate `_aliases` + `_unitCodes` into single source of truth

**Problem**: Three parallel lookup tables with overlapping data:

| Table | Type | Size | Purpose |
|-------|------|------|---------|
| `_aliases` | `Record<UnitAlias, NormalizedUnit>` | 40 string→string | `normalizeUnits`, `units` export |
| `_nmap` | `Record<string, NormalizedUnit>` | 40 lowercase→string | Case-insensitive fallback for `normalizeUnits` |
| `_unitCodes` | `Record<NormalizedUnit, UnitCode>` | 16 string→number | Bridge between `_aliases` and `_codeAliases` |
| `_codeAliases` | `Record<string, UnitCode>` | 40 string→number | `normalizeUnitCode` exact lookup |
| `_codeNmap` | `Record<string, UnitCode>` | 40 string→number | `normalizeUnitCode` case-insensitive fallback |

The alias→name data appeared twice (as string in `_aliases`, as number in `_codeAliases`). The name→code bridge (`_unitCodes`) existed only to connect them.

**Solution**: Replace with a single array-of-tuples source + derived lookup tables:

```typescript
const _aliasCodePairs: [string, number][] = [
  ["Y", YEAR], ["y", YEAR], ["years", YEAR], ["year", YEAR],
  // ... 40 entries total
];
```

From this single source, three tables are derived at init:
- `_codeAliases` (exact alias→code)
- `_codeNmap` (lowercased alias→code)
- `units` (public export, alias→name, via `_unitName` lookup)

`normalizeUnits` no longer has its own string→string table — it delegates to `normalizeUnitCode` + `_unitName` array indexing.

<table>
<tr><th>Before</th><th>After</th></tr>
<tr><td>

```typescript
// Two parallel lookups:
_aliases[unit] ?? _nmap[unit.toLowerCase()]
```
</td><td>

```typescript
// One lookup + array index:
normalizeUnitCode(unit);
_unitName[code]
```
</td></tr>
</table>

### Bundle impact

| Bundle | Before (82c24c7) | After | Delta |
|--------|-----------------|-------|-------|
| `dist/index.js` | 287,705 B | 287,984 B | **+279 B (+0.10%)** |
| `dist/lite.js` | 84,675 B | 84,949 B | **+274 B (+0.32%)** |
| `dist/mmntjs.min.js` | 142,353 B | 142,143 B | **-210 B (-0.15%)** |

The unbundled files grew because the array-of-tuples notation has more characters per entry than the object-literal notation. The minified bundle shrunk because tuple notation compresses better (brackets and commas compress more aggressively than object keys).

### Benchmark

No measurable change across all benchmark cases. `normalizeUnits` is only called from getter/setter methods (not hot paths), and the change adds one function call + one array lookup vs two object lookups — both O(1) and within noise.

---

## Rejected Ideas

### 2. Zero-runtime branded types (EpochMs, DurationMs, UnitMs, MonthIndex, NormalizedUnitCode)

`types.ts:271-275` already has `NormalizedUnitBrand` and `UnitAliasBrand` declared with `unique symbol`. They emit zero JS. But they're also **never used** anywhere in the codebase. Adding more would follow the same unused pattern.

Branded types for `EpochMs`/`DurationMs` would require casts at every arithmetic expression boundary (`_t += n * DAY_MS` would become `_t = (_t + n * DAY_MS) as EpochMs`). This adds type noise without catching real bugs — the unit arithmetic is structurally simple.

`MonthIndex` for `daysInMonthFast`'s month parameter: the parameter name `month0to11` already documents the contract. All 6 callers already pass normalized months. No real bugs to catch.

**Verdict**: All branded types rejected — zero JS impact either way, but adding them adds type noise and maintenance burden.

### 3. InternalParsedData variants / 4. StrictValidParsedData

`InternalParsedData` has ~40 optional fields. Splitting into pre-validation and post-validation types would require a runtime discriminator (union discriminant field) or type assertions everywhere. The parse flow already has clear boundaries:
- `parseString` → returns `ParsedData` with optional fields
- `createMomentFromParsed` → validates and fills defaults
- After validation, the Moment constructor has all fields required

Adding `StrictValidParsedData` as a type-only wrapper would require casting at the boundary — which is what the existing code already does with `as unknown as ParsedData` casts. No runtime savings.

**Verdict**: Rejected — no bundle impact, adds type complexity.

### 5. TS enum avoidance

`UnitCode` is already a union type `0 | 1 | ... | 15 | -1`, not a TS `enum`. TS enums emit JS objects; union types emit nothing. No change needed.

### 6. FormatToken categories

`types.ts:99` has `FormatToken = "YYYY" | "YY" | ...` — a 60-entry union type for display formatting tokens. `parse.ts:1992` has `interface FormatToken { type, name, value }` — a runtime interface for parse token objects. These are different things with the same name in different domains.

Splitting into categories (DateToken, TimeToken, ZoneToken, etc.) would be type-only and emit zero JS. But it wouldn't enable any runtime branch removal or bundle reduction.

**Verdict**: Rejected — zero runtime benefit.

### 8. Keeping type-only changes in .ts types

All type definitions in `types.ts` already emit zero JS. The `declare const __normalizedUnit: unique symbol` pattern in `types.ts:271-275` is already the correct zero-cost approach.

---

## Conclusion

**One change adopted**: Consolidated `_aliases` + `_nmap` + `_unitCodes` into `_aliasCodePairs` array-of-tuples. This removes the duplicated alias→name→code bridge and simplifies the data flow:

```
Before:  _aliases → _unitCodes → _codeAliases
         (string)    (string→code)

After:   _aliasCodePairs → _codeAliases
         (tuples)          _codeNmap
                           units
```

| Metric | Δ |
|--------|---|
| Source lines | -0 (same data, different format) |
| `dist/index.js` | +279 B (+0.10%) — unbundled |
| `dist/mmntjs.min.js` | **-210 B (-0.15%)** — production bundle |
| Benchmark | No change |

All other proposals rejected — they either emit zero JS already, add type noise without runtime benefit, or would increase the bundle.

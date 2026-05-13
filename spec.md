# moment2 — Specification

## Package Name

`mmntjs`

Part of the `@compat` family — drop-in replacements for legacy libraries that guide users toward modern alternatives.

```
mmntjs   → moment    → Temporal API
@compat/lodash2   → lodash    → es-toolkit / native
@compat/express2  → express   → fastify / hono
```

---

## Concept

Drop-in replacement for moment.js.  
Not a destination — a migration path to Temporal API.

```
moment
  ↓ codemod (one command)
moment2 (works, warns, guides)
  ↓ trackUsage + toTemporal()
Temporal API
```

---

## Goals

- People who can't escape moment can drop this in with zero code changes  
- Smaller and at least as fast as moment  
- Every usage nudges toward Temporal  

---

## Requirements

### API

| Item             | Detail                                        |
|------------------|-----------------------------------------------|
| Coverage         | 100% including deprecated APIs                |
| Mutable behavior | Emulated via Proxy                            |
| Plugin system    | `moment.fn` compatible                        |
| TypeScript       | Bundled `.d.ts` (based on `@types/moment`, MIT) |

---

### Distribution

| Format | Detail |
|--------|--------|
| CJS    | `dist/index.cjs` |
| ESM    | `dist/index.mjs` |
| UMD    | `dist/moment2.min.js` (CDN, `window.moment2`) |

- Zero-dependency  
- `date-fns` etc. NOT included  
- Pure scratch implementation  

---

### Runtime Support

| Target  | Version |
|---------|--------|
| Node.js | >= 14  |
| Browser | All modern browsers (IE11 excluded) |

---

### Internal Implementation

- Scratch implementation using native `Date`  
- `@js-temporal/polyfill` used internally at build time (bundled, zero-dep preserved)  
- Temporal polyfill bundled into `dist`  

---

### Packages

| Package                     | Content                         |
|----------------------------|---------------------------------|
| `mmntjs`          | Core. Drop-in for `moment`      |
| `mmntjs-timezone`          | Drop-in for `moment-timezone`   |

---

### Locale

- Default: `en` only  
- Others: `mmntjs/locale/ja` pattern (same as moment)  
- Locale files are separate — only what you load is included  

## TypeScript Types

Base: `@types/moment` copied as-is (MIT).  
Only moment2-specific APIs are added on top:

```ts
interface Moment {
  toTemporal(): Temporal.PlainDate | Temporal.ZonedDateTime
}

interface MomentStatic {
  fromTemporal(t: Temporal.PlainDate | Temporal.ZonedDateTime): Moment
  config(opts: Moment2Config): void
  report(): Moment2UsageReport
}

interface Moment2Config {
  deprecationWarnings?: boolean
  trackUsage?: boolean
}

interface Moment2UsageReport {
  apis: string[]
  temporalEquivalents: Record<string, string | null>
}
```

No strictness added beyond `@types/moment` — existing code must not break.

---

### Static properties to implement

| Property                    | Added in | Notes |
|----------------------------|----------|-------|
| `moment.HTML5_FMT.*`       | 2.20.0   | constants (DATETIME_LOCAL, DATE, TIME, etc.) |
| `moment.ISO_8601`          | 2.7.0    | Special format constant |
| `moment.RFC_2822`          | 2.18.0   | Special format constant |
| `moment.parseTwoDigitYear` | -        | Overridable function, Proxy must intercept assignment |
| `moment.now`               | -        | Overridable function for time mocking in tests |
| `moment.fn`                | -        | Prototype for plugins |
| `moment.version`           | -        | Must return `"2.30.1"` for compatibility |

---

### Known plugins (must work via `moment.fn`)

Official plugins from momentjs.com/docs:

- `moment-range`
- `moment-business-days`
- `moment-duration-format`
- `moment-timezone` (→ `mmntjs-timezone`)
- `moment-recur`
- `moment-twitter`
- `moment-quarter`
- `moment-parseformat`
- `moment-round`
- `moment-transform`
- `moment-jalaali`
- `moment-hijri`
- `moment-isocalendar`

These plugins extend `moment.fn` — compatibility depends on Proxy correctly forwarding `moment.fn` property access and assignment.

---

## Temporal Bridge

```ts
// moment2 -> Temporal
moment2('2024-01-01').toTemporal()
// => Temporal.PlainDate | Temporal.ZonedDateTime

// Temporal -> moment2
moment2.fromTemporal(Temporal.Now.zonedDateTimeISO())
```

---

## Migration Tooling

### Warning mode (on by default)

```ts
moment2().add(1, 'day')

// console.warn:
// [moment2] mutable operation detected
// Temporal equivalent: Temporal.Now.plainDateISO().add({ days: 1 })
```

---


### Usage tracking

```ts
moment2.config({ trackUsage: true })
// ... run your app ...
moment2.report()
// => list of APIs used + Temporal migration table
```

---

### CLI migration check

```sh
npx mmntjs migrate --check

# Found 47 moment2 usages:
#  32 can be auto-migrated to Temporal
#  12 need manual review
#   3 no Temporal equivalent

npx mmntjs migrate --apply
```

---

## Risks

### Proxy overhead

- Proxy adds overhead on hot paths with heavy moment usage  
- Mitigation: bypass Proxy on `valueOf()` and other non-mutating hot paths  

---

### moment bug reproduction gaps

- Real-world code sometimes depends on moment’s bugs (e.g. specific `Invalid date` behavior)  
- Mitigation: moment’s test suite + oracle-based property tests catch most cases  
- Residual risk: undocumented bugs not covered by moment’s own tests  

---

### Type conflicts with `@types/moment`

- If both `moment2` and `@types/moment` are installed, type collision may occur  
- Mitigation: codemod removes `@types/moment` from devDependencies automatically  
- Document clearly in README  

---

### Third-party libraries with `moment` as peerDependency

- Libraries like `react-datepicker`, `ant-design`, etc. declare `peerDependencies: { "moment": "*" }`  
- Simply replacing moment with moment2 breaks these libraries  
- This is the most critical risk  

#### Solution: npm package aliasing

```json
{
  "dependencies": {
    "moment": "npm:mmntjs@^1.0.0"
  }
}
```

- `moment` name is preserved in node_modules resolution  
- peerDeps requiring `"moment"` are satisfied automatically  
- No import changes needed anywhere  
- Works with npm, yarn, pnpm, bun  

---

Codemod default behavior:  
Instead of rewriting imports, set the npm alias in `package.json`.  
Imports stay as `from 'moment'` — `mmntjs` is loaded transparently.

```json
{
  "dependencies": {
    "moment": "npm:mmntjs@^1.0.0"
  }
}
```

---

### Known libraries depending on moment

| Library             | Type                                   | Resolution                          |
|--------------------|----------------------------------------|-------------------------------------|
| `daterangepicker`  | `dependencies: moment ^2.9.0`          | npm alias handles automatically     |
| `fullcalendar` v4↓ | `dependencies: moment`                 | npm alias handles automatically     |
| `fullcalendar` v5+ | no moment dependency                   | no action needed                    |
| `react-datepicker` | optional moment support                | no action needed                    |
| `ant-design`       | optional moment support via `rc-picker`| npm alias handles automatically     |

npm alias is the correct solution for all of these — no special handling required.

---

### Two codemod modes

```sh
# Mode 1 (default): npm alias — zero code changes, peerDeps safe
npx mmntjs --mode=alias ./

# Mode 2: explicit rewrite — changes all imports to 'mmntjs'
npx mmntjs --mode=rewrite ./
```

---

### Regex-based codemod replacing comments

- Regex may replace `moment` inside comments or string literals  
- Mitigation: warn on suspicious matches, let user review  
- Full AST-based rewrite is an option for mode=rewrite  

---

### Parse leniency bugs (must reproduce)

moment’s parser is intentionally forgiving. Real-world code may silently depend on this:

```js
// Partial match — garbage after valid part is ignored
moment('2016 is a date', 'YYYY-MM-DD').isValid() // true — must reproduce

// Zero-padded vs not
moment('2024-1-1').isValid()   // true (lenient)
moment('2024-01-01').isValid() // true

// Month 0-indexed
moment({ month: 0 }).format('M') // "1" — January

// 2-digit year boundary (68/69 split)
moment('69', 'YY').year() // 1969
moment('68', 'YY').year() // 2068
// code depending on this boundary must not break

// Timezone-naive string parse — result depends on local TZ
moment('2024-01-01').utcOffset()
// → varies by environment (CI vs local may differ)
// property-based tests must run with fixed TZ: TZ=UTC
```

Property-based tests must set `TZ=UTC` to avoid environment-dependent failures.

---

### Proxy + Object.freeze / seal / preventExtensions

Real-world code occasionally freezes moment instances (e.g. in Redux state).

```js
const m = moment2('2024-01-01')
Object.freeze(m)

m.add(1, 'day')         // silently ignored — m unchanged (matches moment)
m.format('YYYY-MM-DD') // → "2024-01-01" (unchanged)
Object.isFrozen(m)     // → true
```

Proxy must handle all three:

| Operation                    | Behavior |
|-----------------------------|----------|
| `Object.freeze(m)`          | Proxy `set` trap detects frozen target, silently ignores writes (matches moment) |
| `Object.seal(m)`            | Same as freeze for mutation purposes |
| `Object.preventExtensions(m)` | Same |
| `Object.isFrozen(m)`        | Delegates to Proxy target |

Implementation:

```ts
set(target, prop, value) {
  if (Object.isFrozen(target)) return true // silent, matches moment behavior
  target[prop] = value
  return true
}
```

---

### Tree-shaking / side effects

`moment2(...)` call-style may be flagged as side-effectful by bundlers, preventing tree-shaking.

Mitigation:

- Add `"sideEffects": false` in `package.json`  
- Annotate pure functions with `/*#__PURE__*/`  

---

### Subpath exports compatibility

`moment2/locale/ja` requires explicit `exports` field in `package.json`.  
Older Node versions and bundlers may ignore `exports`.

Mitigation:

- Keep physical files at `dist/locale/ja.js` as fallback  
- Define both `exports` field and physical paths  

---


### moment.now() mocking

Common pattern in tests:

```js
moment.now = () => 1234567890000 // mock current time
```

Proxy on the static `moment2` function must intercept property assignment on the function itself.

```ts
// moment2 is a Proxy-wrapped function
// get/set traps on the function object handle moment.now overrides
```

---

### Circular dependencies in locale files

moment’s locale files reference the core. Design locale loading to avoid circular imports:

- Core has no knowledge of locales at build time  
- Locales call `moment2.defineLocale(...)` on load (same pattern as moment)  

---

### SSR / Edge Runtime

Next.js Edge Runtime and Cloudflare Workers restrict some globals.

- `Intl.DateTimeFormat` is available in both — no issue  
- `Date` is available — no issue  
- Proxy is available — no issue  

Scope: supported as long as user is not on Edge Runtime with moment (unlikely).

---

### Security (CVEs)

Known moment CVEs (ReDoS in date parsing etc.) will be fixed in moment2 as a natural consequence of scratch reimplementation.

- Not a stated goal, but a side effect  
- Will not be marketed as a security fix to avoid false confidence  

---

### Scoped package compatibility

npm scoped packages (`@compat/*`) require npm >= 2.7.0 (released 2015).  
Node >= 14 requirement implies npm is sufficiently modern — not a practical concern.

Edge case: private npm registries (Artifactory etc.) may need explicit scope registry config:

```
@compat:registry=https://registry.npmjs.org
```

This is out of scope for the codemod. Users must configure their registry manually.

---

## Codemod

Replaces all moment references with moment2. Handles aliases.

```sh
npx mmntjs ./
```

---

### Source code patterns

```js
import moment from 'moment'
const moment = require('moment')

import m from 'moment'
const m = require('moment')

import { utc } from 'moment'
```

---

### Build config patterns

```js
// webpack.config.js
resolve: { alias: { 'moment': 'mmntjs' } }

// vite.config.js
resolve: { alias: { 'moment': 'mmntjs' } }
```

---

### Test config patterns

```js
// jest.config.js
moduleNameMapper: { '^moment$': 'mmntjs' }
```

---

### TypeScript config patterns

```json
// tsconfig.json
{
  "paths": {
    "moment": ["./node_modules/mmntjs"]
  }
}
```

---


### Angular patterns

```json
// angular.json
{
  "scripts": [
    "node_modules/moment/moment.js"
  ]
}
```

↓

```json
{
  "scripts": [
    "node_modules/mmntjs/dist/moment2.min.js"
  ]
}
```

```js
// karma.conf.js
files: ['node_modules/moment/moment.js']
```

↓

```js
files: ['node_modules/mmntjs/dist/moment2.min.js']
```

---

### package.json patterns

```json
// dependencies / devDependencies / peerDependencies
{
  "moment": "^2.30.1"
}
```

↓

```json
{
  "mmntjs": "^1.0.0"
}
```

```json
// browser field
{
  "browser": {
    "moment": "./node_modules/mmntjs"
  }
}
```

```json
// scripts field (inline node -e usage)
{
  "scripts": {
    "check": "node -e \"require('moment').format()\""
  }
}
```

↓

```json
{
  "scripts": {
    "check": "node -e \"require('mmntjs').format()\""
  }
}
```

Regex core:

```
/from ['"]moment['"]|require\(['"]moment['"]\)/
```

---

### Bower patterns

```json
// bower.json
{
  "dependencies": {
    "moment": "^2.30.1"
  }
}
```

↓

```json
{
  "dependencies": {
    "mmntjs": "^1.0.0"
  }
}
```

---

### Require.js (AMD) patterns

```js
// requirejs.config
requirejs.config({
  packages: [{ name: 'moment', location: 'node_modules/moment', main: 'moment' }]
})
```

↓

```js
requirejs.config({
  packages: [{ name: 'moment', location: 'node_modules/mmntjs', main: 'dist/index' }]
})
```

```js
// define() calls — import pattern already covered
define(['moment'], function(moment) { ... })
define(['moment', 'moment/locale/de'], function(moment) { ... })

// locale path:
moment/locale/de → mmntjs/locale/de
```

---

### System.js patterns

```js
System.import('moment.js')
```

↓

```js
System.import('mmntjs')
```

```js
System.config({
  meta: { 'moment': { format: 'global' } }
})
```

↓

```js
System.config({
  meta: { 'mmntjs': { format: 'global' } }
})
```

---

## Parsing edge cases to reproduce

### Time-only input

```js
moment('13:30', 'HH:mm')
// → today's date + 13:30
// Same behavior as moment — no PlainTime concept
```

Warn toward Temporal:

```
[moment2] Time-only input detected.
For time without date, consider: Temporal.PlainTime.from('13:30')
```

---


### Default field filling

```js
moment({ hour: 15 })
// omitted fields default to:
// year/month/day → current date
// hour/minute/second/ms → 0 (minimum)

moment({ year: 2024 })
// → 2024-01-01 00:00:00.000
```

Exact defaulting behavior must match moment 2.30.1 — including edge cases like:

```js
moment([])        // → now (changed in 2.14.0 from start-of-today)
moment({})        // → now (same)
moment(undefined) // → now
```

---

### `moment.parseTwoDigitYear` default

```js
// default: year > 68 → 1900s, year <= 68 → 2000s
moment('69', 'YY').year() // 1969
moment('68', 'YY').year() // 2068
```

Overridable via Proxy:

```js
moment.parseTwoDigitYear = (str) => parseInt(str) + 2000
```

---

## Testing Strategy

All three layers use **moment (2.30.1) as the oracle**.

| Layer             | Oracle                 | Purpose |
|------------------|------------------------|---------|
| Official test suite | moment’s expected values (MIT, reused directly) | API coverage |
| Property-based (fast-check) | moment’s live output | Edge cases, auto-generated inputs |
| Mutation testing | moment’s live output | Validates test suite strength |

---

### Property-based example

```ts
fc.property(fc.date(), fc.integer(1, 365), (date, n) => {
  expect(moment2(date).add(n, 'days').format('YYYY-MM-DD'))
    .toBe(moment(date).add(n, 'days').format('YYYY-MM-DD'))
})
```

---

### Property-based input coverage

fast-check arbitraries to use as moment input — all compared against moment oracle:

```ts
// Boundary / degenerate values
fc.constantFrom(null, undefined, 0, '', NaN, Infinity, -Infinity, false, true)

// Strings
fc.string()               // arbitrary unicode
fc.fullUnicodeString()    // emoji, surrogates, RTL, zero-width
fc.constantFrom('', ' ', '\t', '\n', '\0')
fc.constantFrom('Invalid date', 'undefined', 'null', 'NaN')

// Numbers
fc.integer()
fc.float({ noNaN: false }) // includes NaN
fc.bigInt()                // should not crash

// Dates
fc.date()                                  // valid JS Date
fc.constantFrom(new Date(NaN))              // invalid Date
fc.constantFrom(new Date(0))                // Unix epoch
fc.constantFrom(new Date(8.64e15))          // max JS date
fc.constantFrom(new Date(-8.64e15))         // min JS date

// Arrays
fc.array(fc.integer(), { maxLength: 10 })
fc.constantFrom([], [undefined], [NaN], [2024, 13, 0]) // invalid month/day

// Objects
fc.record({
  year: fc.option(fc.integer()),
  month: fc.option(fc.integer({ min: -1, max: 13 })),
  day: fc.option(fc.integer({ min: -1, max: 32 })),
})
```

All of these must produce identical output (or identical invalidity) as moment 2.30.1.

---

### Mutation example

```
mutant: moment2 source modified (e.g. +1 → +2)
test:   moment2_mutant(input) != moment(input) → mutant killed
```

---

## Performance

- `format()`: cache compiled format strings  
- `parse()`: fast path for common formats (`YYYY-MM-DD`, ISO8601, etc.)  
- `valueOf()`: bypass Proxy on hot path  

Target: same or better than moment on common operations  

---

## Versioning

- Starts at `1.0.0` (independent from moment’s `2.30.1`)  
- Compatible with moment `2.30.1` (final version, maintenance ended Dec 2023)  
- npm: `mmntjs`  

---

## CI Matrix

Node versions: `14, 16, 18, 20, 22`  

---

## Implementation Approach

Reference moment’s source code for behavior and edge cases — but write all code from scratch.

Rationale:

- moment is MIT — referencing is fine  
- Copy no code, only consult for behavior verification  
- moment’s bugs must be reproduced (real-world code depends on them)  
- Test suite serves as the spec; source serves as the oracle for ambiguous behavior  

---

## Development Order

1. Repo init (`bun init`, tsconfig, build config)  
2. Copy moment’s official test suite (MIT, verbatim)  
3. Confirm all tests fail — this is the starting line  
4. Implement core APIs until tests pass one by one  
5. Add property-based tests (moment as oracle)  
6. Add mutation testing (moment as oracle)  
7. CJS + ESM + UMD build setup  
8. Locale files (`moment2/locale/xx`)  
9. Temporal bridge (`toTemporal`, `fromTemporal`)  
10. Migration tooling (warning mode, `trackUsage`, `report`)  
11. Codemod (`moment2-codemod`)  
12. `moment2-timezone`  

Progress metric: `X / ~10000 tests passing`  

---

## Migration Progress Tracking

### CLI stats

```sh
npx mmntjs stats ./src
```

```
moment usages remaining: 47

format(): 23
add():    12
diff():    8
other:     4

Temporal-ready: 32 (68%)
```

---

### Badge (auto-updated in CI)

```
![moment usages](https://img.shields.io/badge/moment_usages-47-yellow)
```

- CI runs `stats` and updates badge  
- Number decreasing over time = visible progress  
- Works as gamification for gradual migration  
- Copy-paste friendly — target users just paste the badge into README  

---
### CI compatibility check 
Detects CI config files and verifies compatibility:

| File                          | Check                                      |
|-------------------------------|-------------------------------------------|
| .github/workflows/*.yml       | node-version >= 14, test step detection   |
| .circleci/config.yml          | same                                      |
| Jenkinsfile                   | same                                      |
| .travis.yml                   | same                                      |

Outputs: “CI compatible” or lists issues.

---

### Local environment detection

`init` auto-detects:

| File              | Action                  |
|-------------------|------------------------|
| .nvmrc / .node-version | Warn if Node < 14 |
| bun.lock          | Use `bun install`      |
| yarn.lock         | Use `yarn install`     |
| pnpm-lock.yaml    | Use `pnpm install`     |
| package-lock.json | Use `npm install`      |

---

### Deploy environment detection

`audit` scans for deploy configs and warns on incompatibilities:

| File           | Check                     |
|----------------|---------------------------|
| Dockerfile     | FROM node:XX version >= 14 |
| Procfile       | Heroku - Node version check |
| serverless.yml | runtime version check     |
| vercel.json    | Node version check        |
| netlify.toml   | Node version check        |

---

### Migration report (copy-paste ready)

```sh
npx mmntjs report --output=markdown > MIGRATION.md
```

Output is a ready-to-paste document for PRs, Confluence, Jira, Slack:

```markdown
# moment → mmntjs Migration Report

## Current state

- moment usages: 47
- Confidence: 94%
- Known issues: 1
```

---

## Install

```sh
npx mmntjs init
```

---

## Issues

- src/store.ts:89: Object.freeze() on moment instance — requires fix

---

## Checklist

- [ ] audit passed  
- [ ] unit tests passing  
- [ ] reviewed by team  

---

## Audit Command

The core friction is fear: “will this break my app?”  
`audit` answers that question before the user commits to anything.

```sh
npx mmntjs audit ./src
```

AI-powered static analysis of all moment usages in the codebase.  
Reports confidence level and any known incompatibilities.

```
✓ 47 usages analyzed  
✓ All patterns recognized  
✓ No known incompatibilities detected  

Confidence: 94%

Issues found:
- src/store.ts:89 — Object.freeze() on moment instance (see docs)
```

Goal: user reads the output and decides to run `init` with confidence.  
No Temporal migration nudge here — just “safe to install or not”.



## Monorepo Support

`init` and `audit` detect monorepo structures and handle multiple `package.json` files.

| Tool            | Detection                         |
|-----------------|----------------------------------|
| npm workspaces  | `package.json` `workspaces` field |
| yarn workspaces | same                             |
| pnpm workspaces | `pnpm-workspace.yaml`            |
| Turborepo       | `turbo.json`                     |
| Nx              | `nx.json`                        |

Behavior:

- Scan all workspace packages for moment usage  
- Apply npm alias only to packages that use moment  
- Report per-package stats  

```sh
npx mmntjs audit ./
```

```
# packages/legacy-app — 47 usages, Confidence: 94%
# packages/new-app    — 0 usages, skipped
```

---

## Friction Reduction

### `init` command — single command setup

```sh
npx mmntjs init
```

Automatically:

1. Create a git checkpoint commit before making any changes (if git repo detected)  
2. Add npm alias to `package.json`: `"moment": "npm:mmntjs@^1.0.0"`  
3. Remove `@types/moment` from devDependencies  
4. Run install (`bun install` / `npm install` — auto-detected)  
5. Run unit tests to verify compatibility (see below)  
6. Output stats  

---

### Success output

```
✓ mmntjs loaded successfully
✓ 47 usages detected
✓ 0 breaking changes detected

Run: npx mmntjs stats for details
```

---

### Error output

```
✗ mmntjs detected incompatibility:
File: src/utils.ts:42
Issue: Object.freeze() on moment instance
Fix: remove freeze() or see https://...
```

---

## Unit test auto-detection

`init` runs unit tests automatically to verify compatibility.  
E2E / integration tests are skipped to avoid external dependencies.

---

### Script name heuristics

| Script name contains            | Action |
|--------------------------------|--------|
| `unit`, `ut`                   | Run    |
| `e2e`, `integration`, `cypress`, `playwright` | Skip   |
| `test` only                    | Skip with warning: "Found 'test' script but skipping to avoid side effects. Run manually." |

---

### Framework detection via devDependencies

| Package   | Run command                      |
|-----------|----------------------------------|
| `jest`    | `jest --testPathPattern=unit`    |
| `vitest`  | `vitest run`                    |
| `mocha`   | `mocha`                         |
| `jasmine` | `jasmine`                       |
| `qunit`   | `qunit`                         |
| `ava`     | `ava`                           |
| `tape`    | `tape test/*.js`                |
| `bun` (runtime) | `bun test`                |
| `lab`     | `lab`                           |
| `nodeunit`| `nodeunit test/`               |

Priority: scripts field first, then devDependencies detection.

---

### README (3 lines)

1. npx mmntjs init  
2. It works.  
3. Run stats to track migration progress.  

---

## Rollback

No dedicated rollback command. Git is assumed.

```sh
git revert  # or
git checkout package.json && bun install
```

Document this clearly in README. Users without git cannot use npx anyway.

---

## Audit report for team approval

```sh
npx mmntjs audit --output=markdown > AUDIT.md
```

Outputs a markdown report suitable for pasting into PRs, Jira tickets, or Slack.  
Answers “is it safe to install?” for the whole team, not just the engineer running it.

---

## Out of Scope

| Item                               | Reason |
|------------------------------------|--------|
| IE11                               | EOL 2022, no Proxy support |
| date-fns bundle                    | Behavioral differences, size increase. Scratch implementation chosen |
| Expose Temporal polyfill           | Internal use only |
| Security CVE fixes                 | Side effect of reimplementation, not a stated goal |
| Next.js Edge Runtime / Cloudflare Workers | Unlikely to use moment there |
| Rollup / esbuild externals codemod | Users at that level can migrate themselves |
| Renovate / Dependabot config       | moment is frozen at 2.30.1, no updates to worry about |
| Private npm registry auto-config   | Out of scope, manual setup required |
| Immutable-only variant             | Drop-in compatibility takes priority |
| Dedicated rollback command         | git revert is sufficient. Users without git cannot use npx anyway |
| Feature Flag support               | Both libraries loaded simultaneously — contradicts the “full switch” philosophy. Revisit if moment2 is proven to be significantly lighter than moment |
| ESLint plugin                      | Target users cannot configure ESLint plugins |

---

## Compatibility Badge

```
moment2 is 100% compatible with moment 2.30.1
```

Auto-generated in CI, embedded in README.

```
var/local/repos/moment2
```

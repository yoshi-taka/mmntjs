# @compat/moment2

Drop-in replacement for moment.js — a migration path to [Temporal API](https://tc39.es/proposal-temporal/).

```
moment
  ↓ `npx moment2 migrate`
@compat/moment2 (works, warns, guides)
  ↓ trackUsage + toTemporal()
Temporal API
```

## Install

```sh
bun add @compat/moment2
# or
npm install @compat/moment2
```

## Usage

```js
import moment from "@compat/moment2";

moment().format("YYYY-MM-DD");
moment("2024-01-01").add(1, "month").toDate();
moment.duration(2, "hours").humanize();
```

Advanced entry points:

```js
import moment from "@compat/moment2/full";
import coreMoment from "@compat/moment2/core";
```

- `@compat/moment2` keeps the compatibility entry
- `@compat/moment2/full` is the explicit full runtime entry
- `@compat/moment2/core` is the lighter entry without locale registry, migration, or Temporal registration

### Node (CJS)

```js
const moment = require("@compat/moment2");
```

### Browser (CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/@compat/moment2/dist/moment2.min.js"></script>
<script>
  moment2().format("LLLL");
</script>
```

### Locales

Import locale modules as side effects, same as moment.js:

```js
import "@compat/moment2/locale/ja";
import "@compat/moment2/locale/fr";

moment.locale("ja");
moment().format("LL"); // → "2024年1月1日"
```

136 locales available (all original moment.js locales).

### Timezone

```sh
bun add @compat/moment2-timezone
```

```js
import moment from "@compat/moment2";
import "@compat/moment2-timezone";

moment.tz("2024-01-01", "Asia/Tokyo").format();
```

Based on Intl API (no timezone data file — 445 zones supported).

## Drop-in Replacement

For existing moment projects, add an npm alias — no code changes needed:

```sh
# npm
npm install moment@npm:@compat/moment2

# yarn
yarn add moment@npm:@compat/moment2

# bun
bun add moment@npm:@compat/moment2
```

Then keep writing `import moment from "moment"` as before — it resolves to moment2.

### Migration: moment → moment2 → Temporal

```sh
# Check compatibility (dry run):
npx moment2 migrate --check ./src

# Apply automated migration:
npx moment2 migrate --apply ./src
```

```sh
# Audit current moment usage:
npx moment2 audit ./src

# Stats summary:
npx moment2 stats ./src

# Generate Temporal migration report:
npx moment2 report ./src
```

## CLI

```
moment2 migrate --check|--apply [dir]   Codemod: moment → moment2
moment2 audit [dir]                     Show all moment API usage
moment2 stats [dir]                     Summary of usage patterns
moment2 report [dir]                    Temporal migration guide
moment2 init                            Create config file
```

## Status

```
Core test:    625/625 (100%) ✅
Property:     199 tests, 45k+ assertions ✅
Mutation:     10/10 kill (oracle comparison) ✅
Timezone:     8/8 tests ✅
oxlint:       0 errors
TS:           0 errors
Build:        CJS 227K + ESM 227K + IIFE 255K + DTS
```

## Development

```sh
bun install
bun run build          # Build with tsup
bun run test:hard      # Full test suite
bun run lint           # oxlint
bun run typecheck      # oxlint type-aware
bun run ci             # Full CI pipeline
```

### Project Structure

```
src/
  index.ts        Compatibility entry wrapper
  full.ts         Full runtime entry wrapper
  core-entry.ts   Lightweight runtime entry wrapper
  temporal-entry.ts Temporal helper entry wrapper
  entry/          Runtime entry implementations
  core/           Factory and parsing entry logic
  plugins/        Public API registration layers
  moment_fixed.ts Moment class
  duration_fixed.ts Duration class
  locale.ts       Locale system
  format.ts       Format tokenizer
  parse.ts        Date parser
  locale/         Locale definitions (136 locales)
  bin/            CLI tools
test/
  moment/         Core test suite (625 tests)
  properties/     Property-based and metamorphic tests
packages/
  timezone/       @compat/moment2-timezone
```

### Test Strategy

`test/properties/` has three layers:

- oracle tests: `moment2` vs original `moment`
- metamorphic tests: invariants under add/subtract, diff, zone conversion, parseZone, startOf/endOf, and duration arithmetic
- boundary/equivalence tests: partition-based coverage for parsing and date math

The metamorphic layer is centered in [test/properties/metamorphic.test.ts](/Users/as/var/localrepos/moment2/test/properties/metamorphic.test.ts:1). It checks both:

- self-consistency inside `moment2`
- cross-metamorphic consistency against original `moment`

## License

MIT

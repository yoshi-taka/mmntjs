export type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

export type DocPage = {
  slug: string;
  title: string;
  summary: string;
  purpose: string;
  focus: string[];
  related: { label: string; href: string }[];
};

export type KnownDifference = {
  category: string;
  title: string;
  momentBehavior: string;
  mmntjsBehavior: string;
  impact: string;
  workaround: string;
};

export const githubUrl = "https://github.com/yoshi-taka/mmntjs";

export const topNav: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/docs/", label: "Docs" },
  { href: "/compatibility/", label: "Compatibility" },
  { href: "/quality/", label: "Quality" },
  { href: "/performance/", label: "Performance" },
  { href: "/package-size/", label: "Package Size" },
  { href: "/migration/", label: "Migration" },
  { href: "/faq/", label: "FAQ" },
  { href: githubUrl, label: "GitHub", external: true },
];

export const docsPages: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    summary: "Choose the lowest-risk way to evaluate mmntjs in an existing moment.js codebase. `mmntjs/lite` is recommended as the starting entry point for most teams.",
    purpose: "Start with the safest adoption path for your codebase and team constraints.",
    focus: [
      "Zero-code alias vs direct import replacement",
      "Which entry point fits your API needs: lite (recommended), full, or fns",
      "What to verify in your existing test suite first",
      "Where to read compatibility notes before expanding rollout",
    ],
    related: [
      { label: "Lite and fns Usage", href: "/docs/lite-usage/" },
      { label: "Migration", href: "/migration/" },
      { label: "Compatibility", href: "/compatibility/" },
    ],
  },
  {
    slug: "installation",
    title: "Installation",
    summary: "Install mmntjs and choose the right entry point: `mmntjs` (full compat, 179.5KB raw bundled), `mmntjs/lite` (recommended, 55.2KB raw bundled), or `mmntjs/fns` (tree-shakeable standalone helpers).",
    purpose: "Show the available entry points and when each is appropriate.",
    focus: [
      "Direct install and import replacement for moment.js",
      "Alias-based evaluation for low-friction trials",
      "Entry points: full (179.5KB), lite (55.2KB), fns (tree-shakeable)",
      "When to use each entry point",
    ],
    related: [{ label: "Runtime Support", href: "/docs/runtime-support/" }],
  },
  {
    slug: "lite-usage",
    title: "Lite and fns Usage",
    summary: "`mmntjs/lite` (55.2KB raw bundled) is the recommended default: moment-compatible method chaining. `mmntjs/fns` is an alternative for teams that prefer standalone functions.",
    purpose: "Explain when the lite and fns entries are a good fit and what teams must choose based on their API needs.",
    focus: [
      "What the lite entry includes by default (55.2KB raw bundled, method chaining)",
      "What the fns entry offers (standalone functions, small base, tree-shaking scales with imports)",
      "Which plugins or locale modules must be imported explicitly",
      "How to evaluate lite vs fns before switching browser code",
    ],
    related: [
      { label: "Installation", href: "/docs/installation/" },
      { label: "Browser Usage", href: "/docs/browser-usage/" },
    ],
  },
  {
    slug: "basic-usage",
    title: "Basic Usage",
    summary: "Formatting, parsing, manipulation, and duration examples using `mmntjs/lite`, the recommended entry point for most teams.",
    purpose: "Help evaluators confirm that common moment patterns still read naturally with `mmntjs/lite`.",
    focus: [
      "Creation and formatting with `mmntjs/lite`",
      "Common add and diff flows",
      "When to add plugins for extended format or locale support",
      "Where behavior-sensitive topics branch into deeper docs",
    ],
    related: [{ label: "Getting Started", href: "/docs/getting-started/" }],
  },
  {
    slug: "parsing",
    title: "Parsing",
    summary: "Explain how parsing compatibility is evaluated and where edge cases require extra scrutiny.",
    purpose: "Parsing differences are one of the highest-risk areas in a migration.",
    focus: [
      "ISO, RFC 2822, array, object, and custom-format inputs",
      "Strict vs forgiving behavior and fallback paths",
      "Edge cases and regression-tracked differences",
    ],
    related: [
      { label: "Known Differences", href: "/docs/known-differences/" },
      { label: "Quality", href: "/quality/" },
    ],
  },
  {
    slug: "query-comparison",
    title: "Query and Comparison",
    summary: "Document comparison semantics such as diff, isBefore, isAfter, and range checks.",
    purpose: "Comparison drift can silently alter production branching behavior.",
    focus: [
      "diff semantics",
      "Inclusive and exclusive comparisons",
      "Calendar vs exact-time assumptions",
    ],
    related: [{ label: "Migration", href: "/migration/" }],
  },
  {
    slug: "timezone-parsezone",
    title: "Timezone and parseZone",
    summary: "Clarify what core UTC and fixed-offset behavior is covered and what requires separate timezone support.",
    purpose: "Timezone misunderstandings create the highest-cost production regressions.",
    focus: [
      "UTC and fixed-offset compatibility",
      "parseZone and keepLocalTime behavior",
      "What core does not do without timezone data",
    ],
    related: [
      { label: "Compatibility", href: "/compatibility/" },
      { label: "Migration", href: "/migration/" },
    ],
  },
  {
    slug: "invalid-dates",
    title: "Invalid Dates",
    summary: "Make invalid-date behavior explicit, because it affects both UI and business logic edge cases.",
    purpose: "Date libraries earn trust by documenting failure behavior, not only success paths.",
    focus: [
      "Invalid creation paths",
      "Formatting and comparison behavior on invalid values",
      "What should be regression-tested before rollout",
    ],
    related: [{ label: "Known Differences", href: "/docs/known-differences/" }],
  },
  {
    slug: "browser-usage",
    title: "Browser Usage",
    summary: "Document browser loading shapes and what teams should verify in client bundles.",
    purpose: "Browser adoption usually depends on bundle behavior as much as API compatibility.",
    focus: [
      "ESM vs script-tag consumption",
      "Locale loading implications",
      "Bundle-size expectations",
    ],
    related: [{ label: "Package Size", href: "/package-size/" }],
  },
  {
    slug: "runtime-support",
    title: "Runtime Support",
    summary: "Summarize supported runtimes and where runtime-specific behavior deserves extra testing.",
    purpose: "Production evaluators need a quick support matrix before trying migration work.",
    focus: [
      "Node, Bun, browsers, and Deno expectations",
      "CJS and ESM entry points",
      "Runtime-specific caveats worth testing",
    ],
    related: [{ label: "Getting Started", href: "/docs/getting-started/" }],
  },
  {
    slug: "migration-notes",
    title: "Migration Notes",
    summary: "Collect practical notes for teams replacing moment in real systems, not toy examples.",
    purpose: "Keep migration advice close to the docs instead of burying it in marketing copy.",
    focus: [
      "High-risk APIs and patterns",
      "Suggested evaluation order",
      "When to stop rollout and compare behavior more deeply",
    ],
    related: [{ label: "Migration", href: "/migration/" }],
  },
  {
    slug: "known-differences",
    title: "Known Differences",
    summary: "List currently known behavior differences in a way that helps teams assess practical impact.",
    purpose: "This page should build trust by being easy to scan and hard to misunderstand.",
    focus: [
      "Current parsing edge cases",
      "Impact and workarounds",
      "Where to track fixes and regressions",
    ],
    related: [{ label: "Compatibility", href: "/compatibility/" }],
  },
  {
    slug: "api-reference",
    title: "API Reference",
    summary: "Reserve a clear endpoint for exhaustive API documentation without forcing it into every guide page.",
    purpose: "Keep the information architecture ready for full reference docs later.",
    focus: [
      "Namespace layout",
      "Moment instance APIs",
      "Static APIs, plugins, and package entry points",
    ],
    related: [{ label: "Docs", href: "/docs/" }],
  },
];

export const compatibilitySnapshot = [
  ["Formatting", "Compatible", "Token and locale output are covered by upstream and locale-derived tests."],
  ["Manipulation", "Compatible", "add/subtract/startOf/endOf semantics are treated as compatibility-critical."],
  ["Query and comparison", "Compatible", "diff and comparison methods are covered by oracle and property tests."],
  ["Duration", "Compatible", "Construction, normalization, and relative-time behavior are part of the test matrix."],
  ["Locale", "Compatible", "Locale behavior is validated against the upstream locale suite."],
  ["UTC and parseZone", "Compatible", "UTC and fixed-offset behavior are tested; timezone package provides compatible IANA timezone data support."],
  ["Invalid dates", "Compatible", "Examples: `moment(\"2024-02-31\")`, `moment(\"not-a-date\")`, `moment([2024, 1, 31])`, and `moment.invalid()`."],
  ["Parsing", "Mostly compatible", "Standard ISO, RFC 2822, custom format, array, object, sign-prefixed, and control-character inputs match moment.js. One known difference is mixed input like `\"93280531 09-3911\"`."],
];

export const compatibilityEvidence = [
  "630/630 moment.js 2.30.1 official test suite passing",
  "2,063/2,063 current curated `bun run test` suite passing",
  "3,846 timezone, DST, and timezone-package test cases passing across six timezones",
  "112 property-style oracle tests with tens of thousands of assertions against upstream moment.js",
  "11 coverage-guided fuzz harnesses plus a grammar-based ISO generator",
];

export const knownDifferenceHighlights = [
  "Known parsing difference example: `\"93280531 09-3911\"` renders a different local date/time from moment.js.",
  "Core mmntjs covers UTC and fixed-offset behavior; full IANA timezone data is a separate package.",
  "Locale files stay pure data by default, with optional `locale-auto/*` side-effect entries for one-line migration.",
];

export const knownDifferences: KnownDifference[] = [
  {
    category: "Parsing",
    title: "Pre-release parsing edge cases",
    momentBehavior: "Behavior for malformed inputs is defined by moment.js.",
    mmntjsBehavior: "mmntjs matches moment.js for standard inputs, but one current known difference is `\"93280531 09-3911\"`: mmntjs renders `9328-05-31 09:00` while moment.js renders `9328-06-02 09:11` even though `valueOf()` matches.",
    impact: "Low for normal ISO, RFC 2822, array, object, and format-string parsing. Relevant only if your app depends on unusual mixed-format strings.",
    workaround: "Review mixed-format parsing inputs and compare them directly against moment.js before rollout.",
  },
  {
    category: "Timezone scope",
    title: "Core scope is UTC and fixed-offset behavior, not full timezone data",
    momentBehavior:
      "moment plus moment-timezone can be paired with IANA timezone data behavior when that package is in use.",
    mmntjsBehavior:
      "Core mmntjs should be evaluated as covering UTC and fixed offsets. Full timezone-data expectations should be treated as a separate concern.",
    impact:
      "Important for systems that schedule or render by named timezone rather than by plain UTC or fixed offsets.",
    workaround:
      "Review timezone-sensitive code separately and use dedicated timezone support instead of assuming core behavior covers named-zone data cases.",
  },
  {
    category: "Locale registration",
    title: "Locale files do not auto-register on import",
    momentBehavior:
      "Importing 'moment/locale/ja' automatically registers the locale via side effects during module evaluation.",
    mmntjsBehavior:
      "`mmntjs` locale files export pure locale data with no side effects. Unused locale imports are safe for bundlers to tree-shake. For migration convenience, `mmntjs` also provides side-effect entries like `mmntjs/locale-auto/ja`.",
    impact:
      "Teams migrating from moment.js can choose between pure data imports and one-line side-effect locale registration.",
    workaround:
      "Use either import `mmntjs/locale-auto/ja` for drop-in migration or `import { jaLocale } from 'mmntjs/locale/ja'; moment.locale('ja', jaLocale)` for explicit registration and the smallest bundle.",
  },
  {
    category: "CJS require interop",
    title: "require('mmntjs') returns the default function with named exports attached",
    momentBehavior:
      "require('moment') returns the moment function directly as module.exports.",
    mmntjsBehavior:
      "require('mmntjs') also returns the moment function directly. Named exports like isMoment, Duration, and locale are attached as properties. This matches moment.js behavior; no adapter or .default access needed.",
    impact:
      "No impact for ESM import users. CJS require users get the same shape as moment.js.",
    workaround:
      "No workaround needed. This is handled at build time.",
  },
  {
    category: "Performance comparison semantics",
    title: "Some benchmark rows are cost comparisons, not perfectly equivalent APIs",
    momentBehavior:
      "moment.js and its ecosystem comparisons often involve slightly different semantic definitions, especially around month or year differences.",
    mmntjsBehavior:
      "mmntjs matches moment.js semantics in areas like truncated fractional diff, while some comparison libraries expose calendar-difference helpers instead.",
    impact:
      "This affects how benchmark tables should be interpreted, especially by reviewers comparing against date-fns or Temporal at face value.",
    workaround:
      "Read the methodology notes before using benchmark rows in architecture decisions, and prefer workload-specific comparisons where semantics truly align.",
  },
];

export const qualityProof = [
  "630/630 moment.js 2.30.1 compatibility tests passing",
  "Differential oracle tests and property-based comparisons",
  "Coverage-guided fuzzing plus grammar-based ISO generation",
  "DST and timezone boundary tests across multiple timezones",
  "Regression fixtures for previously discovered edge cases",
  "TZ-sensitive test runs in UTC and non-UTC environments",
];

export const performancePrinciples = [
  "Performance claims should be reproducible, scoped, and benchmark-specific.",
  "Compatibility matters more than microbenchmark wins in ambiguous behavior.",
  "Common-path overhead matters more than leaderboard language.",
  "Bundle size is measured at multiple layers — raw, minified, gzip, brotli, bundled, parsed, evaluated — not reduced to a single number.",
];

export const migrationPhases = [
  ["Phase 0", "Inventory current moment usage with `mmntjs migrate --check`. Identify timezone, locale, and parsing hotspots."],
  ["Phase 0.5", "Optionally set npm alias with `mmntjs migrate --mode=alias`: zero code change, lets your build tool resolve `moment` → `mmntjs` at install time."],
  ["Phase 1", "Run `mmntjs migrate --apply` to auto-rewrite imports. For full-only codebases, start with `mmntjs` (full compat). For lite-compatible code, switch directly to `mmntjs/lite`."],
  ["Phase 2", "If your code only uses basic formatting/manipulation, `mmntjs/fns` is an option: standalone functions with tree-shakeable cost. Run `mmntjs migrate --apply --fns --dry` to preview."],
  ["Phase 3", "Run compatibility checks and review known differences for the APIs your codebase uses. Compare production-like behavior, especially invalid dates, offsets, and custom parsing."],
  ["Phase 4", "Replace imports in a low-risk module or service and run the existing test suite. Expand rollout module by module with ownership and rollback clarity."],
  ["Phase 5", "Use the bridge period to guide new code toward modern date/time APIs, including Temporal where it fits."],
];

export const faqGroups = [
  {
    title: "General",
    items: [
      "What is mmntjs?",
      "Is it a drop-in replacement for moment.js?",
      "Why does this exist if moment.js still works?",
      "Is it production-ready?",
      "What is the long-term goal?",
    ],
  },
  {
    title: "Compatibility",
    items: [
      "How compatible is it with moment.js?",
      "What APIs are not supported yet?",
      "Are invalid dates handled the same way?",
      "Does it preserve mutability semantics?",
      "How does parseZone behave?",
      "Does it include moment-timezone behavior?",
    ],
  },
  {
    title: "Migration",
    items: [
      "How should we migrate safely?",
      "Can we replace moment globally?",
      "Should we migrate service-by-service?",
      "How do we detect risky usage?",
      "What tests should we run before adoption?",
    ],
  },
  {
    title: "Performance",
    items: [
      "Is mmntjs faster than moment.js?",
      "How are benchmarks run?",
      "Are results reproducible?",
    ],
  },
  {
    title: "Package Size",
    items: [
      "Is bundle size smaller?",
      "Which entry point should browser apps use?",
      "Does timezone data ship with core?",
    ],
  },
  {
    title: "Ecosystem",
    items: [
      "Why not Temporal?",
      "Why not dayjs?",
      "Why not date-fns?",
      "Why not Luxon?",
      "Can mmntjs coexist with those libraries?",
    ],
  },
  {
    title: "Maintenance",
    items: [
      "What is the versioning policy?",
      "How are breaking changes handled?",
      "How are compatibility bugs prioritized?",
      "How can users report differences from moment.js?",
    ],
  },
];

export const faqAnswers = [
  {
    question: "What is mmntjs?",
    answer:
      "mmntjs is a compatibility-first date/time library intended for teams that still depend on moment.js behavior but want a safer path forward. It is positioned as a migration bridge, not as a claim that every codebase should stop at this library permanently.",
  },
  {
    question: "Is it a drop-in replacement for moment.js?",
    answer:
      "For common moment.js usage, yes: the goal is unchanged imports and moment-compatible behavior. Do not assume perfect coverage for every edge case. Check the Compatibility and Known Differences pages before replacing moment across a large codebase.",
  },
  {
    question: "Is this production-ready?",
    answer:
      "It is ready for serious evaluation in production-like test environments, not for blind replacement in every codebase. Start with a low-risk module, compare behavior against your fixtures, and expand only after compatibility-sensitive paths are boring.",
  },
  {
    question: "How compatible is it with moment.js today?",
    answer:
      "Strong enough to evaluate seriously. Upstream moment.js compatibility tests pass, timezone compatibility tests pass across multiple timezones, and fuzz/property tests compare against moment.js. The remaining known gaps are mostly unusual parsing edge cases, not broad API categories.",
  },
  {
    question: "What APIs are not supported yet?",
    answer:
      "Core mmntjs does not include full named IANA timezone behavior. Use mmntjs-timezone for moment-timezone-style APIs. If your app depends on obscure plugin behavior or odd forgiving parse inputs, check it explicitly instead of assuming it is covered.",
  },
  {
    question: "Are invalid dates handled the same way?",
    answer:
      "The intended behavior is to match moment.js. Invalid dates are tested because they affect formatting, comparisons, and control flow. If your application intentionally relies on invalid inputs, add those exact inputs to your migration test set.",
  },
  {
    question: "Does it preserve mutability semantics?",
    answer:
      "Yes, preserving moment.js-style mutability is part of the compatibility goal. That matters because many existing codebases rely on mutation through add, subtract, startOf, endOf, setters, and shared object references even when the code does not make that dependency obvious.",
  },
  {
    question: "How does parseZone behave?",
    answer:
      "It preserves fixed offsets like moment.js. Offset parsing, offset display, utcOffset, and keepLocalTime behavior are tested against moment.js. If parseZone is important in your app, test real examples from production logs or fixtures.",
  },
  {
    question: "What is still known to differ?",
    answer:
      "Pre-release: known differences exist and are tracked. Standard ISO, RFC 2822, format, UTC, offset, and duration behavior are the main compatibility targets.",
  },
  {
    question: "Why not just use Temporal?",
    answer:
      "Temporal is the long-term direction for many teams, but it does not solve the short-term problem of replacing a large mutable moment.js surface in one step. mmntjs is meant to lower migration risk now while giving teams more time to move new code toward modern APIs later.",
  },
  {
    question: "Why not dayjs, date-fns, or Luxon?",
    answer:
      "Those libraries can be good choices for new systems or for teams ready to change calling patterns. mmntjs is aimed at a narrower problem: preserving legacy moment.js behavior closely enough that a large rewrite does not have to happen first.",
  },
  {
    question: "Does it include timezone data?",
    answer:
      "Core mmntjs does not bundle named IANA timezone data. It supports UTC and fixed-offset behavior. Use mmntjs-timezone when you need moment-timezone-style named zones.",
  },
  {
    question: "How should we migrate safely?",
    answer:
      "Start with inventory and compatibility review, then replace imports in a small owned surface, run existing tests, add a few targeted comparisons around parsing and timezone behavior, and expand only after those checks are boring.",
  },
  {
    question: "Can we replace moment globally?",
    answer:
      "Sometimes, but it should not be the default recommendation. A global replacement can hide where the risk really is. Module-by-module or service-by-service rollout usually produces clearer ownership, easier rollback, and more trustworthy migration evidence.",
  },
  {
    question: "Should we migrate service-by-service?",
    answer:
      "Usually yes for large systems. Service-by-service or package-by-package migration keeps ownership clear, makes rollback smaller, and lets high-risk parsing, locale, and timezone paths stay on moment.js until they have enough evidence.",
  },
  {
    question: "How do we detect risky usage?",
    answer:
      "Look first for custom parsing, forgiving string inputs, invalid-date checks, timezone or parseZone usage, locale-sensitive output, mutation-heavy chains, and reporting or billing boundaries. Those are the places where date-library migrations usually fail quietly.",
  },
  {
    question: "What tests should we run before adoption?",
    answer:
      "Run the tests you already trust first. Then add targeted checks for custom parsing, invalid-date behavior, timezone and DST transitions, parseZone or keepLocalTime flows, and any locale-sensitive formatting that reaches users or reports.",
  },
  {
    question: "Is mmntjs faster than moment.js?",
    answer:
      "In the current public moment.js comparison table, yes. mmntjs wins every tracked row, with especially large wins in ISO parsing, common formatting, diff, and simple arithmetic. Against date-fns the story is mixed: mmntjs wins read-heavy rows, while date-fns often wins fresh-object mutation rows.",
  },
  {
    question: "How are benchmarks run?",
    answer:
      "Benchmarks use process.hrtime.bigint(), warmup runs, repeated medians, consumed outputs to avoid dead-code elimination, and separate cold/warm measurements. Results are checked on Bun and key rows are cross-validated on Node.",
  },
    {
    question: "Is bundle size smaller?",
    answer:
      "Yes, depending on the entry point. The main `mmntjs` entry is 179.5KB raw bundled, `mmntjs/lite` is 55.2KB raw bundled, and `mmntjs/fns` can stay under 1.3KB gzip for small helper sets because it tree-shakes aggressively. Locale and timezone costs stay separate from core.",
  },
  {
    question: "Which entry point should browser apps use?",
    answer:
      "Start with `mmntjs/lite` at 55.2KB raw bundled. It is moment-compatible with method chaining and is the recommended default. If you prefer standalone functions, `mmntjs/fns` is also an option and scales with imports. The main `mmntjs` entry (179.5KB raw bundled) is for full moment.js compatibility during migration.",
  },
  {
    question: "Can mmntjs coexist with dayjs, date-fns, Luxon, or Temporal?",
    answer:
      "Yes. mmntjs is a migration bridge for legacy moment.js usage, not a rule that every date call in a system must use one library. Teams can keep mmntjs around old moment-shaped code while using other libraries or Temporal for new code where they fit better.",
  },
  {
    question: "How are breaking changes handled?",
    answer:
      "Any behavior change that affects moment.js compatibility should be documented. Even small parsing, formatting, invalid-date, timezone, or mutability changes can matter during migration, so they belong in release notes or known-difference docs.",
  },
  {
    question: "How are compatibility bugs prioritized?",
    answer:
      "Compatibility bugs are high priority. Bugs in parsing, formatting, invalid-date handling, timezone behavior, offsets, locale output, or mutation semantics matter more than cosmetic API work because they can break existing moment.js code silently.",
  },
  {
    question: "How can users report differences from moment.js?",
    answer:
      "The most useful report includes the exact input, the moment.js output, the mmntjs output, runtime and timezone settings, and whether locale or timezone packages are involved. Small reproducible fixtures are much more valuable than broad descriptions of date drift.",
  },
  {
    question: "What is the long-term goal?",
    answer:
      "The long-term goal is to get teams off unmaintained moment.js usage without forcing a risky rewrite. mmntjs is a bridge: keep old behavior stable first, then move new code toward better APIs such as Temporal where that makes sense.",
  },
];

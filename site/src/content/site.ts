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
    summary: "Choose the lowest-risk way to evaluate mmntjs in an existing moment.js codebase.",
    purpose: "Start with the safest adoption path for your codebase and team constraints.",
    focus: [
      "Zero-code alias vs direct import replacement",
      "What to verify in your existing test suite first",
      "Where to read compatibility notes before expanding rollout",
    ],
    related: [
      { label: "Migration", href: "/migration/" },
      { label: "Compatibility", href: "/compatibility/" },
    ],
  },
  {
    slug: "installation",
    title: "Installation",
    summary: "Install mmntjs as a standalone package or as a moment-compatible replacement.",
    purpose: "Show the install shapes teams are most likely to try during evaluation.",
    focus: [
      "Direct install and import replacement",
      "Alias-based evaluation for low-friction trials",
      "What package entry points exist and when to use them",
    ],
    related: [{ label: "Runtime Support", href: "/docs/runtime-support/" }],
  },
  {
    slug: "lite-usage",
    title: "Lite Usage",
    summary: "Use `mmntjs/lite` when bundle size matters and you want to add back only the pieces you need.",
    purpose: "Explain when the lite entry is a good fit and what teams must add explicitly.",
    focus: [
      "What the lite entry includes by default",
      "Which plugins or locale modules must be imported explicitly",
      "How to evaluate lite safely before switching browser code to it",
    ],
    related: [
      { label: "Installation", href: "/docs/installation/" },
      { label: "Browser Usage", href: "/docs/browser-usage/" },
    ],
  },
  {
    slug: "basic-usage",
    title: "Basic Usage",
    summary: "Formatting, parsing, manipulation, and duration examples without diving into API reference detail.",
    purpose: "Help evaluators confirm that common moment patterns still read naturally.",
    focus: [
      "Creation and formatting",
      "Common add and diff flows",
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
  ["Parsing", "Mostly compatible", "Standard ISO, RFC 2822, custom format, array, object, sign-prefixed, and control-character inputs match moment.js. One known difference is mixed input like `\"93280531 09-3911\"`."],
  ["Formatting", "Compatible", "Token and locale output are covered by upstream and locale-derived tests."],
  ["Manipulation", "Compatible", "add/subtract/startOf/endOf semantics are treated as compatibility-critical."],
  ["Query and comparison", "Compatible", "diff and comparison methods are covered by oracle and property tests."],
  ["Duration", "Compatible", "Construction, normalization, and relative-time behavior are part of the test matrix."],
  ["Locale", "Compatible", "Locale behavior is validated against the upstream locale suite."],
  ["UTC and parseZone", "Compatible", "UTC and fixed-offset behavior are tested; timezone package provides compatible IANA timezone data support."],
  ["Invalid dates", "Compatible", "Examples: `moment(\"2024-02-31\")`, `moment(\"not-a-date\")`, `moment([2024, 1, 31])`, and `moment.invalid()`."],
];

export const compatibilityEvidence = [
  "678/678 upstream moment.js compatibility tests passing",
  "4642/4642 hard-test suite passing in the current tracked baseline",
  "744/744 timezone compatibility cases passing across six timezones",
  "112 property-style oracle tests with tens of thousands of assertions against upstream moment.js",
  "9 coverage-guided fuzz harnesses plus a grammar-based ISO generator",
];

export const knownDifferenceHighlights = [
  "Known parsing difference example: `\"93280531 09-3911\"` renders a different local date/time from moment.js.",
  "Core mmntjs covers UTC and fixed-offset behavior; full IANA timezone data is a separate package.",
  "Locale files export pure data with no auto-register side effects (better tree-shaking, explicit registration required).",
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
      "mmntjs locale files export pure locale data with no side effects. Unused locale imports are safe for bundlers to tree-shake, but auto-registration does not happen. Users must call moment.locale('ja', jaLocale) explicitly.",
    impact:
      "Teams migrating from moment.js may find that locale imports compile but locale output does not change until explicit registration is added.",
    workaround:
      "Import the locale data and register it explicitly: import { jaLocale } from 'mmntjs/locale/ja'; moment.locale('ja', jaLocale). This is intentional: pure exports enable better tree-shaking.",
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
  "678/678 moment.js compatibility tests passing",
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
  ["Phase 0", "Inventory current moment usage and identify timezone, locale, and parsing hotspots."],
  ["Phase 1", "Run compatibility checks and review known differences for the APIs your codebase uses."],
  ["Phase 2", "Replace imports in a low-risk module or service and run the existing test suite."],
  ["Phase 3", "Compare production-like behavior, especially invalid dates, offsets, and custom parsing."],
  ["Phase 4", "Expand rollout module by module with ownership and rollback clarity."],
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
      "In the current benchmark set, yes. mmntjs wins the tracked moment.js operations, with especially large wins in ISO parsing, common formatting, diff, getters, and simple arithmetic. Treat this as benchmark evidence, not a promise about every workload.",
  },
  {
    question: "How are benchmarks run?",
    answer:
      "Benchmarks use process.hrtime.bigint(), warmup runs, repeated medians, consumed outputs to avoid dead-code elimination, and separate cold/warm measurements. Results are checked on Bun and key rows are cross-validated on Node.",
  },
  {
    question: "Is bundle size smaller?",
    answer:
      "Tree-shaking works. mmntjs declares sideEffects:false and locales are pure data with no auto-register side effects, so bundlers remove unused code. The bundle cost is whatever your app actually imports, not a fixed number.",
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

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

export const githubUrl = "https://github.com/yoshi-taka/moment2";

export const topNav: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/docs/", label: "Docs" },
  { href: "/compatibility/", label: "Compatibility" },
  { href: "/quality/", label: "Quality" },
  { href: "/performance/", label: "Performance" },
  { href: "/migration/", label: "Migration" },
  { href: "/faq/", label: "FAQ" },
  { href: "/changelog/", label: "Changelog" },
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
    slug: "basic-usage",
    title: "Basic Usage",
    summary: "Formatting, parsing, manipulation, and duration examples without diving into API reference detail.",
    purpose: "Help evaluators confirm that common moment patterns still read naturally.",
    focus: [
      "Creation and formatting",
      "Common add and diff flows",
      "Where behavior-sensitive topics branch into deeper docs",
    ],
    related: [
      { label: "Parsing", href: "/docs/parsing/" },
      { label: "Formatting", href: "/docs/formatting/" },
    ],
  },
  {
    slug: "parsing",
    title: "Parsing",
    summary: "Explain how parsing compatibility is evaluated and where edge cases require extra scrutiny.",
    purpose: "Parsing differences are one of the highest-risk areas in a migration.",
    focus: [
      "ISO, RFC 2822, array, object, and custom-format inputs",
      "Strict vs forgiving behavior and fallback paths",
      "Edge cases and known sign-prefixed differences",
    ],
    related: [
      { label: "Known Differences", href: "/docs/known-differences/" },
      { label: "Quality", href: "/quality/" },
    ],
  },
  {
    slug: "formatting",
    title: "Formatting",
    summary: "Cover formatting tokens, locale-sensitive output, and compatibility expectations.",
    purpose: "Formatting is visible to users and often tied to regression-sensitive snapshots.",
    focus: [
      "Common token behavior",
      "Locale interactions",
      "Cases where output should be compared directly against moment.js",
    ],
    related: [{ label: "Locale", href: "/docs/locale/" }],
  },
  {
    slug: "manipulation",
    title: "Manipulation",
    summary: "Document add, subtract, startOf, endOf, and mutating behavior expectations.",
    purpose: "Mutation semantics are part of compatibility, not an implementation detail.",
    focus: [
      "Mutable behavior preservation",
      "Boundary-sensitive operations like month and year math",
      "How to test rollout-sensitive flows",
    ],
    related: [{ label: "Compatibility", href: "/compatibility/" }],
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
    slug: "duration",
    title: "Duration",
    summary: "Explain duration construction, math, and relative-time concerns.",
    purpose: "Duration behavior affects scheduling, reporting, and user-facing labels.",
    focus: [
      "Construction from numbers and objects",
      "Math and normalization behavior",
      "Relative time and humanize coverage",
    ],
    related: [{ label: "Quality", href: "/quality/" }],
  },
  {
    slug: "locale",
    title: "Locale",
    summary: "Set expectations for locale loading, output, and compatibility-sensitive formatting behavior.",
    purpose: "Locale support needs to be explicit because many teams load only a subset of languages.",
    focus: [
      "Locale loading model",
      "Formatting and parsing interactions",
      "What to verify in localized regression tests",
    ],
    related: [{ label: "Formatting", href: "/docs/formatting/" }],
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
    slug: "typescript",
    title: "TypeScript",
    summary: "Explain bundled types, compatibility expectations, and how existing moment typings map over.",
    purpose: "Typing friction often decides whether an evaluation reaches production testing.",
    focus: [
      "Bundled types",
      "Compatibility with existing moment-style imports",
      "Where mmntjs-specific APIs extend the type surface",
    ],
    related: [{ label: "Installation", href: "/docs/installation/" }],
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
    related: [{ label: "Performance", href: "/performance/" }],
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
  ["Parsing", "Mostly compatible", "Differentially tested against moment.js; known edge cases remain in some sign-prefixed inputs."],
  ["Formatting", "Compatible", "Token and locale output are covered by upstream and locale-derived tests."],
  ["Manipulation", "Compatible", "add/subtract/startOf/endOf semantics are treated as compatibility-critical."],
  ["Query and comparison", "Compatible", "diff and comparison methods are covered by oracle and property tests."],
  ["Duration", "Compatible", "Construction, normalization, and relative-time behavior are part of the test matrix."],
  ["Locale", "Compatible", "Locale behavior is validated against the upstream locale suite."],
  ["UTC and parseZone", "Compatible in core scope", "UTC and fixed-offset behavior are tested; IANA timezone data belongs to separate timezone support."],
  ["Invalid dates", "Mostly compatible", "Invalid behavior is explicitly tested and documented because it affects migration safety."],
];

export const compatibilityEvidence = [
  "678/678 upstream moment.js compatibility tests passing",
  "4642/4642 hard-test suite passing in the current tracked baseline",
  "744/744 timezone compatibility cases passing across six timezones",
  "112 property-style oracle tests with tens of thousands of assertions against upstream moment.js",
  "9 coverage-guided fuzz harnesses plus a grammar-based ISO generator",
  "Known remaining compatibility gaps are concentrated in a small set of sign-prefixed parse edge cases",
];

export const knownDifferenceHighlights = [
  "A small number of sign-prefixed parse cases still differ because moment.js uses non-anchored regex matching in some fallback paths.",
  "Core mmntjs should be treated as covering UTC and fixed-offset behavior, not as silently bundling full IANA timezone data behavior.",
  "Runtime-specific caveats should stay visible, including environment-sensitive timezone and locale behavior during evaluation.",
];

export const knownDifferences: KnownDifference[] = [
  {
    category: "Parsing",
    title: "Some sign-prefixed parse edge cases remain different",
    momentBehavior:
      "moment.js can match some sign-prefixed strings through non-anchored regex fallback behavior.",
    mmntjsBehavior:
      "mmntjs is still stricter in a small set of these malformed or edge-case inputs, especially around sign-prefixed parse forms discovered by fuzzing.",
    impact:
      "Relevant mainly if the application depends on odd legacy inputs rather than clean ISO, RFC 2822, or explicit format strings.",
    workaround:
      "Add targeted regression fixtures for suspicious legacy inputs and review the Known Differences page before broad rollout of parsing-heavy modules.",
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
    category: "Runtime caveat",
    title: "Bun named locale imports may not trigger side effects as expected",
    momentBehavior:
      "Consumers often assume locale module side effects run when importing locale-related exports.",
    mmntjsBehavior:
      "In Bun, named imports like locale symbols may not trigger module-level locale registration side effects in the same way a bare import does.",
    impact:
      "This mainly affects teams depending on locale registration through import style rather than explicit loading behavior.",
    workaround:
      "Prefer bare imports such as importing the locale module directly, or call locale registration explicitly when validating Bun-specific runtime behavior.",
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
  "Bundle shape and common-path overhead matter more than leaderboard language.",
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
      "Is bundle size smaller?",
      "Are results reproducible?",
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

export const changelogEntries = [
  {
    date: "2026-05-16",
    title: "Timezone compatibility hardening",
    notes: [
      "Added broader timezone and DST compatibility coverage across six timezones.",
      "Fixed keepLocalTime and UTC array-input compatibility gaps.",
      "Documented current timezone scope more explicitly.",
    ],
  },
  {
    date: "2026-05-13",
    title: "Quality uplift milestone",
    notes: [
      "Expanded targeted tests and raised coverage into the mid-70% range.",
      "Audited additional behavior against upstream moment.js rather than local assumptions.",
      "Added more regression fixtures for parsing, locale, and diff edge cases.",
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
      "That is the direction, but the site should avoid absolute language. The more accurate answer is that mmntjs is designed for moment-compatible adoption, and the right way to evaluate that claim is area by area through compatibility notes, known differences, and your own tests.",
  },
  {
    question: "How compatible is it with moment.js today?",
    answer:
      "The current evidence is strong enough for serious evaluation: upstream compatibility tests pass, timezone compatibility tests pass across multiple timezones, and property-based plus fuzz-driven comparisons are part of the workflow. The project should still document remaining parse edge cases plainly instead of implying universal equivalence.",
  },
  {
    question: "What is still known to differ?",
    answer:
      "The main tracked differences are concentrated in some malformed or edge-case sign-prefixed parsing inputs discovered through fuzzing. Those cases should stay visible in Known Differences and Compatibility rather than being buried in issue trackers alone.",
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
      "Core mmntjs should be described carefully here: UTC and fixed-offset behavior are in scope, but IANA timezone-data behavior should be treated as a separate concern rather than silently assumed.",
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
    question: "What tests should we run before adoption?",
    answer:
      "Run the tests you already trust first. Then add targeted checks for custom parsing, invalid-date behavior, timezone and DST transitions, parseZone or keepLocalTime flows, and any locale-sensitive formatting that reaches users or reports.",
  },
  {
    question: "Is mmntjs faster than moment.js?",
    answer:
      "Performance should be treated as a measured property, not a slogan. The useful answer is which workloads are faster, how the benchmarks were run, and where compatibility remains the higher priority if tradeoffs appear.",
  },
  {
    question: "How are benchmarks run?",
    answer:
      "Benchmark methodology should stay reproducible and boring: record runtime and hardware, distinguish cold and warm paths where relevant, and note when compared libraries are not exposing identical semantics for a given operation.",
  },
  {
    question: "How are compatibility bugs prioritized?",
    answer:
      "For this kind of library, compatibility bugs are product bugs. Regressions that change legacy behavior in parsing, formatting, invalid handling, timezone behavior, or mutability-sensitive flows should be visible quickly and prioritized ahead of more cosmetic work.",
  },
  {
    question: "What is the long-term goal?",
    answer:
      "The long-term goal is not to trap teams on one compatibility layer forever. It is to reduce immediate rewrite risk, make behavior visible, and create a more controlled path toward modern JavaScript date/time APIs, including Temporal where it fits.",
  },
];

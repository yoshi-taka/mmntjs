# mmntjs Website Information Architecture

## Context

This site should help skeptical engineers move from:

1. "moment.js is legacy, but rewriting is risky"
2. "I need to know whether this is safe"
3. "I need proof, not marketing"
4. "I need a practical rollout path"

The site should present `mmntjs` as a compatibility-first migration bridge, not as a trendy replacement or a final destination.

## Recommended Top-Level Navigation

- Home
- Docs
- Compatibility
- Quality
- Performance
- Migration
- FAQ
- Changelog
- GitHub

### Navigation Notes

- `Compatibility`, `Quality`, and `Migration` should be first-class top-level items, not hidden inside Docs.
- `GitHub` should be visible in primary navigation because the target audience will want to inspect source, issues, and tests early.
- `Changelog` should be top-level because compatibility-sensitive adopters care about behavior changes as much as features.

## Recommended User Journey

Primary funnel:

1. Home
2. Compatibility
3. Quality
4. Migration
5. Docs

Secondary entry paths:

- Search or shared link into `Compatibility`
- Search or shared link into `Migration`
- Existing users into `Changelog`
- Evaluators from GitHub into `Quality` or `Performance`

Core principle:

- The site should earn trust before asking for adoption.
- The first conversion is not installation. The first conversion is belief that migration risk has been understood.

## Homepage Structure

The homepage should work as a decision funnel.

### 1. Hero

Purpose:

- State clearly what mmntjs is.
- Give immediate evidence that it is meant for moment.js migration.
- Offer the two most likely next actions.

What it should communicate:

- `mmntjs` is a moment-compatible path forward.
- Teams can reduce migration risk without rewriting all date logic immediately.
- Compatibility matters more than novelty.

Recommended content:

- Headline direction: `A safer path away from moment.js.`
- Supporting sentence: `mmntjs is a compatibility-first replacement for teams that need to preserve date/time behavior while moving toward modern JavaScript over time.`
- Install example
- Small import replacement example
- Primary CTA: `See Compatibility`
- Secondary CTA: `View GitHub`
- Tertiary text link: `Read Migration Guide`

Why this comes first:

- The target visitor is deciding whether this project understands production constraints.

### 2. Problem

Purpose:

- Create recognition.
- Show the project understands why moment.js is still present in large systems.

What it should communicate:

- moment.js often remains because replacement is risky and rarely prioritized.
- Date/time rewrites fail in edge cases, not in demos.
- Teams need a bridge that preserves behavior before they can modernize architecture.

Messaging priorities:

- Risk of parsing drift
- DST and offset edge cases
- Invalid date behavior
- Locale differences
- Hidden production regressions

### 3. Quick Start

Purpose:

- Prove that initial adoption can be small and practical.

What it should communicate:

- Basic replacement is simple.
- Safe adoption still requires checking compatibility notes.

Recommended content:

- Install command
- Import example
- One format example
- One parse or UTC example
- Link: `Read Getting Started`

### 4. Why mmntjs

Purpose:

- Differentiate without hype.

Recommended pillars:

1. Moment-compatible API surface where compatibility is promised
2. Smaller modern implementation
3. Performance-conscious internals
4. Differential testing against moment.js
5. Honest known-differences documentation
6. Practical path toward Temporal over time

What it should communicate:

- This is not just a lighter date library.
- This is a migration tool for teams with legacy constraints.

### 5. Compatibility Snapshot

Purpose:

- Put proof above brand language.

What it should communicate:

- Compatibility is measured area by area.
- The project distinguishes compatible, partial, and unsupported behavior.

Recommended snapshot categories:

- Parsing
- Formatting
- Manipulation
- Query and comparison
- Duration
- Locale
- UTC and parseZone
- Invalid dates

Each row should show:

- Status
- Short note
- Link to full compatibility matrix

### 6. Quality / Testing Promise

Purpose:

- Show that quality is a product feature, not a footnote.

What it should communicate:

- Behavior is checked against moment.js, not guessed.
- The library tests edge cases that cause real migration regressions.

Recommended proof points:

- Differential testing against moment.js
- Regression fixtures and edge-case corpus
- Fuzz or property-based testing
- DST and timezone boundary tests
- Invalid date behavior tests
- CI matrix

Primary CTA:

- `How quality is verified`

### 7. Performance Snapshot

Purpose:

- Address the common follow-up question without making performance the whole story.

What it should communicate:

- mmntjs is performance-conscious.
- Benchmark claims are workload-specific and reproducible.
- Compatibility remains the first priority.

Recommended framing:

- Smaller common paths
- Lower overhead on frequent operations
- Reproducible benchmark methodology

Primary CTA:

- `See benchmark methodology`

### 8. Migration Path

Purpose:

- Convert interest into a believable rollout plan.

What it should communicate:

- Adoption can be incremental.
- Teams should compare behavior before broad rollout.
- mmntjs is a bridge, not the end state.

Recommended staged summary:

1. Replace import in a small area
2. Run existing tests
3. Compare behavior against moment.js
4. Expand module by module
5. Watch known differences
6. Move new code toward Temporal where appropriate

### 9. FAQ Preview

Purpose:

- Resolve major objections before the visitor leaves.

Recommended preview questions:

- Why not just use Temporal?
- Is mmntjs a full replacement for moment.js?
- Does it include timezone data?
- Why not dayjs, date-fns, or Luxon?
- How should we migrate safely?

### 10. Final CTA

Purpose:

- End with a low-pressure next step.

Recommended CTA options:

- `Review Compatibility`
- `Start with the Migration Guide`
- `Inspect the repository on GitHub`

Avoid:

- aggressive install-first language
- generic marketing CTA like `Get Started Now`

## Top-Level Pages

## Home

Purpose:

- Introduce the project and establish the trust funnel.

Key messages:

- mmntjs is a compatibility-first migration bridge away from moment.js.
- It exists for teams that cannot rewrite date/time logic immediately.
- Safety, honesty, and incremental rollout matter more than novelty.

## Docs

Purpose:

- Provide practical usage guidance after trust is established.

Key messages:

- The library is usable today.
- Caveats are documented, not hidden.
- Migration-relevant topics are easy to find.

Recommended docs landing page sections:

- Start here
- Core usage areas
- Migration-sensitive topics
- Runtime and TypeScript support
- Known differences and compatibility links

### Docs Hierarchy

- Getting Started
- Installation
- Basic Usage
- Parsing
- Formatting
- Manipulation
- Query and Comparison
- Duration
- Locale
- Timezone and parseZone
- Invalid Dates
- TypeScript
- Browser Usage
- Node / Bun / Runtime Support
- Migration Notes
- Known Differences
- API Reference

### Docs Ordering Recommendation

The sidebar order should prioritize migration risk before completeness:

1. Getting Started
2. Installation
3. Migration Notes
4. Known Differences
5. Parsing
6. Invalid Dates
7. Timezone and parseZone
8. Formatting
9. Manipulation
10. Query and Comparison
11. Duration
12. Locale
13. TypeScript
14. Runtime Support
15. API Reference

Reason:

- For this audience, `Known Differences` and `Migration Notes` are more important than API reference breadth.

## Compatibility

Purpose:

- Make compatibility claims inspectable.
- Show exactly where behavior matches, differs, or is not yet supported.

Key messages:

- Compatibility is measured by area and API.
- The project documents partial support and intentional differences explicitly.
- Known gaps are tracked and test methodology is visible.

Recommended structure:

1. Compatibility overview
2. Compatibility matrix
3. Known differences
4. Comparison policy with moment.js
5. Testing methodology
6. Unsupported or not-yet-supported APIs
7. Version compatibility guarantees

### Compatibility Matrix Columns

- Area
- API or feature
- Status
- Notes
- Test coverage
- Link to issue or docs

### Recommended Status Vocabulary

- Compatible
- Mostly compatible
- Partial
- Planned
- Not supported
- Intentional difference

### Areas To Cover

- Parsing
- Formatting tokens
- Add and subtract
- startOf and endOf
- diff
- isBefore / isAfter / isSame
- Duration
- Relative time
- Locale
- UTC
- parseZone
- Offset behavior
- Invalid dates
- Mutability semantics

## Known Differences

Purpose:

- Turn caveats into trust.

Recommendation:

- Treat this as its own page under primary navigation through `Compatibility`, even if it is nested under that section.

Key messages:

- The project is explicit about edge cases.
- Each difference includes impact and workaround where possible.

Recommended structure:

- Parsing differences
- Formatting token differences
- Invalid date differences
- Locale differences
- Timezone and offset differences
- Duration differences
- Browser and runtime differences

Each entry should include:

- Description
- moment.js behavior
- mmntjs behavior
- Impact
- Workaround
- Tracking issue if available

## Quality

Purpose:

- Answer the trust question directly.

Key messages:

- Quality means preserving legacy semantics where compatibility is promised.
- The test strategy focuses on semantic equivalence, not only unit-level coverage.

Recommended structure:

1. Quality philosophy
2. Differential testing against moment.js
3. Edge-case corpus
4. Fuzz and property-based testing
5. DST and timezone boundary testing
6. Locale and formatting tests
7. Invalid date behavior
8. CI matrix
9. Regression policy
10. Release checklist

Recommended terminology:

- differential testing
- compatibility corpus
- regression fixtures
- edge-case preservation
- semantic equivalence
- behavior snapshots

## Performance

Purpose:

- Explain performance in a way that feels reproducible and non-defensive.

Key messages:

- Performance matters, but benchmark claims are bounded.
- Workload context and reproducibility matter more than headline wins.

Recommended structure:

1. Performance philosophy
2. Benchmark methodology
3. Common operations
4. Real-world workloads
5. Bundle size
6. Runtime support
7. Reproducibility
8. Interpreting results

Recommended benchmark categories:

- Parse
- Format
- Add and subtract
- startOf and endOf
- diff
- Duration
- Locale formatting
- Bulk transformations

Recommended language:

- `in this benchmark`
- `for this workload`
- `results are reproducible`
- `performance is secondary to compatibility in ambiguous cases`

## Migration

Purpose:

- Help teams adopt mmntjs safely.

Key messages:

- Migration should be staged.
- Existing tests and behavior comparisons are part of rollout.
- mmntjs can reduce immediate risk while creating a path toward modern APIs.

Recommended structure:

1. Migration overview
2. Who should consider mmntjs
3. Who should not use it yet
4. Basic import replacement
5. Recommended rollout strategy
6. Testing strategy
7. CI compatibility check
8. Handling known differences
9. Timezone and locale risk checklist
10. Long-term path toward Temporal

### Recommended Rollout Model

1. Phase 0: inventory current moment usage
2. Phase 1: run compatibility checks and identify risky APIs
3. Phase 2: replace imports in low-risk modules
4. Phase 3: compare production-like behavior
5. Phase 4: expand rollout across services or packages
6. Phase 5: steer new code toward modern APIs, including Temporal where appropriate

### Strong Guidance To Include

- Do not start with a global replacement in the most sensitive path.
- Test timezone and locale behavior explicitly.
- Compare invalid-date handling and parsing edge cases.
- Roll out in modules with clear ownership first.

## FAQ

Purpose:

- Reduce anxiety by answering predictable objections directly.

Key messages:

- The project is honest about scope and limitations.
- Teams can decide based on fit, not hype.

### FAQ Categories And Example Questions

#### General

- What is mmntjs?
- Is mmntjs a drop-in replacement for moment.js?
- Why does this exist if moment.js still works?
- Is this production-ready?
- What is the long-term goal?

#### Compatibility

- How compatible is it with moment.js?
- What APIs are not supported yet?
- Are invalid dates handled the same way?
- Does mmntjs preserve moment.js mutability?
- How are locales handled?
- How does parseZone behave?
- Does it support moment-timezone?

#### Migration

- How should we migrate safely?
- Can we replace moment globally?
- Should we migrate service-by-service?
- How do we detect risky usage?
- What tests should we run before adopting it?

#### Performance

- Is mmntjs faster than moment.js?
- How are benchmarks run?
- Is bundle size smaller?
- Are benchmark results reproducible?

#### Ecosystem

- Why not Temporal?
- Why not dayjs?
- Why not date-fns?
- Why not Luxon?
- Can mmntjs coexist with these libraries?

#### Maintenance

- What is the versioning policy?
- How are breaking changes handled?
- How are compatibility bugs prioritized?
- How can users report differences from moment.js?

## Changelog

Purpose:

- Make release impact easy to assess for compatibility-sensitive adopters.

Key messages:

- Compatibility improvements are release-worthy changes.
- Behavior changes should be explicit and categorized.

Recommended release note sections:

- Compatibility improvements
- Bug fixes
- Performance improvements
- Known behavior changes
- Migration-relevant notes
- Docs and test coverage updates

## Suggested Page Hierarchy

```txt
/
  Home

/docs
  Getting Started
  Installation
  Basic Usage
  Parsing
  Formatting
  Manipulation
  Query and Comparison
  Duration
  Locale
  Timezone and parseZone
  Invalid Dates
  TypeScript
  Browser Usage
  Node / Bun / Runtime Support
  Migration Notes
  Known Differences
  API Reference

/compatibility
  Overview
  Matrix
  Known Differences
  Unsupported APIs
  Compatibility Policy

/quality
  Testing Philosophy
  Differential Testing
  Edge Cases
  Fuzzing
  DST / Timezone Boundaries
  CI Matrix
  Regression Policy

/performance
  Philosophy
  Benchmarks
  Methodology
  Bundle Size
  Real-world Workloads
  Reproducibility

/migration
  Overview
  Import Replacement
  Rollout Strategy
  Testing Strategy
  Risk Checklist
  Path to Temporal

/faq
  General
  Compatibility
  Migration
  Performance
  Ecosystem
  Maintenance

/changelog

/github
  external link
```

## What To Emphasize First

Order of emphasis across the whole site:

1. Compatibility
2. Quality
3. Migration safety
4. Known differences
5. Performance
6. Documentation completeness
7. Long-term path to Temporal

Reason:

- The target audience is not looking for inspiration.
- They are looking for reduction of migration risk.

## Messaging Rules

Prefer:

- compatibility-first
- migration bridge
- safe incremental rollout
- reproducible benchmarks
- known differences
- differential testing
- production migration risk
- legacy semantics preservation

Avoid:

- blazing fast
- perfect drop-in replacement
- zero-risk migration
- modern rewrite your team will love
- dismissive comparisons to moment.js or competing libraries

## Pages To Defer Until Later

These should not block the first public site release:

- Deep benchmark dashboards
- Detailed API reference if not already generated
- Interactive playground
- Blog or release commentary system
- Comparison landing pages against every alternative library
- Advanced Temporal migration cookbook

These can wait until the trust-critical pages are solid:

1. Compatibility
2. Quality
3. Migration
4. FAQ
5. Docs basics

## Recommended MVP For The Site

If only a first release is needed, ship these pages first:

1. Home
2. Docs landing + Getting Started + Known Differences
3. Compatibility
4. Quality
5. Migration
6. FAQ
7. Changelog

This is enough to answer the core adoption question:

- `Can we trust this enough to evaluate it for a real migration?`

# Publish

## Current state

- `mmntjs` and `mmntjs-timezone` are published by **one unified workflow**.
- Default release mode is **both packages at once**.
- Root-only and timezone-only releases are also supported.
- Authentication: **OIDC‑based trusted publisher on npm** (no token stored). Set up once on npmjs.com per package.

## Workflow

- Workflow: `.github/workflows/publish.yml`
- Trigger tags:
  - `release-v*` → publish both packages
  - `mmntjs-v*` → publish root package only
  - `timezone-v*` → publish timezone package only

Examples:

- `release-v0.0.1`
- `mmntjs-v0.0.1`
- `timezone-v0.0.1`

## Default mode: publish both

Use this unless there is a concrete reason to ship only one package.

### Tag

- `release-v0.0.1`

### What the workflow does

1. Resolve release mode from tag
2. Check tag version and package version consistency
3. `bun install --frozen-lockfile`
4. `bun run knip`
5. `bun run fallow`
6. `bun run build`
7. `cd packages/timezone && bun run build`
8. `TZ=UTC bun test ./test/bundle-smoke.test.ts -t 'runtime smoke'`
9. `TZ=UTC bun test ./packages/timezone/test/runtime-smoke.test.ts`
10. `npm pack --dry-run`
11. `cd packages/timezone && npm pack --dry-run`
12. `npm publish --access public`
13. `cd packages/timezone && npm publish --access public`

## Root-only release

### Tag

- `mmntjs-v0.0.1`

### What the workflow does

1. Resolve release mode from tag
2. Check root version matches tag version
3. `bun install --frozen-lockfile`
4. `bun run knip`
5. `bun run fallow`
6. `bun run build`
7. `TZ=UTC bun test ./test/bundle-smoke.test.ts -t 'runtime smoke'`
8. `npm pack --dry-run`
9. `npm publish --access public`

## Timezone-only release

### Tag

- `timezone-v0.0.1`

### What the workflow does

1. Resolve release mode from tag
2. Check timezone version matches tag version
3. `bun install --frozen-lockfile`
4. `bun run knip`
5. `bun run fallow`
6. `bun run build` (root)
7. `cd packages/timezone && bun run build`
8. `TZ=UTC bun test ./packages/timezone/test/runtime-smoke.test.ts`
9. `cd packages/timezone && npm pack --dry-run`
10. `cd packages/timezone && npm publish --access public`

## Versioning rule

- Keep `mmntjs` and `mmntjs-timezone` on the same version unless there is a strong reason not to.
- For `release-v*`, both package versions must exactly match the tag.
- For `mmntjs-v*`, only the root package version must match the tag.
- For `timezone-v*`, only the timezone package version must match the tag.

Current version pair:

```text
mmntjs           0.0.1
mmntjs-timezone  0.0.1
```

## Partial failure recovery (release-v*)

`release-v*` publishes both packages sequentially. If one fails after the other succeeded:

### Root published, timezone failed

```
npm publish --access public  ← success
cd packages/timezone && npm publish --access public  ← failure
```

**Recovery**: push a fix for the timezone issue, then use `timezone-v<same-version>` tag.
  - `release-v*` を再pushしない（root は既に上がっているので rejected になる）
  - Example: root 0.0.3 が publish 済み、timezone だけ失敗 → `timezone-v0.0.3` を push

### Timezone published, root failed

```
npm publish --access public  ← failure
```

**Recovery**: unlikely（timezone より先に root が publish されるため）。万が一起こった場合は root の修正後に `mmntjs-v<same-version>` を push。

### 両方失敗した場合

fix → `release-v<same-version>` を打ち直し（古い tag を削除して再 push）。

## Manual safety rails

- Root package: `prepublishOnly`

```sh
bun run build && TZ=UTC bun test ./test/bundle-smoke.test.ts -t 'runtime smoke'
```

- Timezone package: `packages/timezone/package.json` `prepublishOnly`

```sh
bun run build && TZ=UTC bun test ./test/runtime-smoke.test.ts
```

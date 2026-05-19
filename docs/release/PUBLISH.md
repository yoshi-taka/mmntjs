# Publish

## Current state

- `mmntjs` and `mmntjs-timezone` are **not published simultaneously**.
- They use **separate GitHub Actions workflows** and **separate tags**.

## Root package: `mmntjs`

- Package version: `package.json` `version`
- Workflow: `.github/workflows/publish.yml`
- Trigger tag: `v*`
- Example: `v0.0.1`

### What the workflow does

1. `bun install --frozen-lockfile`
2. `bun run knip`
3. `bun run fallow`
4. `bun run build`
5. `TZ=UTC bun test ./test/bundle-smoke.test.ts -t 'runtime smoke'`
6. `npm pack --dry-run`
7. `npm publish --access public`

### Manual safety rail

- `prepublishOnly` runs before manual `npm publish`
- Current command:

```sh
bun run build && TZ=UTC bun test ./test/bundle-smoke.test.ts -t 'runtime smoke'
```

## Timezone package: `mmntjs-timezone`

- Package version: `packages/timezone/package.json` `version`
- Workflow: `.github/workflows/publish-timezone.yml`
- Trigger tag: `timezone-v*`
- Example: `timezone-v0.0.1`

### What the workflow does

1. `bun install --frozen-lockfile`
2. `mkdir -p packages/timezone/node_modules && ln -sfn "$PWD" packages/timezone/node_modules/mmntjs`
3. `bun run knip`
4. `bun run fallow`
5. `bun run build` (root)
6. `cd packages/timezone && bun run build`
7. Verify timezone dist files exist
8. `TZ=UTC bun test ./packages/timezone/test/runtime-smoke.test.ts`
9. `cd packages/timezone && npm pack --dry-run`
10. `cd packages/timezone && npm publish --access public`

### Manual safety rail

- `packages/timezone/package.json` has `prepublishOnly`
- Current command:

```sh
bun run build && TZ=UTC bun test ./test/runtime-smoke.test.ts
```

## Versioning rule

- Keep `mmntjs` and `mmntjs-timezone` on the same version unless there is a strong reason not to.
- Current version pair:

```text
mmntjs           0.0.1
mmntjs-timezone  0.0.1
```

## If publishing both packages for the same release

Because current workflows are separate, publish requires **two tags**:

1. Push `v0.0.1` to publish `mmntjs`
2. Push `timezone-v0.0.1` to publish `mmntjs-timezone`

If we want true simultaneous release later, unify the workflows around a single tag and publish both packages in one job or coordinated jobs.

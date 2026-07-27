# kokuin

Zero-dependency TypeScript library for deterministic hashing of JSON-compatible values.

## Commands (run from repo root)

| Command              | Action                                       |
| -------------------- | -------------------------------------------- |
| `pnpm build`         | Build with tsdown → `dist/*.mjs` + `*.d.mts` |
| `pnpm dev`           | `tsdown --watch`                             |
| `pnpm test`          | `vitest run` (tests in `tests/**/*.test.ts`) |
| `pnpm test:watch`    | `vitest` (watch mode)                        |
| `pnpm test:coverage` | `vitest run --coverage`                      |
| `pnpm lint`          | `oxlint`                                     |
| `pnpm lint:fix`      | `oxlint --fix`                               |
| `pnpm format`        | `oxfmt --write .`                            |
| `pnpm format:check`  | `oxfmt --check .`                            |
| `pnpm typecheck`     | `tsc -p tsconfig.test.json --noEmit`         |

Gate before push (enforced by husky): `pnpm typecheck && pnpm test`.

CI runs in parallel: typecheck + lint + format:check → test → build.

## Code conventions

- **Single entrypoint**: `src/index.ts` exports a `hash(value: unknown): string` function (the entire public API).
- **No semicolons**, single quotes, no trailing commas, 100 print width (enforced by `oxfmt`).
- **No `forEach`** — use `for...of`. No bitwise operators (except `src/sha256.ts` which has `// oxlint-disable no-bitwise`). No `var`. Prefer arrow functions. `console` is warn-level. `eqeqeq` always (no `==` null checks).
- **`verbatimModuleSyntax`** — use `import type` for type-only imports. `isolatedDeclarations` is on (export types must be explicitly annotated).
- **`erasableSyntaxOnly`** — no enums, no namespaces, no parameter properties. Use plain `const` objects and regular constructor assignment.
- **`noUncheckedIndexedAccess`** — array reads use the `!` non-null assertion (e.g., `w[t - 15]!`).
- **Commit convention**: Conventional Commits (`@commitlint/config-conventional`).
- **`.gitattributes` enforces LF** — even on Windows.

## Architecture

- Hand-written SHA-256 in `src/sha256.ts` (pure JS bitwise operations — no `crypto.subtle` or `crypto.createHash` calls; zero dependencies).
- Single package (not a monorepo). `pnpm-workspace.yaml` only disables git checks on publish.
- Output is ESM-only: `exports` map points to `./dist/index.mjs` + `./dist/index.d.mts`.
- Node >=20, pnpm 11.15.1, TypeScript 7.x.
- `vitest` configured with `globals: true`, but tests **import** `describe`/`it`/`expect` from `vitest` explicitly (style convention). Tests import from `../src/index.js` (`.js` extension).
- `lint-staged` runs `oxlint --fix && oxfmt --write` on staged `*.ts` files.
- Release: push tag `v*` → CI runs `pnpm build && pnpm publish --no-git-checks --provenance`.

## Scope (from README — preserve)

The serializer only has a path for: primitives (`string`, `number`, `boolean`, `null`, `undefined`, `bigint`), arrays, plain objects, and objects exposing `toJSON()` (the return value is hashed in its place). There is no branch for `Map`, `Set`, `Date`, `RegExp`, `Error`, or class instances without `toJSON()` — these must throw, not silently fall back to a best-effort serialization. Do not add `instanceof`-based special cases for these types; that scope was deliberately reverted (class/constructor identity is not stable across bundlers or realms — see README § Not supported). If a new type needs support, the answer is "the user converts explicitly before calling `hash()`", not a new branch in the serializer.

**`toJSON` guard**: The serializer checks `Object.prototype.toString.call(obj) === '[object Object]'` before calling `toJSON()`. This prevents built-in types like `Date` that have `toJSON` on their prototype from being hashed — they throw with an explicit type name instead.

## Stability contract (from README — preserve)

- Same logical value → same hash, regardless of key order.
- Stable across runtimes (Node, Bun, Deno, browsers). No `localeCompare`.
- Circular references must not throw — the one deliberate place kokuin goes beyond JSON.
- `Map`, `Set`, `Date`, `RegExp`, `Error`, class instances without `toJSON()`, `Function`, `Symbol`, `WeakMap`, `WeakSet`, `WeakRef`, `Promise` must all throw explicitly.
- No class or constructor name is ever read or hashed, under any code path.
- Depth-limited: maximum nesting is 512 (`MAX_DEPTH` in `src/index.ts`); excessive nesting must throw.

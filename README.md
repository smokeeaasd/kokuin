# kokuin

![npm](https://img.shields.io/npm/v/kokuin)
![License](https://img.shields.io/npm/l/kokuin)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6)
![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

A lightweight TypeScript library for deterministic hashing of JSON-compatible values.

## Install

```
npm install kokuin
```

## Quick start

```ts
import { hash } from 'kokuin'

hash({ a: 1, b: 2 })
hash({ b: 2, a: 1 })
// → same hash, key order doesn't matter

hash([1, 2, 3])
hash([3, 2, 1])
// → different hash — array order matters
```

The contract: **the same logical value always produces the same hash.** This is a stronger guarantee than `JSON.stringify(value)` + hash — `JSON.stringify` silently breaks on key order and throws on circular references. kokuin normalizes the former and tolerates the latter.

This is not a cryptographic library. It is not designed to resist intentional collisions from malicious input — it's a structural identity tool for cache keys, deduplication, and idempotency of JSON-shaped payloads.

## Scope

kokuin hashes:

- **Primitives** — `string`, `number`, `boolean`, `null`, `undefined`, `bigint`
- **Arrays** — order matters
- **Plain objects** — key order never matters
- **Objects with `toJSON()`** — the return value of `toJSON()` is hashed in place of the object itself

That's the whole surface. There is no special handling for `Map`, `Set`, `Date`, `RegExp`, or class instances — see [Not supported](#not-supported) for why, and how to convert them.

### Primitives

```ts
hash(-0) === hash(0) // true — same logical value
hash(NaN) === hash(NaN) // true
hash(1n) // BigInt never collides with Number
hash(undefined) // distinct from null and from an absent key
hash({ a: undefined }) // distinct from hash({}) — undefined is a value, not an omission
```

### Objects

```ts
hash({ a: 1, b: 2 }) === hash({ b: 2, a: 1 }) // true — key order is normalized
hash({ a: 1 }) === hash({ a: 1, b: undefined }) // false — presence of the key matters
```

### `toJSON()`

Any object exposing `toJSON()` is hashed via its return value — the same rule `JSON.stringify` follows. This is how you bring in types kokuin doesn't special-case:

```ts
class Money {
  constructor(private cents: number) {}
  toJSON() {
    return { cents: this.cents }
  }
}

hash(new Money(500)) === hash({ cents: 500 }) // true
```

### Circular references

```ts
const a: any = {}
a.self = a

hash(a) // does not throw
```

This is the one place kokuin deliberately goes beyond JSON: `JSON.stringify` throws on a cycle, kokuin resolves it instead, so a circular structure can still be used as a cache key.

## Not supported

`Map`, `Set`, `Date`, `RegExp`, `Error`, and plain class instances without a `toJSON()` all throw explicitly, rather than silently producing a hash built on shaky ground:

```ts
hash(new Map()) // Error
hash(new Set()) // Error
hash(new Date()) // Error
hash(/abc/) // Error
hash(new Error('boom')) // Error
hash(new User(1)) // Error, unless User defines toJSON()

hash(() => {}) // Function
hash(Symbol()) // Symbol
hash(new WeakMap()) // no synchronous way to inspect contents
hash(new WeakSet())
hash(new Promise(() => {}))
```

These aren't oversights — they're the types where representing "identity" in JavaScript stops being reliable. A class name survives minification only by luck; `Date`/`Map`/`Set` can fail `instanceof` across realms (an iframe, a worker, a second copy of the package). Rather than papering over that with a fallback that sometimes lies, kokuin asks you to convert explicitly:

```ts
hash(Object.fromEntries(myMap)) // convert Map → object
hash([...mySet].sort()) // convert Set → sorted array, if order shouldn't matter
hash(myDate.toISOString()) // convert Date → string
```

Two things worth knowing about those conversions, since kokuin can't check them for you:

- `Object.fromEntries` coerces every key to a string — a `Map` with both `1` and `'1'` as keys collapses into one.
- Sorting a converted `Set` is your responsibility if you want insertion order to stay irrelevant; `[...mySet]` alone preserves insertion order.

## Stability

- Deterministic: same logical value → same hash, every time.
- Stable across runtimes: same hash on Node, Bun, Deno, and modern browsers. All internal ordering uses binary string comparison — never `localeCompare` or anything dependent on Unicode/ICU tables, which vary between engine versions.
- No exposed intermediate serialization — the canonical representation is an implementation detail, never part of the public contract.
- Depth-limited: excessively deep input fails with an explicit error instead of silently overflowing the stack.
- No class or constructor identity is ever part of the hash — by design, not by omission. See [Not supported](#not-supported).

## API

### `hash(value)`

Hash a JSON-compatible value into a string. Returns the same output for the same logical value, regardless of key order.

| Type                   | Description                         |
| ---------------------- | ------------------------------------ |
| `hash(value: unknown)` | Returns a deterministic string hash |

There is no `hash.sha256()`, no algorithm option, and no separate `serialize`/`digest` exports — the internal pipeline is not part of the public API. The algorithm may change in a major version; the stability contract above does not.

### Errors

- `Error` — thrown by `hash()` when the value is `Map`, `Set`, `Date`, `RegExp`, `Function`, `Symbol`, `WeakMap`, `WeakSet`, `WeakRef`, `Promise`, or a class instance without `toJSON()`, or when nesting exceeds the maximum supported depth

## License

MIT
import { describe, it, expect } from 'vitest'
import { hash } from '../src/index'

describe('primitives', () => {
  it('null', () => {
    expect(hash(null)).toBe(hash(null))
  })

  it('undefined', () => {
    expect(hash(undefined)).toBe(hash(undefined))
  })

  it('booleans', () => {
    expect(hash(true)).toBe(hash(true))
    expect(hash(false)).toBe(hash(false))
  })

  it('numbers', () => {
    expect(hash(0)).toBe(hash(0))
    expect(hash(1)).toBe(hash(1))
    expect(hash(-1)).toBe(hash(-1))
    expect(hash(3.14)).toBe(hash(3.14))
    expect(hash(Infinity)).toBe(hash(Infinity))
    expect(hash(-Infinity)).toBe(hash(-Infinity))
    expect(hash(Number.MAX_VALUE)).toBe(hash(Number.MAX_VALUE))
    expect(hash(Number.MIN_VALUE)).toBe(hash(Number.MIN_VALUE))
  })

  it('-0 normalizes to 0', () => {
    expect(hash(-0)).toBe(hash(0))
  })

  it('NaN is consistent', () => {
    expect(hash(NaN)).toBe(hash(NaN))
  })

  it('bigints', () => {
    expect(hash(0n)).toBe(hash(0n))
    expect(hash(1n)).toBe(hash(1n))
    expect(hash(-1n)).toBe(hash(-1n))
    expect(hash(9007199254740993n)).toBe(hash(9007199254740993n))
  })

  it('strings', () => {
    expect(hash('')).toBe(hash(''))
    expect(hash('hello')).toBe(hash('hello'))
    expect(hash('')).toBe(hash(''))
    expect(hash('unicode ✓')).toBe(hash('unicode ✓'))
    expect(hash('emoji 🚀')).toBe(hash('emoji 🚀'))
  })

  it('different primitives have different hashes', () => {
    const results = new Set([
      hash(null),
      hash(undefined),
      hash(true),
      hash(false),
      hash(0),
      hash(1),
      hash(''),
      hash('0'),
      hash(0n)
    ])
    expect(results.size).toBe(9)
  })

  it('number and string never collide', () => {
    expect(hash(1)).not.toBe(hash('1'))
    expect(hash(0)).not.toBe(hash('0'))
    expect(hash(-1)).not.toBe(hash('-1'))
  })

  it('bigint and number never collide', () => {
    expect(hash(1n)).not.toBe(hash(1))
    expect(hash(0n)).not.toBe(hash(0))
  })

  it('null and undefined are distinct', () => {
    expect(hash(null)).not.toBe(hash(undefined))
  })

  it('false and 0 are distinct', () => {
    expect(hash(false)).not.toBe(hash(0))
  })
})

describe('arrays', () => {
  it('empty array', () => {
    expect(hash([])).toBe(hash([]))
  })

  it('simple array', () => {
    expect(hash([1, 2, 3])).toBe(hash([1, 2, 3]))
  })

  it('order matters', () => {
    expect(hash([1, 2])).not.toBe(hash([2, 1]))
  })

  it('nested arrays', () => {
    expect(hash([[1], [2]])).toBe(hash([[1], [2]]))
    expect(hash([[1, 2]])).not.toBe(hash([[1], [2]]))
  })

  it('mixed types in array', () => {
    expect(hash([1, 'a', true, null])).toBe(hash([1, 'a', true, null]))
  })

  it('array with undefined', () => {
    expect(hash([undefined])).toBe(hash([undefined]))
    expect(hash([undefined])).not.toBe(hash([]))
  })
})

describe('objects', () => {
  it('empty object', () => {
    expect(hash({})).toBe(hash({}))
  })

  it('key order does not matter', () => {
    expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 }))
  })

  it('nested objects', () => {
    expect(hash({ a: { b: 1 } })).toBe(hash({ a: { b: 1 } }))
  })

  it('key presence matters even with undefined value', () => {
    expect(hash({ a: 1 })).not.toBe(hash({ a: 1, b: undefined }))
  })

  it('Object.create(null)', () => {
    const obj = Object.create(null)
    obj.a = 1
    expect(hash(obj)).toBe(hash({ a: 1 }))
  })

  it('multiple keys sort correctly', () => {
    expect(hash({ b: 2, a: 1, c: 3 })).toBe(hash({ a: 1, b: 2, c: 3 }))
  })

  it('object vs array are distinct', () => {
    expect(hash({ 0: 1 })).not.toBe(hash([1]))
  })
})

describe('toJSON', () => {
  it('object with toJSON method', () => {
    const obj = { toJSON: () => 42 }
    expect(hash(obj)).toBe(hash(42))
  })

  it('class instance with toJSON on prototype', () => {
    class Point {
      x: number
      y: number
      constructor(x: number, y: number) {
        this.x = x
        this.y = y
      }
      toJSON() {
        return { x: this.x, y: this.y }
      }
    }
    expect(hash(new Point(1, 2))).toBe(hash({ x: 1, y: 2 }))
  })

  it('toJSON returning nested structure', () => {
    const obj = { toJSON: () => ({ items: [1, 2, 3] }) }
    expect(hash(obj)).toBe(hash({ items: [1, 2, 3] }))
  })

  it('toJSON on userland object still works', () => {
    const obj = { toJSON: () => 'userland' }
    expect(hash(obj)).toBe(hash('userland'))
  })
})

describe('circular references', () => {
  it('self-referencing object does not throw', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(() => hash(a)).not.toThrow()
  })

  it('cross-referencing objects do not throw', () => {
    const a: Record<string, unknown> = {}
    const b: Record<string, unknown> = {}
    a.x = b
    b.y = a
    expect(() => hash(a)).not.toThrow()
  })

  it('circular array does not throw', () => {
    const a: unknown[] = []
    a.push(a)
    expect(() => hash(a)).not.toThrow()
  })

  it('circular via toJSON does not throw', () => {
    const a: Record<string, unknown> = {}
    a.toJSON = () => a
    expect(() => hash(a)).not.toThrow()
  })

  it('circular is deterministic', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(hash(a)).toBe(hash(a))
  })

  it('self-reference and parent-reference produce different hashes', () => {
    const innerA: Record<string, unknown> = {}
    const case1: Record<string, unknown> = { a: innerA }
    innerA.ref = innerA

    const innerB: Record<string, unknown> = {}
    const case2: Record<string, unknown> = { a: innerB }
    innerB.ref = case2

    expect(hash(case1)).not.toBe(hash(case2))
  })
})

describe('unsupported types throw', () => {
  const cases: Array<{ label: string; value: unknown }> = [
    { label: 'Map', value: new Map() },
    { label: 'Set', value: new Set() },
    { label: 'Date', value: new Date() },
    { label: 'invalid Date', value: new Date('invalid') },
    { label: 'RegExp', value: /abc/ },
    { label: 'Error', value: new Error('boom') },
    { label: 'class instance without toJSON', value: new (class Foo {})() },
    { label: 'Function', value: () => {} },
    { label: 'symbol', value: Symbol() },
    { label: 'WeakMap', value: new WeakMap() },
    { label: 'WeakSet', value: new WeakSet() },
    { label: 'Promise', value: Promise.resolve() }
  ]

  for (const { label, value } of cases) {
    it(label, () => {
      expect(() => hash(value)).toThrow()
    })
  }
})

describe('depth limit', () => {
  it('throws on excessive nesting', () => {
    let obj: unknown = {}
    for (let i = 0; i < 600; i++) {
      obj = { next: obj }
    }
    expect(() => hash(obj)).toThrow()
  })

  it('allows deep but not excessive nesting', () => {
    let obj: unknown = {}
    for (let i = 0; i < 400; i++) {
      obj = { next: obj }
    }
    expect(() => hash(obj)).not.toThrow()
  })
})

describe('determinism', () => {
  const values: Array<{ label: string; value: unknown }> = [
    { label: 'null', value: null },
    { label: 'string', value: 'hello' },
    { label: 'number', value: 42 },
    { label: 'array', value: [1, 2, { a: 3 }] },
    { label: 'object', value: { a: 1, b: [2, 3] } },
    { label: 'nested', value: { x: { y: { z: [1, 2, 3] } } } },
    { label: 'bigint', value: 9007199254740993n },
    { label: 'toJSON', value: { toJSON: () => 'hello' } }
  ]

  for (const { label, value } of values) {
    it(label, () => {
      const h1 = hash(value)
      const h2 = hash(value)
      expect(h1).toBe(h2)
    })
  }
})

describe('hash output format', () => {
  it('returns a 64-character hex string', () => {
    const result = hash('hello')
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('edge cases', () => {
  it('array with empty slots', () => {
    const arr: unknown[] = [1]
    arr.length = 3
    arr[2] = 3
    expect(hash(arr)).toBe(hash([1, undefined, 3]))
  })

  it('object with numeric keys', () => {
    expect(hash({ 1: 'a', 2: 'b' })).toBe(hash({ 2: 'b', 1: 'a' }))
  })
})

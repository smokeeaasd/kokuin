import { describe, it, expect } from 'vitest'
import { hash } from '../src/index.js'

describe('hash', () => {
  it('hello world', () => {
    expect(hash(null)).toBe('hello world')
  })
})

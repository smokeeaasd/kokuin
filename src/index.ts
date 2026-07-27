import { sha256 } from './sha256'

const NULL = 0x00
const UNDEFINED = 0x01
const FALSE = 0x02
const TRUE = 0x03
const NUMBER = 0x04
const BIGINT = 0x05
const STRING = 0x06
const ARRAY = 0x07
const OBJECT = 0x08
const CIRCULAR = 0x09
const END = 0xff

const MAX_DEPTH = 512
const encoder = new TextEncoder()

class Writer {
  private buffer: Uint8Array
  private offset = 0

  constructor(initialSize = 4096) {
    this.buffer = new Uint8Array(initialSize)
  }

  private ensure(size: number): void {
    if (this.offset + size <= this.buffer.length) {
      return
    }
    const newSize = Math.max(this.buffer.length * 2, this.offset + size)
    const newBuffer = new Uint8Array(newSize)
    newBuffer.set(this.buffer.subarray(0, this.offset))
    this.buffer = newBuffer
  }

  writeByte(byte: number): void {
    this.ensure(1)
    this.buffer[this.offset++] = byte
  }

  writeBytes(bytes: Uint8Array): void {
    if (bytes.length === 0) {
      return
    }
    this.ensure(bytes.length)
    this.buffer.set(bytes, this.offset)
    this.offset += bytes.length
  }

  toBytes(): Uint8Array {
    return this.buffer.slice(0, this.offset)
  }
}

function writeString(writer: Writer, str: string): void {
  const encoded = encoder.encode(str)
  const lenBuf = new Uint8Array(4)
  const view = new DataView(lenBuf.buffer)
  view.setUint32(0, encoded.length)
  writer.writeBytes(lenBuf)
  writer.writeBytes(encoded)
}

function serialize(value: unknown, writer: Writer, stack: Set<object>, depth: number): void {
  if (depth > MAX_DEPTH) {
    throw new Error('Excessive nesting')
  }

  if (value === null) {
    writer.writeByte(NULL)
    return
  }

  if (value === undefined) {
    writer.writeByte(UNDEFINED)
    return
  }

  if (typeof value === 'boolean') {
    writer.writeByte(value ? TRUE : FALSE)
    return
  }

  if (typeof value === 'number') {
    writer.writeByte(NUMBER)
    const num = Object.is(value, -0) ? 0 : value
    const buf = new Uint8Array(8)
    new DataView(buf.buffer).setFloat64(0, num)
    writer.writeBytes(buf)
    return
  }

  if (typeof value === 'bigint') {
    writer.writeByte(BIGINT)
    writeString(writer, value.toString())
    return
  }

  if (typeof value === 'string') {
    writer.writeByte(STRING)
    writeString(writer, value)
    return
  }

  if (typeof value === 'symbol') {
    throw new Error('Cannot hash symbol values')
  }

  if (typeof value === 'function') {
    throw new Error('Cannot hash function values')
  }

  const obj = value as object

  if (stack.has(obj)) {
    writer.writeByte(CIRCULAR)
    return
  }

  if (typeof (obj as Record<string, unknown>).toJSON === 'function') {
    const tag = Object.prototype.toString.call(obj)

    if (tag !== '[object Object]') {
      throw new Error(`Cannot hash ${tag.slice(8, -1)} values`)
    }

    stack.add(obj)
    const result = (obj as { toJSON(): unknown }).toJSON()
    serialize(result, writer, stack, depth + 1)
    stack.delete(obj)
    return
  }

  stack.add(obj)

  if (Array.isArray(value)) {
    writer.writeByte(ARRAY)
    for (const element of value) {
      serialize(element, writer, stack, depth + 1)
    }
    writer.writeByte(END)
    stack.delete(value)
    return
  }

  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) {
    stack.delete(value)
    throw new Error('Cannot hash non-plain objects')
  }

  writer.writeByte(OBJECT)
  const keys = Object.keys(value as Record<string, unknown>)
  keys.sort((a, b) => {
    if (a < b) {
      return -1
    }
    if (a > b) {
      return 1
    }
    return 0
  })
  for (const key of keys) {
    serialize(key, writer, stack, depth + 1)
    serialize((value as Record<string, unknown>)[key], writer, stack, depth + 1)
  }
  writer.writeByte(END)
  stack.delete(value)
}

function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

export function hash(value: unknown): string {
  const writer = new Writer()
  serialize(value, writer, new Set<object>(), 0)
  return toHex(sha256(writer.toBytes()))
}

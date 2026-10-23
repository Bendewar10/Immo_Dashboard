import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const TEST_KEY = 'a'.repeat(64)

beforeAll(() => {
  process.env.CONNECTOR_ENCRYPTION_KEY = TEST_KEY
})

afterAll(() => {
  delete process.env.CONNECTOR_ENCRYPTION_KEY
})

import { encrypt, decrypt } from './encryption'

describe('connector token encryption', () => {
  it('round-trips a plain string', () => {
    const original = 'ya29.test-access-token-value'
    expect(decrypt(encrypt(original))).toBe(original)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const token = 'same-token'
    const enc1 = encrypt(token)
    const enc2 = encrypt(token)
    expect(enc1).not.toBe(enc2)
    expect(decrypt(enc1)).toBe(token)
    expect(decrypt(enc2)).toBe(token)
  })

  it('encrypted output is not the plaintext', () => {
    const token = 'secret-refresh-token'
    const encrypted = encrypt(token)
    expect(encrypted).not.toContain(token)
  })

  it('throws on wrong key for decryption', () => {
    const encrypted = encrypt('some-token')
    process.env.CONNECTOR_ENCRYPTION_KEY = 'b'.repeat(64)
    expect(() => decrypt(encrypted)).toThrow()
    process.env.CONNECTOR_ENCRYPTION_KEY = TEST_KEY
  })

  it('throws when CONNECTOR_ENCRYPTION_KEY is missing', () => {
    delete process.env.CONNECTOR_ENCRYPTION_KEY
    expect(() => encrypt('token')).toThrow('CONNECTOR_ENCRYPTION_KEY')
    process.env.CONNECTOR_ENCRYPTION_KEY = TEST_KEY
  })

  it('throws when CONNECTOR_ENCRYPTION_KEY is wrong length', () => {
    process.env.CONNECTOR_ENCRYPTION_KEY = 'tooshort'
    expect(() => encrypt('token')).toThrow('CONNECTOR_ENCRYPTION_KEY')
    process.env.CONNECTOR_ENCRYPTION_KEY = TEST_KEY
  })

  it('handles long tokens correctly', () => {
    const longToken = 'x'.repeat(2048)
    expect(decrypt(encrypt(longToken))).toBe(longToken)
  })

  it('handles special characters in token', () => {
    const token = 'ya29.a0AfH6SM==&token+value/test'
    expect(decrypt(encrypt(token))).toBe(token)
  })
})

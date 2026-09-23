import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
    parseInput,
    requiredText,
    optionalText,
    optionalTextPreserve,
    optionalNumber,
    orderIndex,
    uuid,
    optionalUuid,
    upsertId,
    jsonArray,
    resourceList,
    booleanish,
} from '@/app/lib/validation/parse'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

describe('parseInput', () => {
    const schema = z.object({ name: requiredText('Name'), rate: optionalNumber('Rate') })

    it('returns ok with parsed data for valid input', () => {
        const result = parseInput(schema, { name: '  Zara  ', rate: '12.5' })
        expect(result).toEqual({ ok: true, data: { name: 'Zara', rate: 12.5 } })
    })

    it('flattens all issues into one readable message', () => {
        const result = parseInput(schema, { name: '', rate: 'abc' })
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toBe('Please fix the following: Name is required; Rate must be a number')
        }
    })

    it('rejects non-object input without throwing', () => {
        const result = parseInput(schema, null)
        expect(result.ok).toBe(false)
    })

    it('strips keys that resolve to undefined so "absent key" is a real guarantee', () => {
        const s = z.object({ id: upsertId('Offer id'), name: requiredText('Name') })
        const result = parseInput(s, { id: '', name: 'X' })
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(Object.prototype.hasOwnProperty.call(result.data, 'id')).toBe(false)
        }
    })
})

describe('field primitives', () => {
    it('requiredText rejects missing, empty, and non-string values with the label', () => {
        const s = z.object({ name: requiredText('Name') })
        for (const bad of [{}, { name: '' }, { name: '   ' }, { name: 42 }]) {
            const r = parseInput(s, bad)
            expect(r.ok).toBe(false)
            if (!r.ok) expect(r.error).toContain('Name is required')
        }
    })

    it('optionalText: empty/null/undefined become null; values are trimmed', () => {
        expect(optionalText.parse('')).toBeNull()
        expect(optionalText.parse(null)).toBeNull()
        expect(optionalText.parse(undefined)).toBeNull()
        expect(optionalText.parse('  hi  ')).toBe('hi')
    })

    it('optionalTextPreserve: absent key stays absent, present empty becomes null', () => {
        const s = z.object({ title_es: optionalTextPreserve })
        expect(s.parse({})).toEqual({})
        expect(s.parse({ title_es: '' })).toEqual({ title_es: null })
        expect(s.parse({ title_es: 'Hola' })).toEqual({ title_es: 'Hola' })
    })

    it('optionalNumber: coerces numeric strings, empties to null, NaN errors', () => {
        const n = optionalNumber('Rate')
        expect(n.parse('12.5')).toBe(12.5)
        expect(n.parse(7)).toBe(7)
        expect(n.parse('')).toBeNull()
        expect(n.parse(null)).toBeNull()
        expect(n.parse(undefined)).toBeNull()
        expect(() => n.parse('abc')).toThrow(/Rate must be a number/)
    })

    it('orderIndex: empties default to 0, coerces, rejects fractions', () => {
        expect(orderIndex.parse('')).toBe(0)
        expect(orderIndex.parse(null)).toBe(0)
        expect(orderIndex.parse(undefined)).toBe(0)
        expect(orderIndex.parse('7')).toBe(7)
        expect(orderIndex.parse(3)).toBe(3)
        expect(() => orderIndex.parse('abc')).toThrow(/Order must be a number/)
        expect(() => orderIndex.parse(2.5)).toThrow(/Order must be a whole number/)
    })

    it('uuid: passes a valid uuid, names the label on failure', () => {
        expect(uuid('Item id').parse(VALID_UUID)).toBe(VALID_UUID)
        expect(() => uuid('Item id').parse('nope')).toThrow(/Item id is invalid/)
    })

    it('optionalUuid: empty/null/undefined become null', () => {
        const u = optionalUuid('Brand')
        expect(u.parse('')).toBeNull()
        expect(u.parse(null)).toBeNull()
        expect(u.parse(undefined)).toBeNull()
        expect(u.parse(VALID_UUID)).toBe(VALID_UUID)
        expect(() => u.parse('nope')).toThrow(/Brand is invalid/)
    })

    it('upsertId: empty/absent leaves the key out so DB defaults apply', () => {
        const s = z.object({ id: upsertId('Offer id') })
        expect(s.parse({})).toEqual({})
        expect(s.parse({ id: '' })).toEqual({})
        expect(s.parse({ id: VALID_UUID })).toEqual({ id: VALID_UUID })
        expect(() => s.parse({ id: 'nope' })).toThrow(/Offer id is invalid/)
    })

    it('jsonArray: parses JSON strings, passes arrays, friendly errors otherwise', () => {
        const j = jsonArray('Takeaways')
        expect(j.parse('["a","b"]')).toEqual(['a', 'b'])
        expect(j.parse([1, 2])).toEqual([1, 2])
        expect(j.parse('')).toEqual([])
        expect(j.parse(null)).toEqual([])
        expect(j.parse(undefined)).toEqual([])
        expect(() => j.parse('{not json')).toThrow(/Takeaways contains invalid JSON/)
        expect(() => j.parse('"not-an-array"')).toThrow(/Takeaways must be a list/)
    })

    it('resourceList: accepts a well-formed list from a string or an array', () => {
        const r = resourceList('Resources')
        const list = [{ name: 'Workbook', url: 'https://cdn.example.com/w.pdf' }]
        expect(r.parse(JSON.stringify(list))).toEqual(list)
        expect(r.parse(list)).toEqual(list)
        expect(r.parse('')).toEqual([])
        expect(r.parse(null)).toEqual([])
    })

    it('resourceList: names and links are both required, and links must be http(s)', () => {
        const r = resourceList('Resources')
        expect(() => r.parse([{ name: '  ', url: 'https://cdn.example.com/w.pdf' }]))
            .toThrow(/each file needs a name/)
        expect(() => r.parse([{ name: 'Workbook' }]))
            .toThrow(/each file needs a link/)
        // A resource link is rendered as an <a href>; javascript: must never
        // reach the column, whatever the admin form pastes in.
        expect(() => r.parse([{ name: 'Workbook', url: 'javascript:alert(1)' }]))
            .toThrow(/must start with http/)
        expect(() => r.parse('{not json')).toThrow(/Resources contains invalid JSON/)
        expect(() => r.parse('"not-an-array"')).toThrow(/Resources must be a list/)
    })

    it('booleanish: true only for true/"true"', () => {
        expect(booleanish.parse(true)).toBe(true)
        expect(booleanish.parse('true')).toBe(true)
        expect(booleanish.parse('false')).toBe(false)
        expect(booleanish.parse(null)).toBe(false)
        expect(booleanish.parse(undefined)).toBe(false)
    })
})

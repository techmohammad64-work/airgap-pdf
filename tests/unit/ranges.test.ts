import { describe, expect, it } from 'vitest'
import { chunkPages, formatRanges, parsePageSet, parseRanges } from '../../src/core/ranges'

describe('parseRanges', () => {
  it('parses single pages and ranges into 0-based groups', () => {
    expect(parseRanges('1-3, 5', 10)).toEqual([[0, 1, 2], [4]])
  })
  it('supports open-ended and open-start ranges', () => {
    expect(parseRanges('8-', 10)).toEqual([[7, 8, 9]])
    expect(parseRanges('-2', 10)).toEqual([[0, 1]])
  })
  it('supports reversed ranges', () => {
    expect(parseRanges('3-1', 5)).toEqual([[2, 1, 0]])
  })
  it('accepts semicolons and extra spaces', () => {
    expect(parseRanges(' 1 ; 2 - 3 ', 5)).toEqual([[0], [1, 2]])
  })
  it('rejects out-of-range pages', () => {
    expect(() => parseRanges('11', 10)).toThrow(/outside/)
    expect(() => parseRanges('0', 10)).toThrow(/outside/)
  })
  it('rejects garbage and empty input', () => {
    expect(() => parseRanges('abc', 10)).toThrow(/not a valid/)
    expect(() => parseRanges('  ', 10)).toThrow(/at least one/)
  })
})

describe('parsePageSet', () => {
  it('returns all pages for empty input', () => {
    expect(parsePageSet('', 3)).toEqual([0, 1, 2])
  })
  it('deduplicates and sorts', () => {
    expect(parsePageSet('3, 1-2, 2', 5)).toEqual([0, 1, 2])
  })
})

describe('chunkPages', () => {
  it('splits into groups of n with a shorter last group', () => {
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]])
  })
  it('rejects invalid n', () => {
    expect(() => chunkPages(5, 0)).toThrow()
    expect(() => chunkPages(5, 1.5)).toThrow()
  })
})

describe('formatRanges', () => {
  it('compacts consecutive pages', () => {
    expect(formatRanges([0, 1, 2, 4, 6, 7])).toBe('1-3, 5, 7-8')
    expect(formatRanges([])).toBe('')
  })
})

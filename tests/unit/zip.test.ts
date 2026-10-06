import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { makeZip } from '../../src/core/zip'

describe('makeZip', () => {
  it('stores files and de-duplicates names', () => {
    const z = makeZip([
      { name: 'a.pdf', bytes: new Uint8Array([1]) },
      { name: 'a.pdf', bytes: new Uint8Array([2]) },
      { name: 'b.png', bytes: new Uint8Array([3]) },
    ])
    const files = unzipSync(z)
    expect(Object.keys(files).sort()).toEqual(['a (2).pdf', 'a.pdf', 'b.png'])
    expect([...files['a (2).pdf']]).toEqual([2])
  })
})

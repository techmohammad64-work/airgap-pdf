import { describe, expect, it } from 'vitest'
import { fillForm, listFields } from '../../src/core/forms'
import { makeForm, makePdf } from './helpers'

describe('forms', () => {
  it('lists fields with types and options', async () => {
    const fields = await listFields(await makeForm())
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]))
    expect(byName.name.type).toBe('text')
    expect(byName.agree.type).toBe('checkbox')
    expect(byName.country).toMatchObject({ type: 'dropdown', options: ['Canada', 'India', 'Kenya'] })
    expect(byName.plan).toMatchObject({ type: 'radio', options: ['basic', 'pro'] })
    expect(byName.locked).toMatchObject({ readOnly: true, value: 'fixed' })
  })
  it('returns no fields for a plain PDF', async () => {
    expect(await listFields(await makePdf(1))).toEqual([])
  })
  it('fills values and reads them back', async () => {
    const out = await fillForm(await makeForm(), { name: 'Ada Lovelace', agree: true, country: 'Kenya', plan: 'pro', locked: 'changed' }, false)
    const byName = Object.fromEntries((await listFields(out)).map((f) => [f.name, f.value]))
    expect(byName).toMatchObject({ name: 'Ada Lovelace', agree: true, country: 'Kenya', plan: 'pro', locked: 'fixed' })
  })
  it('flattening removes the fields', async () => {
    const out = await fillForm(await makeForm(), { name: 'Ada' }, true)
    expect(await listFields(out)).toEqual([])
  })
})

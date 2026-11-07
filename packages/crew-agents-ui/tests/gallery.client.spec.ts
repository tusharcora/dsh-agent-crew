import { describe, expect, it } from 'vitest'
import { availableTemplates, fromTemplate, GALLERY } from '../src/client/gallery.ts'
import { en, zh } from '../src/client/locales.ts'

describe('gallery', () => {
  it('hides templates whose name a member already uses, ignoring case', () => {
    const left = availableTemplates([{ name: 'analyst ' }, { name: 'Writer' }])
    expect(left.map(template => template.key)).not.toContain('analyst')
    expect(left.map(template => template.key)).not.toContain('writer')
    expect(left).toHaveLength(GALLERY.length - 2)
  })

  it('fills a new, unsaved member in an unused colour', () => {
    const member = fromTemplate(GALLERY[0]!, [{ face: { body: 'orb', color: '#4D6BFE' } }])
    expect(member.id).toBe('')
    expect(member.name).toBe(GALLERY[0]!.name)
    expect(member.face).toEqual({ body: GALLERY[0]!.body, color: '#E8B4A0' })
  })

  it('has a translated name and description for every template', () => {
    for (const { key } of GALLERY) {
      for (const dictionary of [en, zh] as const) {
        expect(dictionary[`gallery.${key}.name`]).toBeTruthy()
        expect(dictionary[`gallery.${key}.description`]).toBeTruthy()
      }
    }
  })
})

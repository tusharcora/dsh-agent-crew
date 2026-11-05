/** Add or edit one crew member: name, role, instructions, face, abilities and connections; remove after a confirmation. */
import { useId, useState, type ComponentType } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { ConnectionChoice, CrewMember, FileAccess, MemberBody } from '@deepseek-ai/dsh-crew-roster/types'
import type {} from './index.ts'
import css from './MemberEditor.module.css'

const BODIES: readonly MemberBody[] = ['orb', 'block', 'drop', 'bean']
const FILES: readonly FileAccess[] = ['none', 'read', 'write']

/** A new member's starting record; the Host assigns its id on save. */
export const NEW_MEMBER: CrewMember = {
  id: '', name: '', description: '', persona: '', order: 0, connections: [],
  face: { body: 'orb', color: '#4D6BFE' }, abilities: { files: 'none', shell: false, web: true, schedule: false },
}

/** Props of {@link MemberEditor}. */
export interface MemberEditorProps extends PropsLocale<'crew'> {
  readonly initial: CrewMember
  /** Display name of the member being edited, translated for a shipped member. */
  readonly title: string
  readonly connections: readonly ConnectionChoice[]
  readonly Face: ComponentType<CrewFaceProps>
  readonly save: (member: CrewMember) => Promise<{ readonly saved: CrewMember } | { readonly message: string }>
  readonly remove: (id: string) => Promise<string | undefined>
  readonly close: () => void
}

/**
 * Render the form. The lead's abilities and connections are fixed, so it shows only who it is.
 * @param props - the record, connection choices, face component, actions and copy.
 * @returns the editor.
 */
export function MemberEditor({ initial, title, connections, Face, save, remove, close, t }: MemberEditorProps) {
  const [draft, setDraft] = useState(initial)
  const [message, setMessage] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const base = useId()
  const isNew = initial.id === ''
  const edit = (patch: Partial<CrewMember>) => { setDraft({ ...draft, ...patch }) }
  const abilities = (patch: Partial<CrewMember['abilities']>) => { edit({ abilities: { ...draft.abilities, ...patch } }) }
  const run = async (action: () => Promise<string | undefined>) => {
    setBusy(true)
    const failure = await action()
    setBusy(false)
    if (failure === undefined) close()
    else setMessage(failure)
  }
  const onSave = () => run(async () => {
    const result = await save(draft)
    return 'message' in result ? result.message : undefined
  })
  return (
    <form className={css.editor} aria-label={isNew ? t('edit.addTitle') : t('edit.title', { name: title })}
      onSubmit={(event) => { event.preventDefault(); void onSave() }}>
      <div className={css.head}>
        <Face agentId={draft.id === '' ? 'crew-new' : draft.id} design={draft.face} size={40} />
        <h3 className={css.title}>{isNew ? t('edit.addTitle') : t('edit.title', { name: title })}</h3>
      </div>
      <label className={css.field}>{t('edit.name')}
        <input className={css.input} value={draft.name} maxLength={40} required
          onChange={(event) => { edit({ name: event.target.value }) }} />
      </label>
      <div className={css.field}>
        <label className={css.field}>{t('edit.description')}
          <input className={css.input} value={draft.description} maxLength={200} aria-describedby={`${base}-description`}
            onChange={(event) => { edit({ description: event.target.value }) }} />
        </label>
        <span id={`${base}-description`} className={css.hint}>{t('edit.descriptionHint')}</span>
      </div>
      <div className={css.field}>
        <label className={css.field}>{t('edit.persona')}
          <textarea className={css.textarea} rows={6} value={draft.persona} required aria-describedby={`${base}-persona`}
            onChange={(event) => { edit({ persona: event.target.value }) }} />
        </label>
        <span id={`${base}-persona`} className={css.hint}>{t('edit.personaHint', { token: '{{model}}' })}</span>
      </div>
      <fieldset className={css.group}>
        <legend className={css.legend}>{t('edit.face')}</legend>
        <div className={css.bodies}>
          {BODIES.map(body => (
            <label key={body} className={css.body}>
              <input type="radio" name={`${base}-body`} value={body} checked={draft.face.body === body}
                onChange={() => { edit({ face: { ...draft.face, body } }) }} />
              <Face agentId={`${base}-${body}`} design={{ body, color: draft.face.color }} size={28} />
              <span>{t(`edit.body.${body}`)}</span>
            </label>
          ))}
        </div>
        <label className={css.check}>
          <input type="color" className={css.color} value={draft.face.color} onChange={(event) => { edit({ face: { ...draft.face, color: event.target.value } }) }} />
          {t('edit.color')}
        </label>
      </fieldset>
      {draft.lead !== true && <>
        <fieldset className={css.group}>
          <legend className={css.legend}>{t('edit.abilities')}</legend>
          <label className={css.field}>{t('edit.files')}
            <select className={css.input} value={draft.abilities.files}
              onChange={(event) => { abilities({ files: FILES.find(value => value === event.target.value) ?? 'none' }) }}>
              {FILES.map(value => <option key={value} value={value}>{t(`edit.files.${value}`)}</option>)}
            </select>
          </label>
          <label className={css.check}>
            <input type="checkbox" checked={draft.abilities.shell} onChange={(event) => { abilities({ shell: event.target.checked }) }} />
            {t('edit.shell')}
          </label>
          <label className={css.check}>
            <input type="checkbox" checked={draft.abilities.web} onChange={(event) => { abilities({ web: event.target.checked }) }} />
            {t('edit.web')}
          </label>
          <label className={css.check}>
            <input type="checkbox" checked={draft.abilities.schedule} onChange={(event) => { abilities({ schedule: event.target.checked }) }} />
            {t('edit.schedule')}
          </label>
        </fieldset>
        <fieldset className={css.group}>
          <legend className={css.legend}>{t('edit.connections')}</legend>
          {connections.map(choice => (
            <label key={choice.id} className={css.check}>
              <input type="checkbox" checked={draft.connections.includes(choice.id)} disabled={!choice.available}
                onChange={(event) => {
                  const others = draft.connections.filter(id => id !== choice.id)
                  edit({ connections: event.target.checked ? [...others, choice.id] : others })
                }} />
              {choice.available ? choice.label : t('edit.connectionOff', { name: choice.label })}
            </label>
          ))}
        </fieldset>
      </>}
      <div className={css.actions}>
        <Button size="sm" variant="primary" type="submit" disabled={busy}>{isNew ? t('edit.add') : t('edit.save')}</Button>
        <Button size="sm" variant="outline" type="button" onClick={close}>{t('edit.cancel')}</Button>
        <span className={css.grow} />
        {!isNew && draft.lead !== true && !confirming
          && <Button size="sm" variant="ghost" type="button" onClick={() => { setConfirming(true) }}>{t('edit.remove')}</Button>}
      </div>
      {confirming && (
        <div className={css.confirm} role="group" aria-label={t('edit.removeAsk', { name: title })}>
          <span>{t('edit.removeAsk', { name: title })}</span>
          <Button size="sm" variant="primary" type="button" disabled={busy} onClick={() => { void run(() => remove(initial.id)) }}>
            {t('edit.removeConfirm')}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => { setConfirming(false) }}>{t('edit.keep')}</Button>
        </div>
      )}
      <p className={css.message} role="status">{message}</p>
    </form>
  )
}

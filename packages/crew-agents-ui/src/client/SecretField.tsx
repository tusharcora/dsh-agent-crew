/** A write-only secret input: a stored secret shows as stored and can be replaced or removed, never read back. */
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from './index.ts'
import css from './CrewPanel.module.css'

/**
 * Render one secret field.
 * @param props - label, whether a value is stored, save and remove actions, and copy.
 * @returns the form.
 */
export function SecretField({ label, stored, onSave, onRemove, t }: {
  readonly label: string
  readonly stored: boolean
  readonly onSave: (value: string) => Promise<boolean>
  readonly onRemove: () => Promise<boolean>
  readonly t: TranslateNS<'crew'>
}) {
  const id = useId()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (value.trim() === '') return
    setBusy(true)
    void onSave(value.trim()).then((ok) => { if (ok) setValue('') }).finally(() => { setBusy(false) })
  }
  return (
    <form className={css.secret} onSubmit={submit}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="password" autoComplete="off" value={value} placeholder={stored ? t('conn.stored') : ''}
        onChange={(event) => { setValue(event.target.value) }} />
      <Button type="submit" variant="outline" size="sm" disabled={busy || value.trim() === ''}>{t('conn.save')}</Button>
      {stored && <Button variant="ghost" size="sm" disabled={busy}
        onClick={() => { setBusy(true); void onRemove().finally(() => { setBusy(false) }) }}>{t('conn.remove')}</Button>}
    </form>
  )
}

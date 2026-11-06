/**
 * Workflow editor as a visual builder: a palette of crew members and tools, a canvas of action cards you drag into
 * rows (one after another) or beside each other (at the same time), an inspector for the selected card, and a sticky
 * bar for Save, Run and Delete. Every drag has a click or button alternative.
 */
import { useId, useState, type ComponentType, type DragEvent } from 'react'
import {
  Button, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, IconChevronUpOutlineRegular, IconClockOutlineRegular,
  IconPlayOutlineRegular, IconPlusOutlineRegular,
  IconTrashOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { AgentStep, ToolStep, WorkflowDefinition, WorkflowStep } from '@deepseek-ai/dsh-crew-workflows/types'
import { flatten, place, rowsOf, type DropTarget } from './builder.ts'
import type { Member } from './RunView.tsx'
import type {} from './index.ts'
import css from './WorkflowsPage.module.css'

/** Props of {@link Editor}. */
export interface EditorProps {
  readonly initial: WorkflowDefinition
  readonly members: readonly Member[]
  /** Draws a crew member's face on palette chips and cards. */
  readonly Face?: ComponentType<CrewFaceProps>
  /** Save; resolves the saved definition, or the reason it was refused. */
  readonly save: (definition: WorkflowDefinition) => Promise<{ readonly saved: WorkflowDefinition } | { readonly message: string }>
  readonly run: (id: string) => Promise<string | undefined>
  readonly remove: (id: string) => Promise<void>
  /** Back to the workflow list, from the breadcrumb. */
  readonly onBack?: () => void
  /** Show this workflow's runs; absent while it has none. */
  readonly onHistory?: () => void
  readonly t: TranslateNS<'crewWorkflows'>
}

const DRAG_TYPE = 'application/x-dsh-workflow-step'

/** A new card from the palette. */
type FromPalette = { readonly from: 'palette'; readonly kind: 'agent'; readonly preset: string } | { readonly from: 'palette'; readonly kind: 'tool' }

/** What a drag carries: a new card from the palette, or a card already on the canvas. */
type Dragged = FromPalette | { readonly from: 'canvas'; readonly id: string }

let next = 0
function stepId(): string {
  next += 1
  return `step-${String(Date.now())}-${String(next)}`
}

/** Tool-step input as the user typed it, kept separately so a half-typed JSON object stays editable. */
type InputDrafts = Readonly<Record<string, string>>

/**
 * Parse a tool step's typed input.
 * @param text - JSON the user typed.
 * @returns the object, or undefined when it is not a JSON object.
 */
export function parseInput(text: string): ToolStep['input'] | undefined {
  try {
    const value: unknown = JSON.parse(text === '' ? '{}' : text)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as ToolStep['input'] : undefined
  } catch {
    return undefined
  }
}

function readDrag(event: DragEvent): Dragged | undefined {
  try {
    const value: unknown = JSON.parse(event.dataTransfer.getData(DRAG_TYPE))
    return typeof value === 'object' && value !== null && 'from' in value ? value as Dragged : undefined
  } catch {
    return undefined
  }
}

function startDrag(event: DragEvent, payload: Dragged): void {
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = payload.from === 'palette' ? 'copy' : 'move'
}

function MemberMark({ member, Face, size }: { readonly member: Member | undefined; readonly Face: EditorProps['Face']; readonly size: number }) {
  if (member !== undefined && Face !== undefined) {
    return <Face agentId={member.id} size={size} {...member.design === undefined ? {} : { design: member.design }} />
  }
  return <span className={css.tile} data-kind="agent" style={{ width: size, height: size }} aria-hidden="true">{(member?.name ?? '?').slice(0, 1)}</span>
}

/**
 * Edit one workflow.
 * @param props - the definition, crew members, faces, actions and copy.
 * @returns the editor.
 */
export function Editor({ initial, members, Face, save, run, remove, onBack, onHistory, t }: EditorProps) {
  const [draft, setDraft] = useState(initial)
  const [inputs, setInputs] = useState<InputDrafts>(() => Object.fromEntries(initial.steps.flatMap(step => step.kind === 'tool' ? [[step.id, JSON.stringify(step.input, null, 2)]] : [])))
  const [status, setStatus] = useState<{ readonly text: string; readonly bad: boolean } | undefined>()
  const [dirty, setDirty] = useState(initial.id === '' || initial.draft === true)
  const [confirming, setConfirming] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState<string | undefined>()
  const base = useId()
  const edit = (patch: Partial<WorkflowDefinition>) => { setDraft(prev => ({ ...prev, ...patch })); setDirty(true) }
  const setSteps = (steps: readonly WorkflowStep[]) => { edit({ steps: flatten(rowsOf(steps)) }) }
  const editStep = (id: string, patch: Partial<AgentStep> | Partial<ToolStep>) => {
    setSteps(draft.steps.map(step => step.id === id ? { ...step, ...patch } as WorkflowStep : step))
  }
  const move = (index: number, by: -1 | 1) => {
    const steps = [...draft.steps]
    const [step] = steps.splice(index, 1)
    if (step === undefined) return
    steps.splice(index + by, 0, step)
    setSteps(steps)
  }
  const rows = rowsOf(draft.steps)
  const add = (payload: FromPalette, target: DropTarget = { kind: 'row', row: rows.length }) => {
    const id = stepId()
    let step: WorkflowStep
    if (payload.kind === 'agent') step = { id, kind: 'agent', preset: payload.preset, task: '', prompt: '' }
    else {
      setInputs(prev => ({ ...prev, [id]: '{}' }))
      step = { id, kind: 'tool', tool: '', input: {} }
    }
    edit({ steps: place(draft.steps, step, target) })
    setSelectedId(id)
  }
  const drop = (target: DropTarget) => (event: DragEvent) => {
    event.preventDefault()
    setOver(undefined)
    setDragging(false)
    const payload = readDrag(event)
    if (payload === undefined) return
    if (payload.from === 'palette') { add(payload, target); return }
    const step = draft.steps.find(entry => entry.id === payload.id)
    if (step !== undefined) { edit({ steps: place(draft.steps, step, target) }); setSelectedId(step.id) }
  }
  const zone = (key: string, target: DropTarget) => ({
    'data-over': over === key || undefined,
    onDragOver: (event: DragEvent) => { event.preventDefault(); setOver(key) },
    onDragLeave: () => { setOver(prev => prev === key ? undefined : prev) },
    onDrop: drop(target),
  })
  const badOf = (step: WorkflowStep) => step.kind === 'tool' && parseInput(inputs[step.id] ?? '{}') === undefined
  const badInput = draft.steps.some(badOf)
  const onSave = async () => {
    const steps = draft.steps.map(step => step.kind === 'tool' ? { ...step, input: parseInput(inputs[step.id] ?? '{}') ?? {} } : step)
    const result = await save({ ...draft, steps })
    if ('message' in result) { setStatus({ text: result.message, bad: true }); return }
    setDraft(result.saved)
    setDirty(false)
    setStatus({ text: t('saved'), bad: false })
  }
  const onRun = async () => {
    const refusal = await run(draft.id)
    setStatus(refusal === undefined ? undefined : { text: refusal, bad: true })
  }
  const memberOf = (id: string) => members.find(member => member.id === id)
  const selectedIndex = draft.steps.findIndex(step => step.id === selectedId)
  const selected = draft.steps[selectedIndex]
  const numbered = new Map(draft.steps.map((step, index) => [step.id, index + 1]))
  return (
    <form className={css.editor} aria-label={draft.name === '' ? t(draft.kind === 'agentic' ? 'new.agentic' : 'new.fixed') : draft.name}
      onSubmit={(event) => { event.preventDefault(); void onSave() }}>
      <div className={css.topBar}>
        <nav className={css.crumbs} aria-label={t('breadcrumb')}>
          {onBack === undefined
            ? <span>{t('title')}</span>
            : <button type="button" className={css.crumbLink} onClick={onBack}>{t('title')}</button>}
          <IconChevronRightOutlineRegular size={12} />
          <span className={css.crumbHere}>{draft.name === '' ? t('field.namePlaceholder') : draft.name}</span>
        </nav>
        <span className={css.kind} data-kind={draft.kind}>{t(`kind.${draft.kind}`)}</span>
        {draft.draft === true && <span className={css.draftMark}>{t('draft')}</span>}
        <span className={css.saveState} data-dirty={dirty || undefined}>
          <span className={css.saveDot} aria-hidden="true" />
          {dirty ? t(draft.id === '' ? 'notSaved' : 'unsaved') : t('savedState')}
        </span>
        <p className={status?.bad === true ? css.bad : css.muted} role="status">{status?.text}</p>
        <span className={css.grow} />
        {draft.id !== '' && !confirming && <Button size="sm" variant="ghost" type="button" onClick={() => { setConfirming(true) }}>{t('delete')}</Button>}
        {onHistory !== undefined && (
          <Button size="sm" variant="outline" type="button" icon={<IconClockOutlineRegular size={14} />} onClick={onHistory}>{t('history')}</Button>
        )}
        <Button size="sm" variant="outline" type="submit" disabled={badInput}>{t('save')}</Button>
        <Button size="sm" variant="primary" type="button" icon={<IconPlayOutlineRegular size={14} />} disabled={dirty || draft.id === ''}
          title={dirty && draft.id !== '' ? t('run.saveFirst') : undefined} onClick={() => { void onRun() }}>{t('run')}</Button>
      </div>
      {confirming && (
        <div className={css.confirm} role="alertdialog" aria-label={t('deleteAsk', { name: draft.name })}>
          <span>{t('deleteAsk', { name: draft.name })}</span>
          <Button size="sm" variant="primary" type="button" onClick={() => { void remove(draft.id) }}>{t('deleteConfirm')}</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => { setConfirming(false) }}>{t('cancelDelete')}</Button>
        </div>
      )}
      <label className={css.field}>{t('field.name')}
        <input className={css.nameInput} value={draft.name} placeholder={t('field.namePlaceholder')}
          onChange={(event) => { edit({ name: event.target.value }) }} required />
      </label>
      <div className={css.fieldRow}>
        <label className={css.field}>{t('field.description')}
          <input className={css.input} value={draft.description} onChange={(event) => { edit({ description: event.target.value }) }} />
        </label>
        <label className={css.field}>{t('field.cwd')}
          <input className={css.input} value={draft.cwd ?? ''} aria-describedby={`${base}-cwd`} placeholder={t('field.cwdHint')}
            onChange={(event) => {
              const { cwd: _cwd, ...rest } = draft
              setDraft(event.target.value === '' ? rest : { ...rest, cwd: event.target.value })
              setDirty(true)
            }} />
          <span id={`${base}-cwd`} className={css.srOnly}>{t('field.cwdHint')}</span>
        </label>
      </div>

      <div className={css.builder} data-dragging={dragging || undefined} onDragEnd={() => { setDragging(false); setOver(undefined) }}>
        <aside className={css.palette} aria-label={t('palette')}>
          {draft.kind === 'agentic' && (
            <>
              <h3 className={css.sub}>{t('palette.crew')}</h3>
              <ul className={css.paletteList}>
                {members.map(member => (
                  <li key={member.id}>
                    <button type="button" className={css.component} data-kind="agent" draggable
                      onDragStart={(event) => { startDrag(event, { from: 'palette', kind: 'agent', preset: member.id }); setDragging(true) }}
                      onClick={() => { add({ from: 'palette', kind: 'agent', preset: member.id }) }}
                      aria-label={t('palette.addMember', { name: member.name })}>
                      <MemberMark member={member} Face={Face} size={22} />
                      <span className={css.componentName}>{member.name}</span>
                      <IconPlusOutlineRegular size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className={css.sub}>{t('palette.tools')}</h3>
          <button type="button" className={css.component} data-kind="tool" draggable
            onDragStart={(event) => { startDrag(event, { from: 'palette', kind: 'tool' }); setDragging(true) }}
            onClick={() => { add({ from: 'palette', kind: 'tool' }) }} aria-label={t('add.tool')}>
            <span className={css.tile} data-kind="tool" aria-hidden="true">{'{}'}</span>
            <span className={css.componentName}>{t('palette.toolCall')}</span>
            <IconPlusOutlineRegular size={12} />
          </button>
          <p className={css.muted}>{t('palette.hint')}</p>
        </aside>

        <div className={css.canvas} role="group" aria-label={t('canvas')}>
          <p className={css.canvasMeta}>{t('canvas.meta', { steps: draft.steps.length, together: draft.steps.filter(step => step.together === true).length })}</p>
          <span className={css.terminal}>{t('canvas.start')}</span>
          {rows.map((row, r) => (
            <div key={row[0]?.id ?? r} className={css.rowWrap}>
              <div className={css.dropLine} {...zone(`row-${String(r)}`, { kind: 'row', row: r })} aria-hidden="true" />
              <div className={css.canvasRow}>
                {row.map((step) => {
                  const index = numbered.get(step.id) ?? 0
                  const member = step.kind === 'agent' ? memberOf(step.preset) : undefined
                  const title = step.kind === 'agent' ? (step.task === '' ? t('card.untitled') : step.task) : (step.tool === '' ? t('card.noTool') : step.tool)
                  const detail = step.kind === 'agent' ? (member?.name ?? step.preset) : t('step.tool')
                  return (
                    <div key={step.id} className={css.actionCard} data-kind={step.kind} data-selected={step.id === selectedId || undefined}
                      data-bad={badOf(step) || undefined} draggable
                      onDragStart={(event) => { startDrag(event, { from: 'canvas', id: step.id }); setDragging(true) }}>
                      <button type="button" className={css.cardSelect} onClick={() => { setSelectedId(step.id) }}
                        aria-pressed={step.id === selectedId} aria-label={t('card.edit', { index, title })}>
                        <span className={css.cardIndex}>{index}</span>
                        {step.kind === 'agent'
                          ? <MemberMark member={member} Face={Face} size={28} />
                          : <span className={css.tile} data-kind="tool" aria-hidden="true">{'{}'}</span>}
                        <span className={css.cardText}>
                          <span className={css.cardTitle}>{title}</span>
                          <span className={css.cardDetail}>{detail}</span>
                        </span>
                      </button>
                    </div>
                  )
                })}
                <div className={css.joinZone} {...zone(`join-${String(r)}`, { kind: 'join', row: r })} aria-hidden="true">
                  <IconPlusOutlineRegular size={12} />{t('canvas.alongside')}
                </div>
              </div>
            </div>
          ))}
          <div className={rows.length === 0 ? css.emptyDrop : css.dropLine} {...zone('end', { kind: 'row', row: rows.length })}>
            {rows.length === 0 && t('canvas.empty')}
          </div>
          <span className={css.terminal}>{t('canvas.end')}</span>
        </div>

        <aside className={css.inspector} aria-label={selected === undefined ? t('inspector') : t('step.label', { index: selectedIndex + 1 })}>
          {selected === undefined
            ? <p className={css.muted}>{t('inspector.empty')}</p>
            : (
              <>
                <div className={css.stepHead}>
                  <span className={css.stepLabel}>{t('step.label', { index: selectedIndex + 1 })} · {t(selected.kind === 'agent' ? 'step.agent' : 'step.tool')}</span>
                  <span className={css.grow} />
                  <Button size="sm" variant="ghost" type="button" disabled={selectedIndex === 0} aria-label={t('step.up', { index: selectedIndex + 1 })}
                    onClick={() => { move(selectedIndex, -1) }}><IconChevronUpOutlineRegular size={14} /></Button>
                  <Button size="sm" variant="ghost" type="button" disabled={selectedIndex === draft.steps.length - 1}
                    aria-label={t('step.down', { index: selectedIndex + 1 })} onClick={() => { move(selectedIndex, 1) }}>
                    <IconChevronDownOutlineRegular size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" type="button" aria-label={t('step.remove', { index: selectedIndex + 1 })}
                    onClick={() => { setSteps(draft.steps.filter(entry => entry.id !== selected.id)); setSelectedId(undefined) }}>
                    <IconTrashOutlineRegular size={14} />
                  </Button>
                </div>
                {selectedIndex > 0 && (
                  <div className={css.field}>
                    <span>{t('step.runs')}</span>
                    <div className={css.segmented} role="group" aria-label={t('step.runs')}>
                      <button type="button" aria-pressed={selected.together !== true} onClick={() => { editStep(selected.id, { together: false }) }}>
                        {t('step.after')}
                      </button>
                      <button type="button" aria-pressed={selected.together === true} onClick={() => { editStep(selected.id, { together: true }) }}>
                        {t('step.alongside')}
                      </button>
                    </div>
                  </div>
                )}
                {selected.kind === 'agent'
                  ? (
                    <>
                      <label className={css.field}>{t('step.member')}
                        <select className={css.input} value={selected.preset}
                          onChange={(event) => { editStep(selected.id, { preset: event.target.value }) }}>
                          {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                        </select>
                      </label>
                      <label className={css.field}>{t('step.task')}
                        <input className={css.input} value={selected.task}
                          onChange={(event) => { editStep(selected.id, { task: event.target.value }) }} />
                      </label>
                      <label className={css.field}>{t('step.prompt')}
                        <textarea className={css.textarea} rows={6} value={selected.prompt}
                          onChange={(event) => { editStep(selected.id, { prompt: event.target.value }) }} />
                      </label>
                    </>
                  )
                  : (
                    <>
                      <label className={css.field}>{t('step.toolName')}
                        <input className={css.input} value={selected.tool}
                          onChange={(event) => { editStep(selected.id, { tool: event.target.value }) }} />
                      </label>
                      <label className={css.field}>{t('step.input')}
                        <textarea className={css.textarea} rows={6} value={inputs[selected.id] ?? '{}'} spellCheck={false}
                          aria-invalid={badOf(selected)}
                          onChange={(event) => { setInputs({ ...inputs, [selected.id]: event.target.value }); setDirty(true) }} />
                      </label>
                      {badOf(selected) && <p className={css.bad}>{t('step.badInput')}</p>}
                    </>
                  )}
              </>
            )}
        </aside>
      </div>

    </form>
  )
}

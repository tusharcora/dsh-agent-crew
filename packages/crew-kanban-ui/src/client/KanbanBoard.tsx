/** Team task board: a summary, one collapsible group per column, cards you drag or move from a detail sheet, and a toast for each move. */
import { useEffect, useState, type DragEvent } from 'react'
import { Button, IconChevronRightOutlineRegular, IconCloseOutlineRegular, IconWarningOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { TeamProjection, TeamTaskView } from '@deepseek-ai/dsh-agent-team/types'
import type { KanbanColumn } from '@deepseek-ai/dsh-crew-kanban/types'
import { COLUMNS, columnOf, targetsFrom } from './moves.ts'
import type {} from './index.ts'
import css from './KanbanBoard.module.css'

/**
 * Move one task; resolves undefined on success or the reason it was refused.
 * @param task - task as the board showed it.
 * @param from - its column.
 * @param to - target column.
 */
export type MoveTask = (task: TeamTaskView, from: KanbanColumn, to: KanbanColumn) => Promise<string | undefined>

/** Props of {@link KanbanBoard}. */
export interface KanbanBoardProps {
  /** The Lead Session's `agentTeam` projection, undefined while it loads or when Teams is unavailable. */
  readonly team: TeamProjection | undefined
  readonly move: MoveTask
  readonly t: TranslateNS<'crewKanban'>
}

const DRAG_TYPE = 'application/x-dsh-team-task'
const TOAST_MS = 4000

interface CardProps {
  readonly task: TeamTaskView
  readonly column: KanbanColumn
  readonly onOpen: () => void
  readonly t: KanbanBoardProps['t']
}

function Card({ task, column, onOpen, t }: CardProps) {
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: task.id, column }))
    event.dataTransfer.effectAllowed = 'move'
  }
  const scopes = task.writeScopes.slice(0, 2)
  const blocked = task.blockedBy.length > 0 && column === 'blocked'
  return (
    <li className={css.card} data-column={column} draggable={targetsFrom(column).length > 0} onDragStart={onDragStart}>
      <button type="button" className={css.cardButton} onClick={onOpen} aria-label={t('card.open', { id: task.id, subject: task.subject })}>
        <span className={css.cardTop}>
          <span className={css.id}>#{task.id}</span>
          {task.writeScopeWarnings.length > 0 && (
            <span className={css.warn} title={t('warnings', { count: task.writeScopeWarnings.length })}>
              <IconWarningOutlineRegular size={12} />
            </span>
          )}
          <span className={css.owner}>{task.ownerName ?? (task.ownerId === undefined ? t('unowned') : task.ownerId)}</span>
        </span>
        <span className={css.subject}>{task.subject}</span>
        {(blocked || scopes.length > 0) && (
          <span className={css.foot}>
            {blocked && <span className={css.wait}>{t('blockedBy', { ids: task.blockedBy.map(id => `#${id}`).join(', ') })}</span>}
            {scopes.map(scope => <span key={scope} className={css.chip}>{scope}</span>)}
            {task.writeScopes.length > scopes.length && <span className={css.more}>+{task.writeScopes.length - scopes.length}</span>}
          </span>
        )}
      </button>
    </li>
  )
}

interface DetailProps {
  readonly task: TeamTaskView
  readonly column: KanbanColumn
  readonly busy: boolean
  readonly onMove: (to: KanbanColumn) => void
  readonly onClose: () => void
  readonly t: KanbanBoardProps['t']
}

function Detail({ task, column, onMove, onClose, busy, t }: DetailProps) {
  const targets = targetsFrom(column)
  return (
    <aside className={css.sheet} aria-label={t('card.open', { id: task.id, subject: task.subject })}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
      <span className={css.grab} aria-hidden="true" />
      <div className={css.sheetHead}>
        <span className={css.id}>#{task.id}</span>
        <span className={css.pill} data-column={column}>{t(`column.${column}`)}</span>
        <button type="button" className={css.close} onClick={onClose} aria-label={t('detail.close')}><IconCloseOutlineRegular size={14} /></button>
      </div>
      <h3 className={css.detailTitle}>{task.subject}</h3>
      <dl className={css.facts}>
        <dt>{t('detail.owner')}</dt><dd>{task.ownerName ?? task.ownerId ?? t('unowned')}</dd>
        {task.blockedBy.length > 0 && <><dt>{t('detail.blockedBy')}</dt><dd>{task.blockedBy.map(id => <span key={id} className={css.chip}>#{id}</span>)}</dd></>}
        {task.writeScopes.length > 0 && <><dt>{t('detail.scopes')}</dt><dd>{task.writeScopes.map(scope => <span key={scope} className={css.chip}>{scope}</span>)}</dd></>}
      </dl>
      {task.writeScopeWarnings.map(warning => (
        <p key={warning} className={css.callout}><IconWarningOutlineRegular size={14} />{warning}</p>
      ))}
      <h4 className={css.label}>{t('detail.description')}</h4>
      <p className={css.description}>{task.description === '' ? t('detail.none') : task.description}</p>
      {targets.length > 0 && <>
        <h4 className={css.label}>{t('detail.moveTo')}</h4>
        <div className={css.actions}>
          {targets.map(to => (
            <Button key={to} variant={to === 'done' ? 'primary' : 'outline'} disabled={busy} onClick={() => { onMove(to) }}
              aria-label={t('move.to', { column: t(`column.${to}`) })}>
              {t(`column.${to}`)}
            </Button>
          ))}
        </div>
      </>}
      <p className={css.revision}>{t('detail.revision', { revision: task.revision })}</p>
    </aside>
  )
}

/**
 * Render the board for one Team.
 * @param props - projection, move action and copy.
 * @returns the board, or a notice when Teams is off or empty.
 */
export function KanbanBoard({ team, move, t }: KanbanBoardProps) {
  const [openId, setOpenId] = useState<string | undefined>()
  const [over, setOver] = useState<KanbanColumn | undefined>()
  const [status, setStatus] = useState<{ readonly text: string; readonly failed: boolean } | undefined>()
  const [busy, setBusy] = useState(false)
  // Done starts folded: finished work matters least on a busy board.
  const [folded, setFolded] = useState<ReadonlySet<KanbanColumn>>(() => new Set(['done']))
  useEffect(() => {
    if (status === undefined || status.failed) return
    const timer = setTimeout(() => { setStatus(undefined) }, TOAST_MS)
    return () => { clearTimeout(timer) }
  }, [status])
  // agent-team initializes its projection for every Session, so none at all means this dsh has no agent teams.
  if (team === undefined) return <p className={css.notice}>{t('unavailable')}</p>
  if (!team.enabled) return <p className={css.notice}>{t('off')}</p>
  const tasks = team.tasks.flatMap((task) => {
    const column = columnOf(task)
    return column === undefined ? [] : [{ task, column }]
  })
  const run = async (task: TeamTaskView, from: KanbanColumn, to: KanbanColumn) => {
    if (busy || !targetsFrom(from).includes(to)) return
    setBusy(true)
    const refusal = await move(task, from, to)
    setBusy(false)
    setStatus(refusal === undefined
      ? { text: t('moved', { id: task.id, column: t(`column.${to}`) }), failed: false }
      : { text: t('moveFailed', { id: task.id, message: refusal }), failed: true })
  }
  const onDrop = (to: KanbanColumn) => (event: DragEvent) => {
    event.preventDefault()
    setOver(undefined)
    let dragged: { id?: unknown; column?: unknown }
    try { dragged = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as typeof dragged } catch { return }
    const found = tasks.find(entry => entry.task.id === dragged.id && entry.column === dragged.column)
    if (found !== undefined) void run(found.task, found.column, to)
  }
  const toggle = (column: KanbanColumn) => {
    setFolded((prev) => {
      const next = new Set(prev)
      if (!next.delete(column)) next.add(column)
      return next
    })
  }
  const count = (column: KanbanColumn) => tasks.filter(entry => entry.column === column).length
  const opened = tasks.find(entry => entry.task.id === openId)
  return (
    <div className={css.frame}>
      <div className={css.root}>
        <header className={css.head}>
          <div className={css.headText}>
            <h2 className={css.title}>{t('tab.title')}</h2>
            <p className={css.summary}>{t('summary', { total: tasks.length, done: count('done'), blocked: count('blocked') })}</p>
          </div>
          {count('in_progress') > 0 && <span className={css.pill} data-column="in_progress">{t('summary.active', { count: count('in_progress') })}</span>}
        </header>
        {tasks.length > 0 && (
          <div className={css.progress} aria-hidden="true">
            {[...COLUMNS].reverse().map(column => <i key={column} data-column={column} style={{ flexGrow: count(column) }} />)}
          </div>
        )}
        {team.failure !== undefined && <p className={css.error} role="alert">{t('failure', { message: team.failure })}</p>}
        {tasks.length === 0 ? <p className={css.notice}>{t('empty')}</p> : <p className={css.hint}>{t('move.hint')}</p>}
        <div className={css.board}>
          {COLUMNS.map((column) => {
            const cards = tasks.filter(entry => entry.column === column)
            const open = !folded.has(column)
            return (
              <section key={column} className={css.column} data-over={over === column || undefined}
                aria-label={t('column.label', { column: t(`column.${column}`), count: cards.length })}
                onDragOver={(event) => { event.preventDefault(); setOver(column) }}
                onDragLeave={() => { setOver(undefined) }} onDrop={onDrop(column)}>
                <h3 className={css.columnHead}>
                  <button type="button" className={css.columnToggle} data-column={column} aria-expanded={open} onClick={() => { toggle(column) }}>
                    <span className={css.dot} aria-hidden="true" />
                    {t(`column.${column}`)} <span className={css.count}>{cards.length}</span>
                    <span className={css.chevron} aria-hidden="true"><IconChevronRightOutlineRegular size={12} /></span>
                  </button>
                </h3>
                {open && (
                  <ul className={css.cards}>
                    {cards.length === 0 && <li className={css.emptyColumn}>{t('empty.column')}</li>}
                    {cards.map(({ task }) => (
                      <Card key={task.id} task={task} column={column} onOpen={() => { setOpenId(task.id) }} t={t} />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      </div>
      {opened !== undefined && <>
        <div className={css.scrim} onClick={() => { setOpenId(undefined) }} aria-hidden="true" />
        <Detail task={opened.task} column={opened.column} busy={busy} t={t}
          onMove={(to) => { void run(opened.task, opened.column, to) }} onClose={() => { setOpenId(undefined) }} />
      </>}
      <p className={css.toast} data-failed={status?.failed === true || undefined} role="status">{status?.text}</p>
    </div>
  )
}

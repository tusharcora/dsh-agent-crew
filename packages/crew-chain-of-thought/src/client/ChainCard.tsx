/** Chain-of-thought card: each step of a Turn as it happens, then a one-line summary that expands. */
import { useEffect, useId, useState } from 'react'
import {
  IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, IconCodeOutlineRegular, IconCordisPluginOutlineRegular,
  IconGlobeOutlineRegular, IconSearchOutlineRegular, IconThinkOutlineRegular, IconUsersOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { ChainStep } from './chain.ts'
import type {} from './index.ts'
import css from './ChainCard.module.css'

type Props = Pick<PropsRuntime<'conversation.chat.node', 'crew-chain'>, 'node'> & PropsLocale<'crewChain'>

const SECONDS = new Intl.NumberFormat(undefined, {
  style: 'unit', unit: 'second', unitDisplay: 'narrow', minimumFractionDigits: 1, maximumFractionDigits: 1,
})

/**
 * Localized seconds with one decimal under a minute, else a `m:ss` clock.
 * @param ms - duration in milliseconds.
 * @returns a short duration.
 */
export function duration(ms: number): string {
  const seconds = Math.max(0, ms) / 1000
  if (seconds < 60) return SECONDS.format(seconds)
  const whole = Math.round(seconds)
  return [Math.floor(whole / 60), whole % 60].map((part, index) => String(part).padStart(index === 0 ? 1 : 2, '0')).join(':')
}

/**
 * A tool name as words: `mcp__exa__web_search` becomes "exa web search".
 * @param name - wire tool name.
 * @returns readable name.
 */
export function toolLabel(name: string): string {
  return name.replace(/^mcp__/, '').replace(/__|_/g, ' ').trim()
}

function ToolIcon({ name }: { readonly name: string }) {
  const lower = name.toLowerCase()
  if (lower.includes('search')) return <IconSearchOutlineRegular size={14} />
  if (lower.includes('fetch') || lower.includes('browse') || lower.includes('url')) return <IconGlobeOutlineRegular size={14} />
  if (lower === 'run_code' || lower.includes('bash') || lower.includes('code')) return <IconCodeOutlineRegular size={14} />
  if (lower.startsWith('ask_') || lower.includes('agent')) return <IconUsersOutlineRegular size={14} />
  return <IconCordisPluginOutlineRegular size={14} />
}

/** Re-render once a second while `running`. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(timer) }
  }, [running])
  return now
}

function Step({ step, now, t }: { readonly step: ChainStep; readonly now: number; readonly t: Props['t'] }) {
  if (step.kind === 'thought') {
    return (
      <li className={css.step}>
        <span className={css.icon}><IconThinkOutlineRegular size={14} /></span><span className={css.text}>{step.text}</span>
      </li>
    )
  }
  const state = step.endedAt === undefined ? t('running') : step.failed === true ? t('failed') : duration(step.endedAt - step.startedAt)
  return (
    <li className={css.step} data-failed={step.failed === true || undefined}>
      <span className={css.icon}><ToolIcon name={step.name} /></span>
      <span className={css.text}>
        {toolLabel(step.name)}
        {step.detail !== undefined && <> <code className={css.detail}>{step.detail}</code></>}
        {step.sources.length > 0 && (
          <span className={css.sources}>
            {t('sources')}
            {step.sources.map(host => <span key={host} className={css.source} title={host}>{host}</span>)}
          </span>
        )}
      </span>
      <span className={css.meta} aria-live={step.endedAt === undefined ? 'polite' : undefined}>
        {step.endedAt === undefined && now >= step.startedAt ? `${state} ${duration(now - step.startedAt)}` : state}
      </span>
    </li>
  )
}

/**
 * Render one Turn's chain.
 * @param props - the Chat node and copy.
 * @returns the card.
 */
export function ChainCard({ node, t }: Props) {
  const { steps, startedAt, endedAt } = node.data
  const running = endedAt === undefined
  const now = useNow(running)
  // Open while the Turn runs; the user's own toggle wins once made.
  const [chosen, setChosen] = useState<boolean | undefined>()
  const open = chosen ?? running
  const listId = useId()
  const elapsed = duration((endedAt ?? now) - startedAt)
  return (
    <section className={css.card} aria-label={running ? t('title.running') : t('title.done', { time: elapsed })}>
      <button type="button" className={css.header} aria-expanded={open} aria-controls={listId}
        aria-label={open ? t('collapse') : t('expand')} onClick={() => { setChosen(!open) }}>
        <span className={css.pulse} data-running={running || undefined} aria-hidden="true" />
        <span className={css.title}>{running ? t('title.running') : t('title.done', { time: elapsed })}</span>
        <span className={css.count}>{t('steps', { count: steps.length })}</span>
        {open ? <IconChevronDownOutlineRegular size={14} /> : <IconChevronRightOutlineRegular size={14} />}
      </button>
      {open && (
        <ol id={listId} className={css.steps}>
          {steps.map(step => <Step key={step.key} step={step} now={now} t={t} />)}
        </ol>
      )}
      {running && <p className={css.footer} aria-live="off">{t('elapsed', { time: elapsed })}</p>}
    </section>
  )
}

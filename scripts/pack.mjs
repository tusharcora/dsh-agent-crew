#!/usr/bin/env node
/**
 * Stage the crew packages for npm: rename them to unscoped `dsh-agent-crew-*`, replace `workspace:` specs with real
 * version ranges, and `npm pack` each one into `dist/tarballs`.
 *
 * The packages build only inside a DeepSeek Harness checkout, so this reads their built output from there:
 *
 *   node scripts/pack.mjs ~/Developer/deepseek-harness-fork/packages/experimental
 *
 * Publish afterwards with `node scripts/pack.mjs <dir> --publish` (runs `npm publish` on every tarball, bundle last).
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT_PACKAGE = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const VERSION = ROOT_PACKAGE.version
const REPOSITORY = 'tusharcora/dsh-agent-crew'

/** dsh core the packages are built and tested against; stock dsh keeps its 0.2.x API until 0.3.0. */
export const CORE_RANGE = '>=0.2.2-rc.1 <0.3.0'
/** Vendored libraries, at the versions dsh 0.2.2-rc.1 itself depends on. */
export const VENDOR_RANGES = {
  '@deepseek-ai/cordis': '~4.1.0',
  '@deepseek-ai/cordis-plugin-include': '~1.1.0',
  '@deepseek-ai/schemastery': '~3.19.0',
}
const BUNDLE = 'dsh-agent-crew'
const BASE_KEYWORDS = ['dsh', 'dsh-plugin', 'deepseek-harness', 'deepseek-harness-plugin', 'deepseek', 'dsh-agent-crew']
const BUNDLE_KEYWORDS = [
  ...BASE_KEYWORDS, 'agent-orchestrator', 'agent-orchestration', 'multi-agent', 'ai-agents', 'ai-agent', 'subagents',
  'agent-team', 'human-in-the-loop', 'chief-of-staff', 'kanban', 'workflow', 'llm', 'cordis',
]
const BUNDLE_DESCRIPTION = 'Agent orchestrator plugin for DeepSeek Harness (dsh): a Chief of staff that delegates to '
  + 'specialist subagents, with a task board, handoffs, workflows and approval cards for every irreversible action'
const TEXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.json', '.yml', '.yaml', '.md', '.map', '.css'])
const SKIP = new Set(['node_modules', 'tests', '.turbo'])

/**
 * Rewrite crew package names in a text.
 * @param {string} text - file content.
 * @returns {string} the content with every `@deepseek-ai/dsh-crew-*` name unscoped.
 */
export function renameText(text) {
  return text
    .replace(/@deepseek-ai\/dsh-crew-agents(?![\w-])/g, BUNDLE)
    .replace(/@deepseek-ai\/dsh-crew-/g, `${BUNDLE}-`)
}

/**
 * Replace one dependency spec with a publishable range.
 * @param {string} name - dependency name, already renamed.
 * @param {string} spec - spec from the workspace manifest.
 * @returns {string} the range to publish.
 */
export function publishSpec(name, spec) {
  if (name === BUNDLE || name.startsWith(`${BUNDLE}-`)) return VERSION
  if (!spec.startsWith('workspace:')) return spec
  if (spec === 'workspace:*' && name.startsWith('@deepseek-ai/dsh-')) return CORE_RANGE
  const range = VENDOR_RANGES[name]
  if (range === undefined) throw new Error(`no published range for ${name} (${spec})`)
  return range
}

/**
 * Turn a renamed workspace manifest into the one npm gets.
 * @param {Record<string, any>} manifest - parsed package.json after `renameText`.
 * @param {string} directory - package directory name inside `packages/`.
 * @returns {Record<string, any>} the publishable manifest.
 */
export function publishManifest(manifest, directory) {
  const out = { ...manifest, version: VERSION }
  delete out.devDependencies
  delete out.publishConfig
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (out[field] === undefined) continue
    out[field] = Object.fromEntries(Object.entries(out[field]).map(([name, spec]) => [name, publishSpec(name, spec)]))
  }
  // dsh supplies its own packages and React at runtime; some (dsh-agent-team) are not on npm at all.
  if (out.peerDependencies !== undefined) {
    out.peerDependenciesMeta = Object.fromEntries(Object.keys(out.peerDependencies).map(name => [name, { optional: true }]))
  }
  const bundle = out.name === BUNDLE
  if (bundle) out.description = BUNDLE_DESCRIPTION
  out.keywords = bundle ? BUNDLE_KEYWORDS : BASE_KEYWORDS
  out.license = 'MIT'
  out.author = 'Tushar (https://github.com/tusharcora)'
  out.repository = { type: 'git', url: `git+https://github.com/${REPOSITORY}.git`, directory: `packages/${directory}` }
  out.homepage = `https://github.com/${REPOSITORY}#readme`
  out.bugs = { url: `https://github.com/${REPOSITORY}/issues` }
  out.engines = { ...out.engines, dsh: CORE_RANGE }
  if (Array.isArray(out.files) && !out.files.includes('LICENSE')) out.files = [...out.files, 'LICENSE']
  const left = JSON.stringify(out).match(/"workspace:[^"]*"|@deepseek-ai\/dsh-crew-/)
  if (left !== null) throw new Error(`${directory}: ${left[0]} survived staging`)
  return out
}

function rewriteTree(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) { rewriteTree(path); continue }
    if (!TEXT.has(extname(entry))) continue
    const text = readFileSync(path, 'utf8')
    const next = renameText(text)
    if (next !== text) writeFileSync(path, next)
  }
}

function stage(source, out) {
  const directories = readdirSync(source).filter(name => name.startsWith('crew-') && existsSync(join(source, name, 'package.json')))
  if (directories.length === 0) throw new Error(`no crew-* packages under ${source}`)
  const staged = []
  for (const directory of directories) {
    const from = join(source, directory)
    if (!existsSync(join(from, 'lib'))) throw new Error(`${directory} has no lib/; build the dsh checkout first`)
    const to = join(out, 'packages', directory)
    cpSync(from, to, { recursive: true, filter: path => !SKIP.has(path.split('/').at(-1)) && !path.endsWith('.tsbuildinfo') })
    rewriteTree(to)
    const manifest = publishManifest(JSON.parse(readFileSync(join(to, 'package.json'), 'utf8')), directory)
    writeFileSync(join(to, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    cpSync(join(ROOT, 'LICENSE'), join(to, 'LICENSE'))
    staged.push({ directory, name: manifest.name, path: to })
  }
  return staged
}

function published(name) {
  try {
    return execFileSync('npm', ['view', `${name}@${VERSION}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === VERSION
  } catch {
    return false
  }
}

function main(argv) {
  const [source, ...flags] = argv
  if (source === undefined) throw new Error('usage: node scripts/pack.mjs <dsh-checkout>/packages/experimental [--publish]')
  const out = join(ROOT, 'dist')
  rmSync(out, { recursive: true, force: true })
  mkdirSync(join(out, 'tarballs'), { recursive: true })
  const staged = stage(resolve(source), out)
  for (const pkg of staged) {
    execFileSync('npm', ['pack', '--silent', '--pack-destination', join(out, 'tarballs')], { cwd: pkg.path, stdio: ['ignore', 'pipe', 'inherit'] })
    console.log(`packed ${pkg.name}@${VERSION}`)
  }
  if (flags.includes('--publish')) {
    // The bundle goes last so every package it depends on is already on the registry.
    for (const pkg of [...staged.filter(p => p.name !== BUNDLE), ...staged.filter(p => p.name === BUNDLE)]) {
      // A retry after a partial run: npm refuses to publish a version twice, so skip the ones already there.
      if (published(pkg.name)) { console.log(`skipped ${pkg.name}@${VERSION}: already on npm`); continue }
      execFileSync('npm', ['publish', '--access', 'public'], { cwd: pkg.path, stdio: 'inherit' })
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))

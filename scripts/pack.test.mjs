import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CORE_RANGE, publishManifest, publishSpec, renameText } from './pack.mjs'

test('renameText unscopes crew names without touching the bundle prefix of other packages', () => {
  assert.equal(renameText("name: '@deepseek-ai/dsh-crew-agents'"), "name: 'dsh-agent-crew'")
  assert.equal(renameText('@deepseek-ai/dsh-crew-agents/client'), 'dsh-agent-crew/client')
  assert.equal(renameText('"@deepseek-ai/dsh-crew-agents-ui"'), '"dsh-agent-crew-agents-ui"')
  assert.equal(renameText('@deepseek-ai/dsh-crew-roster/types'), 'dsh-agent-crew-roster/types')
  assert.equal(renameText('@deepseek-ai/dsh-tools'), '@deepseek-ai/dsh-tools')
})

test('publishSpec gives real ranges', () => {
  assert.equal(publishSpec('@deepseek-ai/dsh-tools', 'workspace:*'), CORE_RANGE)
  assert.equal(publishSpec('@deepseek-ai/cordis', 'workspace:~'), '~4.1.0')
  assert.equal(publishSpec('dsh-agent-crew-roster', 'workspace:*'), '0.1.0')
  assert.equal(publishSpec('react', '^18.2.0'), '^18.2.0')
  assert.throws(() => publishSpec('@deepseek-ai/unknown', 'workspace:~'), /no published range/)
})

test('publishManifest leaves no workspace specs and marks peers optional', () => {
  const out = publishManifest({
    name: 'dsh-agent-crew-kanban', version: '0.2.2-rc.1', files: ['lib'],
    publishConfig: { access: 'public' },
    dependencies: { '@deepseek-ai/schemastery': 'workspace:~' },
    peerDependencies: { '@deepseek-ai/dsh-agent-team': 'workspace:*', 'dsh-agent-crew-faces': 'workspace:*' },
    devDependencies: { '@deepseek-ai/dsh-agent-team': 'workspace:*' },
  }, 'crew-kanban')
  assert.equal(out.version, '0.1.0')
  assert.deepEqual(out.dependencies, { '@deepseek-ai/schemastery': '~3.19.0' })
  assert.deepEqual(out.peerDependencies, { '@deepseek-ai/dsh-agent-team': CORE_RANGE, 'dsh-agent-crew-faces': '0.1.0' })
  assert.deepEqual(out.peerDependenciesMeta['@deepseek-ai/dsh-agent-team'], { optional: true })
  assert.equal(out.devDependencies, undefined)
  assert.equal(out.repository.directory, 'packages/crew-kanban')
  assert.ok(out.files.includes('LICENSE'))
  assert.throws(() => publishManifest({ name: 'x', dependencies: { y: 'workspace:^' } }, 'crew-x'), /no published range/)
})

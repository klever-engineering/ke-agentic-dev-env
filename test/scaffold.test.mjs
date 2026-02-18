import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runScaffold } from '../src/scaffold.mjs';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test('foundation profile generates baseline files', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agentic-foundation-'));

  await runScaffold({
    mode: 'init',
    targetDir: dir,
    profile: 'foundation',
    projectName: 'Demo Project',
    org: 'demo-org',
    repo: 'demo-repo',
    force: false,
    dryRun: false
  });

  assert.equal(await exists(path.join(dir, 'AGENTS.md')), true);
  assert.equal(await exists(path.join(dir, 'scripts/ci/preflight.sh')), true);
  assert.equal(await exists(path.join(dir, 'scripts/ai/validate_provider.sh')), true);
  assert.equal(await exists(path.join(dir, 'schemas/context-snapshot.schema.json')), false);
});

test('context-ops profile overrides agent-context and adds advanced context assets', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agentic-context-'));

  await runScaffold({
    mode: 'init',
    targetDir: dir,
    profile: 'context-ops',
    projectName: 'Context Project',
    org: 'demo-org',
    repo: 'demo-repo',
    force: false,
    dryRun: false
  });

  const contract = JSON.parse(await readFile(path.join(dir, 'agent-context.json'), 'utf8'));
  assert.equal(contract.version, '2.0.0');
  assert.equal(await exists(path.join(dir, 'schemas/context-snapshot.schema.json')), true);
  assert.equal(await exists(path.join(dir, 'scripts/context/collect_all.sh')), true);
  assert.equal(await exists(path.join(dir, 'scripts/context/collect_code.sh')), true);
  assert.equal(await exists(path.join(dir, 'scripts/context/collect_environment.sh')), true);
  assert.equal(await exists(path.join(dir, 'scripts/context/build_knowledge_layer.mjs')), true);
  assert.equal(await exists(path.join(dir, 'context-engineering/sources/catalog.yaml')), true);
  assert.equal(await exists(path.join(dir, 'context-engineering/sources/knowledge/README.md')), true);
  assert.equal(await exists(path.join(dir, 'doc/agents/context-engineering/context-ops-program.md')), true);
});

test('full profile includes MCP and skills assets', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agentic-full-'));

  await runScaffold({
    mode: 'init',
    targetDir: dir,
    profile: 'full',
    projectName: 'Full Project',
    org: 'demo-org',
    repo: 'demo-repo',
    force: false,
    dryRun: false
  });

  assert.equal(await exists(path.join(dir, '.vscode/mcp.json')), true);
  assert.equal(await exists(path.join(dir, 'skills/catalog.yaml')), true);
  assert.equal(await exists(path.join(dir, 'scripts/mcp/mcp-wrapper.sh')), true);
});

test('wrap mode keeps existing file when force is false', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agentic-wrap-'));
  const agentsPath = path.join(dir, 'AGENTS.md');

  await writeFile(agentsPath, 'custom-handbook', 'utf8');

  await runScaffold({
    mode: 'wrap',
    targetDir: dir,
    profile: 'foundation',
    projectName: 'Wrap Project',
    org: 'demo-org',
    repo: 'demo-repo',
    force: false,
    dryRun: false
  });

  const current = await readFile(agentsPath, 'utf8');
  assert.equal(current, 'custom-handbook');
});

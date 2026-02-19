#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { PROFILES, runScaffold } from './scaffold.mjs';

const MAJOR_PROVIDERS = ['openai', 'anthropic', 'gemini'];
const MANAGED_AGENTS_START = '<!-- klever:managed:start -->';
const MANAGED_AGENTS_END = '<!-- klever:managed:end -->';

const FLAG_CONFIG = {
  '--profile': { key: 'profile', type: 'value' },
  '--project-name': { key: 'projectName', type: 'value' },
  '--org': { key: 'org', type: 'value' },
  '--repo': { key: 'repo', type: 'value' },
  '--llm-provider': { key: 'llmProvider', type: 'value' },
  '--build-knowledge': { key: 'buildKnowledge', type: 'boolean' },
  '--force': { key: 'force', type: 'boolean' },
  '--dry-run': { key: 'dryRun', type: 'boolean' },
  '--yes': { key: 'yes', type: 'boolean' },
  '--json': { key: 'json', type: 'boolean' },
  '--write': { key: 'write', type: 'boolean' },
  '--id': { key: 'sourceId', type: 'value' },
  '--domain': { key: 'sourceDomain', type: 'value' },
  '--owner': { key: 'sourceOwner', type: 'value' },
  '--cadence': { key: 'sourceCadence', type: 'value' },
  '--ttl': { key: 'sourceTtl', type: 'value' },
  '--catalog': { key: 'catalogPath', type: 'value' },
  '--scan-executor': { key: 'scanExecutor', type: 'value' },
  '--scan-method': { key: 'scanMethod', type: 'value' }
};

function defaultOptions() {
  return {
    profile: 'foundation',
    projectName: '',
    org: 'your-org',
    repo: '',
    llmProvider: '',
    buildKnowledge: false,
    force: false,
    dryRun: false,
    yes: false,
    json: false,
    write: false,
    sourceId: '',
    sourceDomain: 'code',
    sourceOwner: 'engineering',
    sourceCadence: 'on_change',
    sourceTtl: '720',
    catalogPath: '',
    scanExecutor: 'auto',
    scanMethod: 'deep'
  };
}

function printHelp() {
  const profileList = PROFILES.join(', ');
  console.log(`
klever - Generic Agentic Environment CLI

Usage:
  klever init [target-dir] [options]
  klever wrap [target-dir] [options]
  klever scan [target-dir] [options]
  klever add <git-repository-url> [target-dir] [options]

Commands:
  init    Create a fresh agentic workspace scaffold.
  wrap    Add agentic scaffold files to an existing repository.
  scan    Inspect workspace readiness and build repository context artifacts.
  add     Clone a repository into /repositories and register it in context catalog.

Init/Wrap options:
  --profile <name>         Profile to apply (${profileList}).
  --project-name <name>    Display name used in templates.
  --org <name>             GitHub organization/user placeholder.
  --repo <name>            Repository name placeholder.
  --llm-provider <name>    One of: openai, anthropic, gemini, auto.
  --build-knowledge        Run initial LLM knowledge-layer build after scaffold (context-ops/full).
  --force                  Overwrite files that already exist.
  --dry-run                Print planned changes without writing files.
  --yes                    Non-interactive mode.

Scan options:
  --json                   Print JSON output.
  --write                  Persist scan report to context-engineering/scan/scan-summary.json.
  --scan-executor <name>   auto | llm-api | codex | copilot | claude | gemini.
  --scan-method <name>     quick | deep (default: deep).

Add options:
  --id <value>             Source id override.
  --domain <value>         Source domain (default: code).
  --owner <value>          Source owner (default: engineering).
  --cadence <value>        Refresh cadence (default: on_change).
  --ttl <hours>            TTL in hours (default: 720).
  --catalog <path>         Custom catalog path.

General:
  -h, --help               Show this help.
`);
}

function parseArgs(argv) {
  const result = {
    positional: [],
    options: defaultOptions()
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('-')) {
      result.positional.push(token);
      continue;
    }

    if (token === '-h' || token === '--help') {
      result.options.help = true;
      continue;
    }

    const config = FLAG_CONFIG[token];
    if (!config) {
      throw new Error(`Unknown option: ${token}`);
    }

    if (config.type === 'boolean') {
      result.options[config.key] = true;
      continue;
    }

    const nextValue = argv[i + 1];
    if (!nextValue || nextValue.startsWith('-')) {
      throw new Error(`Missing value for ${token}`);
    }

    result.options[config.key] = nextValue;
    i += 1;
  }

  return result;
}

function normalizeProvider(input) {
  const value = String(input || '').trim().toLowerCase();
  if (!value) {
    return '';
  }
  if (value === 'auto') {
    return 'auto';
  }
  if (MAJOR_PROVIDERS.includes(value)) {
    return value;
  }
  return '';
}

function getProviderToken(provider) {
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY || '';
  }
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_API_KEY || '';
  }
  if (provider === 'gemini') {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  }
  return '';
}

function setProviderToken(provider, token) {
  if (provider === 'openai') {
    process.env.OPENAI_API_KEY = token;
    return;
  }
  if (provider === 'anthropic') {
    process.env.ANTHROPIC_API_KEY = token;
    return;
  }
  if (provider === 'gemini') {
    process.env.GEMINI_API_KEY = token;
  }
}

function configuredProviders() {
  return MAJOR_PROVIDERS.filter((provider) => getProviderToken(provider));
}

async function promptLine(question, defaultValue = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    const answer = await rl.question(`${question}${suffix}: `);
    const normalized = answer.trim();
    return normalized || defaultValue;
  } finally {
    rl.close();
  }
}

async function promptHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return '';
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = '';

    stdout.write(question);
    stdin.resume();
    stdin.setRawMode?.(true);
    stdin.setEncoding('utf8');

    const onData = (char) => {
      if (char === '\u0003') {
        stdout.write('\n');
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.exit(1);
      }

      if (char === '\r' || char === '\n') {
        stdout.write('\n');
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        resolve(value.trim());
        return;
      }

      if (char === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    };

    stdin.on('data', onData);
  });
}

async function collectLlmSetup(options) {
  const interactive = process.stdin.isTTY && process.stdout.isTTY && !options.yes;
  let provider = normalizeProvider(options.llmProvider || process.env.LLM_PROVIDER || '');

  if (!provider && interactive) {
    provider = normalizeProvider(await promptLine('Select LLM provider (openai|anthropic|gemini)', 'openai'));
  }

  if (!provider) {
    provider = 'auto';
  }

  if (provider === 'auto') {
    const configured = configuredProviders();

    if (configured.length === 1) {
      provider = configured[0];
    } else if (configured.length > 1) {
      provider = interactive
        ? normalizeProvider(
            await promptLine(
              `Multiple provider keys detected (${configured.join(', ')}). Select provider`,
              configured[0]
            )
          )
        : configured[0];
    } else if (interactive) {
      provider = normalizeProvider(await promptLine('No provider key found in environment. Select provider', 'openai'));
    } else {
      throw new Error(
        'No LLM provider token found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY/GOOGLE_API_KEY.'
      );
    }
  }

  if (!MAJOR_PROVIDERS.includes(provider)) {
    throw new Error(`Invalid LLM provider: ${provider}`);
  }

  let token = getProviderToken(provider);
  if (!token) {
    if (!interactive) {
      throw new Error(
        `Missing API token for ${provider}. Set ${provider === 'openai' ? 'OPENAI_API_KEY' : provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY or GOOGLE_API_KEY'} in environment.`
      );
    }

    token = await promptHidden(`Enter ${provider.toUpperCase()} API key (input hidden, not persisted): `);
    if (!token) {
      throw new Error(`No API key provided for ${provider}`);
    }

    setProviderToken(provider, token);
  }

  process.env.LLM_PROVIDER = provider;
  return { provider };
}

async function shouldBuildKnowledge(options, profile) {
  if (!(profile === 'context-ops' || profile === 'full')) {
    return false;
  }

  if (options.buildKnowledge) {
    return true;
  }

  if (options.yes || !process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const answer = await promptLine('Run initial knowledge-layer build now', 'y');
  return ['y', 'yes'].includes(String(answer).trim().toLowerCase());
}

async function runKnowledgeBuild(targetDir, provider) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/context/build_knowledge_layer.mjs', '--provider', provider], {
      cwd: targetDir,
      stdio: 'inherit',
      env: process.env
    });

    child.on('close', (code) => {
      resolve(code === null ? 1 : code);
    });
  });
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function slugifySourceId(input) {
  const normalized = String(input)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^git@/, '')
    .replace(/[/:.#?=&]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || `source-${Date.now()}`;
}

function parseRepositoryRef(source) {
  const value = String(source).trim();

  let match = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }

  match = value.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }

  return null;
}

async function runProcess(command, args, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function runQuietProcess(command, args, cwd, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'ignore'
    });

    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function commandExists(command, root) {
  const code = await runQuietProcess('bash', ['-lc', `command -v ${command} >/dev/null 2>&1`], root);
  return code === 0;
}

async function cloneRepositoryIntoWorkspace(source, root) {
  const repositoriesDir = path.join(root, 'repositories');
  await mkdir(repositoriesDir, { recursive: true });

  const parsed = parseRepositoryRef(source);
  const fallbackName = path.basename(String(source).replace(/\/+$/, '')).replace(/\.git$/i, '');
  const repoName = parsed ? parsed.repo : fallbackName || slugifySourceId(source);
  const destination = path.join(repositoriesDir, repoName);

  if (await pathExists(destination)) {
    return { destination, repoName, cloned: false };
  }

  let cloned = false;

  if (parsed) {
    const ghTarget = `${parsed.owner}/${parsed.repo}`;
    const ghCode = await runProcess('gh', ['repo', 'clone', ghTarget, destination], root);
    if (ghCode === 0) {
      cloned = true;
    }
  }

  if (!cloned) {
    const gitCode = await runProcess('git', ['clone', source, destination], root);
    if (gitCode !== 0) {
      throw new Error(`Failed to clone repository: ${source}`);
    }
    cloned = true;
  }

  return { destination, repoName, cloned };
}

function normalizeScanMethod(input) {
  const value = String(input || '').trim().toLowerCase();
  if (value === 'quick' || value === 'deep') {
    return value;
  }
  return '';
}

function normalizeScanExecutor(input) {
  const value = String(input || '').trim().toLowerCase();
  if (['auto', 'llm-api', 'codex', 'copilot', 'claude', 'gemini'].includes(value)) {
    return value;
  }
  return '';
}

async function detectLocalCodingAgents(root) {
  const detected = [];

  if (await commandExists('codex', root)) {
    detected.push({ id: 'codex', label: 'Codex CLI', command: 'codex' });
  }
  if (await commandExists('claude', root)) {
    detected.push({ id: 'claude', label: 'Claude CLI', command: 'claude' });
  }
  if (await commandExists('gemini', root)) {
    detected.push({ id: 'gemini', label: 'Gemini CLI', command: 'gemini' });
  }

  if (await commandExists('gh', root)) {
    const copilotCode = await runQuietProcess('gh', ['copilot', '--help'], root);
    if (copilotCode === 0) {
      detected.push({ id: 'copilot', label: 'GitHub Copilot CLI', command: 'gh copilot' });
    }
  }

  return detected;
}

async function selectScanExecution(options, root) {
  const interactive = process.stdin.isTTY && process.stdout.isTTY && !options.yes;
  const detectedAgents = await detectLocalCodingAgents(root);
  let executor = normalizeScanExecutor(options.scanExecutor || 'auto') || 'auto';
  let method = normalizeScanMethod(options.scanMethod || 'deep') || 'deep';

  if (executor === 'auto') {
    executor = 'llm-api';
    if (interactive && detectedAgents.length > 0) {
      console.log(`Detected local coding agents: ${detectedAgents.map((item) => item.id).join(', ')}`);
      const answer = await promptLine(
        'Select scan executor (llm-api|' + detectedAgents.map((item) => item.id).join('|') + ')',
        'llm-api'
      );
      const selected = normalizeScanExecutor(answer);
      if (selected) {
        executor = selected;
      }
    }
  }

  if (!['llm-api', 'codex', 'copilot', 'claude', 'gemini'].includes(executor)) {
    throw new Error(`Invalid scan executor: ${executor}`);
  }

  if (interactive) {
    const answer = await promptLine('Select scan method (quick|deep)', method);
    const selected = normalizeScanMethod(answer);
    if (selected) {
      method = selected;
    }
  }

  return { executor, method, detectedAgents };
}

function detectTechSignals(summary) {
  const extSet = new Set((summary.top_extensions || []).map((item) => item.ext));
  return {
    frontend: ['.tsx', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss'].some((ext) => extSet.has(ext)),
    infrastructure: ['.tf', '.hcl'].some((ext) => extSet.has(ext)),
    sql: extSet.has('.sql'),
    scripting: ['.sh', '.ps1'].some((ext) => extSet.has(ext)),
    python: summary.key_files.pyproject_toml || summary.key_files.requirements_txt || extSet.has('.py'),
    node: summary.key_files.package_json || extSet.has('.js') || extSet.has('.ts')
  };
}

function buildMcpSuggestionsForSummary(summary) {
  const tech = detectTechSignals(summary);
  const suggestions = [{ server: 'github', reason: 'Issue/PR/repository workflow for delivery operations.' }];

  if (tech.frontend) {
    suggestions.push({ server: 'chrome-devtools', reason: 'Frontend stack detected; useful for UI inspection and debugging.' });
  }
  if (tech.sql || tech.python) {
    suggestions.push({ server: 'postgres', reason: 'Data-layer signals detected (.sql/Python backend). Useful for schema and query context.' });
  }
  if (tech.infrastructure || summary.key_files.dockerfile || summary.key_files.docker_compose) {
    suggestions.push({ server: 'infrastructure', reason: 'Infrastructure/runtime signals detected (Docker/Terraform/K8s style files).' });
  }
  if (tech.node) {
    suggestions.push({ server: 'npm-docs', reason: 'Node ecosystem detected; package and script references are useful context sources.' });
  }

  return suggestions;
}

function renderMcpSuggestionsMarkdown(data) {
  const lines = ['# MCP Suggestions', ''];
  lines.push(`- generated_at: ${data.generated_at}`);
  lines.push(`- repositories_scanned: ${data.repositories_scanned}`);
  lines.push('');
  for (const repo of data.repositories) {
    lines.push(`## ${repo.repository}`);
    lines.push('');
    for (const suggestion of repo.suggestions) {
      lines.push(`- ${suggestion.server}: ${suggestion.reason}`);
    }
    if (repo.suggestions.length === 0) {
      lines.push('- none');
    }
    lines.push('');
  }
  return lines.join('\n');
}

function repoIntelligencePrompt(documents, summary) {
  return [
    'Analyze this software repository for onboarding and coding-agent context.',
    'Return strict JSON only with this exact shape:',
    '{',
    '  "repository_purpose": string,',
    '  "primary_use_cases": [string],',
    '  "architecture_overview": string,',
    '  "data_persistence": {"stores":[string], "notes": string},',
    '  "integration_points": [string],',
    '  "adr_signals": [string],',
    '  "developer_onboarding": {"first_steps":[string], "key_commands":[string]},',
    '  "feature_delivery_guidance": [string],',
    '  "open_questions": [string]',
    '}',
    'Repository summary:',
    JSON.stringify(summary, null, 2),
    'Repository files/snippets:',
    JSON.stringify(documents, null, 2)
  ].join('\n');
}

async function readFileIfExists(filePath, maxChars = 3000) {
  const exists = await pathExists(filePath);
  if (!exists) {
    return '';
  }
  const raw = await readFile(filePath, 'utf8').catch(() => '');
  return raw.slice(0, maxChars);
}

async function gatherRepositoryDocuments(repoPath, summary) {
  const documents = [];
  const includeFile = async (relativePath, maxChars = 3000) => {
    const absolute = path.join(repoPath, relativePath);
    const content = await readFileIfExists(absolute, maxChars);
    if (content.trim()) {
      documents.push({ path: relativePath, content });
    }
  };

  await includeFile('README.md', 5000);
  await includeFile('README', 5000);
  await includeFile('package.json', 3000);
  await includeFile('pyproject.toml', 3000);
  await includeFile('requirements.txt', 3000);
  await includeFile('docker-compose.yml', 3000);
  await includeFile('docker-compose.yaml', 3000);
  await includeFile('Dockerfile', 3000);

  const docsDir = path.join(repoPath, 'docs');
  if (await pathExists(docsDir)) {
    const docsEntries = await readdir(docsDir, { withFileTypes: true }).catch(() => []);
    for (const entry of docsEntries.slice(0, 8)) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.md')) continue;
      await includeFile(path.join('docs', entry.name), 3500);
    }
  }

  const adrDirs = ['docs/adr', 'doc/adr', 'adr'];
  for (const adrDir of adrDirs) {
    const absoluteAdrDir = path.join(repoPath, adrDir);
    if (!(await pathExists(absoluteAdrDir))) continue;
    const adrEntries = await readdir(absoluteAdrDir, { withFileTypes: true }).catch(() => []);
    for (const entry of adrEntries.slice(0, 8)) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.md')) continue;
      await includeFile(path.join(adrDir, entry.name), 3500);
    }
  }

  if (documents.length === 0) {
    documents.push({
      path: '[summary-only]',
      content: `No readable primary docs found. Top extensions: ${JSON.stringify(summary.top_extensions || [])}`
    });
  }

  return documents.slice(0, 20);
}

function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
}

async function callOpenAIJson(prompt, token, model = 'gpt-4o-mini') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You produce structured software repository analysis in JSON.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropicJson(prompt, token, model = 'claude-3-5-sonnet-latest') {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': token,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return (data.content || []).map((block) => block.text || '').join('\n');
}

async function callGeminiJson(prompt, token, model = 'gemini-1.5-pro') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${token}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature: 0.1 },
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function normalizeRepoIntelligence(parsed) {
  return {
    repository_purpose: parsed.repository_purpose || '',
    primary_use_cases: Array.isArray(parsed.primary_use_cases) ? parsed.primary_use_cases : [],
    architecture_overview: parsed.architecture_overview || '',
    data_persistence: {
      stores: Array.isArray(parsed?.data_persistence?.stores) ? parsed.data_persistence.stores : [],
      notes: parsed?.data_persistence?.notes || ''
    },
    integration_points: Array.isArray(parsed.integration_points) ? parsed.integration_points : [],
    adr_signals: Array.isArray(parsed.adr_signals) ? parsed.adr_signals : [],
    developer_onboarding: {
      first_steps: Array.isArray(parsed?.developer_onboarding?.first_steps) ? parsed.developer_onboarding.first_steps : [],
      key_commands: Array.isArray(parsed?.developer_onboarding?.key_commands) ? parsed.developer_onboarding.key_commands : []
    },
    feature_delivery_guidance: Array.isArray(parsed.feature_delivery_guidance) ? parsed.feature_delivery_guidance : [],
    open_questions: Array.isArray(parsed.open_questions) ? parsed.open_questions : []
  };
}

function renderRepoIntelligenceMarkdown(repoName, intelligence) {
  const lines = [];
  lines.push(`# Repository Intelligence: ${repoName}`);
  lines.push('');
  lines.push('## Purpose');
  lines.push('');
  lines.push(intelligence.repository_purpose || 'N/A');
  lines.push('');
  lines.push('## Primary Use Cases');
  lines.push('');
  for (const item of intelligence.primary_use_cases) lines.push(`- ${item}`);
  if (intelligence.primary_use_cases.length === 0) lines.push('- none');
  lines.push('');
  lines.push('## Architecture Overview');
  lines.push('');
  lines.push(intelligence.architecture_overview || 'N/A');
  lines.push('');
  lines.push('## Data Persistence');
  lines.push('');
  for (const store of intelligence.data_persistence.stores) lines.push(`- store: ${store}`);
  if (intelligence.data_persistence.stores.length === 0) lines.push('- store: unknown');
  lines.push(`- notes: ${intelligence.data_persistence.notes || 'N/A'}`);
  lines.push('');
  lines.push('## Integration Points');
  lines.push('');
  for (const item of intelligence.integration_points) lines.push(`- ${item}`);
  if (intelligence.integration_points.length === 0) lines.push('- none');
  lines.push('');
  lines.push('## ADR Signals');
  lines.push('');
  for (const item of intelligence.adr_signals) lines.push(`- ${item}`);
  if (intelligence.adr_signals.length === 0) lines.push('- none detected');
  lines.push('');
  lines.push('## Developer Onboarding');
  lines.push('');
  for (const step of intelligence.developer_onboarding.first_steps) lines.push(`- first_step: ${step}`);
  if (intelligence.developer_onboarding.first_steps.length === 0) lines.push('- first_step: none');
  for (const cmd of intelligence.developer_onboarding.key_commands) lines.push(`- command: \`${cmd}\``);
  if (intelligence.developer_onboarding.key_commands.length === 0) lines.push('- command: none');
  lines.push('');
  lines.push('## Feature Delivery Guidance');
  lines.push('');
  for (const item of intelligence.feature_delivery_guidance) lines.push(`- ${item}`);
  if (intelligence.feature_delivery_guidance.length === 0) lines.push('- none');
  lines.push('');
  lines.push('## Open Questions');
  lines.push('');
  for (const item of intelligence.open_questions) lines.push(`- ${item}`);
  if (intelligence.open_questions.length === 0) lines.push('- none');
  lines.push('');
  return lines.join('\n');
}

async function generateRepositoryIntelligence(root, provider, repositoryContext) {
  const token = getProviderToken(provider);
  if (!token) {
    return { status: 'skipped', reason: `missing_token_for_${provider}` };
  }

  const outDir = path.join(root, 'context-engineering', 'sources', 'repositories');
  await mkdir(outDir, { recursive: true });

  const items = [];
  for (const summary of repositoryContext.summaries || []) {
    const repoPath = path.join(root, summary.repository_relative_path || path.join('repositories', summary.repository_name));
    const docs = await gatherRepositoryDocuments(repoPath, summary);
    const prompt = repoIntelligencePrompt(docs, summary);
    let raw = '';
    if (provider === 'openai') raw = await callOpenAIJson(prompt, token);
    else if (provider === 'anthropic') raw = await callAnthropicJson(prompt, token);
    else raw = await callGeminiJson(prompt, token);

    const cleaned = stripCodeFence(raw);
    let parsed = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { repository_purpose: cleaned };
    }
    const intelligence = normalizeRepoIntelligence(parsed);

    const jsonPath = path.join(outDir, `${summary.repository_name}.intelligence.json`);
    const mdPath = path.join(outDir, `${summary.repository_name}.intelligence.md`);
    const metadata = {
      generated_at: new Date().toISOString(),
      provider,
      repository: summary.repository_name,
      source_path: summary.repository_relative_path,
      source_files: docs.map((doc) => doc.path),
      confidence_score: summary.confidence_score ?? null,
      assumptions: summary.assumptions || [],
      intelligence
    };
    await writeFile(jsonPath, JSON.stringify(metadata, null, 2), 'utf8');
    await writeFile(mdPath, renderRepoIntelligenceMarkdown(summary.repository_name, intelligence), 'utf8');
    items.push({
      repository: summary.repository_name,
      json: path.relative(root, jsonPath),
      markdown: path.relative(root, mdPath)
    });
  }

  const indexPath = path.join(outDir, 'intelligence-index.json');
  await writeFile(
    indexPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        provider,
        provenance: {
          scan_roots: repositoryContext.scanned_roots || [],
          source: 'llm-api-deep-scan'
        },
        repositories: items
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    status: 'completed',
    provider,
    repository_count: items.length,
    index: path.relative(root, indexPath),
    artifacts: items
  };
}

async function buildDeepRepositoryArtifacts(root, repositoryContext) {
  const outDir = path.join(root, 'context-engineering', 'sources', 'repositories');
  await mkdir(outDir, { recursive: true });
  const avgConfidence =
    (repositoryContext.summaries || []).reduce((acc, item) => acc + (item.confidence_score || 0), 0) /
    Math.max(1, (repositoryContext.summaries || []).length);

  const sourceMap = {
    artifact: 'source-map',
    generated_at: new Date().toISOString(),
    repositories_scanned: repositoryContext.scannedCount,
    confidence_score: Number(avgConfidence.toFixed(2)),
    provenance: {
      scan_roots: repositoryContext.scanned_roots || [],
      method: 'filesystem-scan',
      assumptions: ['Source map is derived from repository file metadata and selected docs, not full semantic parsing.']
    },
    repositories: (repositoryContext.summaries || []).map((summary) => ({
      repository: summary.repository_name,
      path: summary.repository_relative_path,
      files: summary.files,
      directories: summary.directories,
      key_files: summary.key_files,
      top_extensions: summary.top_extensions,
      confidence_score: summary.confidence_score ?? null,
      assumptions: summary.assumptions || []
    }))
  };

  const mcpSuggestions = {
    artifact: 'mcp-suggestions',
    generated_at: new Date().toISOString(),
    repositories_scanned: repositoryContext.scannedCount,
    confidence_score: Number(Math.max(0.5, avgConfidence - 0.1).toFixed(2)),
    provenance: {
      scan_roots: repositoryContext.scanned_roots || [],
      method: 'rule-based-inference',
      assumptions: ['MCP suggestions are heuristic and should be validated by maintainers.']
    },
    repositories: (repositoryContext.summaries || []).map((summary) => ({
      repository: summary.repository_name,
      suggestions: buildMcpSuggestionsForSummary(summary)
    }))
  };

  const sourceMapPath = path.join(outDir, 'source-map.json');
  const mcpJsonPath = path.join(outDir, 'mcp-suggestions.json');
  const mcpMdPath = path.join(outDir, 'mcp-suggestions.md');
  await writeFile(sourceMapPath, JSON.stringify(sourceMap, null, 2), 'utf8');
  await writeFile(mcpJsonPath, JSON.stringify(mcpSuggestions, null, 2), 'utf8');
  await writeFile(mcpMdPath, renderMcpSuggestionsMarkdown(mcpSuggestions), 'utf8');

  return {
    source_map: path.relative(root, sourceMapPath),
    mcp_suggestions_json: path.relative(root, mcpJsonPath),
    mcp_suggestions_markdown: path.relative(root, mcpMdPath)
  };
}

function renderSystemMapMarkdown(systemMap) {
  const lines = ['# System Map', ''];
  lines.push(`- generated_at: ${systemMap.generated_at}`);
  lines.push(`- repositories: ${systemMap.repositories.length}`);
  lines.push(`- confidence_score: ${systemMap.confidence_score}`);
  lines.push('');
  lines.push('## Repositories');
  lines.push('');
  for (const repo of systemMap.repositories) {
    lines.push(`- ${repo.repository} (${repo.path})`);
    lines.push(`  - purpose: ${repo.purpose || 'N/A'}`);
    lines.push(`  - data_stores: ${(repo.data_stores || []).join(', ') || 'unknown'}`);
    lines.push(`  - integrations: ${(repo.integrations || []).join(', ') || 'none'}`);
  }
  if (systemMap.repositories.length === 0) lines.push('- none');
  lines.push('');
  lines.push('## Cross-Repo Links');
  lines.push('');
  for (const link of systemMap.links || []) {
    lines.push(`- ${link.from} -> ${link.to}: ${link.reason}`);
  }
  if (!systemMap.links || systemMap.links.length === 0) lines.push('- none inferred');
  lines.push('');
  return lines.join('\n');
}

async function buildSystemMapArtifacts(root, repositoryContext, repositoryIntelligence) {
  const outDir = path.join(root, 'context-engineering', 'sources');
  await mkdir(outDir, { recursive: true });

  const intelligenceByRepo = new Map();
  for (const item of repositoryIntelligence?.artifacts || []) {
    const intelligencePath = path.join(root, item.json);
    const intelligenceRaw = await readFile(intelligencePath, 'utf8').catch(() => '');
    if (!intelligenceRaw) continue;
    const parsed = JSON.parse(intelligenceRaw);
    intelligenceByRepo.set(item.repository, parsed.intelligence || {});
  }

  const repos = (repositoryContext.summaries || []).map((summary) => {
    const intelligence = intelligenceByRepo.get(summary.repository_name) || {};
    return {
      repository: summary.repository_name,
      path: summary.repository_relative_path,
      purpose: intelligence.repository_purpose || '',
      use_cases: intelligence.primary_use_cases || [],
      data_stores: intelligence?.data_persistence?.stores || [],
      integrations: intelligence.integration_points || [],
      confidence_score: summary.confidence_score ?? null
    };
  });

  const links = [];
  for (let i = 0; i < repos.length; i += 1) {
    for (let j = i + 1; j < repos.length; j += 1) {
      const left = repos[i];
      const right = repos[j];
      const overlap = (left.integrations || []).filter((item) => (right.integrations || []).includes(item));
      if (overlap.length > 0) {
        links.push({
          from: left.repository,
          to: right.repository,
          reason: `shared_integration:${overlap[0]}`
        });
      }
    }
  }

  const avgConfidence =
    repos.reduce((acc, item) => acc + (item.confidence_score || 0), 0) / Math.max(1, repos.length);
  const systemMap = {
    artifact: 'system-map',
    generated_at: new Date().toISOString(),
    confidence_score: Number(Math.max(0.5, avgConfidence).toFixed(2)),
    provenance: {
      scan_roots: repositoryContext.scanned_roots || [],
      intelligence_index: repositoryIntelligence?.index || null,
      assumptions: ['Cross-repo links are inferred from integration overlap and available intelligence.']
    },
    repositories: repos,
    links
  };

  const jsonPath = path.join(outDir, 'system-map.json');
  const mdPath = path.join(outDir, 'system-map.md');
  await writeFile(jsonPath, JSON.stringify(systemMap, null, 2), 'utf8');
  await writeFile(mdPath, renderSystemMapMarkdown(systemMap), 'utf8');

  return {
    json: path.relative(root, jsonPath),
    markdown: path.relative(root, mdPath)
  };
}

function renderDelegatedScanPrompt(root, executor, method, report, repositoryContext, deepArtifacts) {
  const lines = [];
  lines.push(`# Delegated Scan Request (${executor})`);
  lines.push('');
  lines.push('You are a coding agent operating inside an agentic workspace managed by klever.');
  lines.push('Perform repository scan and context-engineering enrichment using the inputs below.');
  lines.push('');
  lines.push('## Inputs');
  lines.push('');
  lines.push(`- workspace_root: \`${root}\``);
  lines.push(`- scan_method: ${method}`);
  lines.push(`- repositories_scanned: ${repositoryContext.scannedCount}`);
  lines.push(`- repository_index: \`${report.repository_artifact_index || 'context-engineering/sources/repositories/index.json'}\``);
  lines.push(`- source_map: \`${deepArtifacts.source_map}\``);
  lines.push(`- mcp_suggestions: \`${deepArtifacts.mcp_suggestions_json}\``);
  lines.push('');
  lines.push('## Required Outputs');
  lines.push('');
  lines.push('- Refined source map with entrypoints, modules, and integration boundaries.');
  lines.push('- Recommended MCP server set with reasons and expected usage patterns.');
  lines.push('- Updated AGENTS.md operational guidance for repository workflows.');
  lines.push('- Scan notes at `context-engineering/scan/delegated-scan-notes.md`.');
  lines.push('');
  lines.push('## Constraints');
  lines.push('');
  lines.push('- Do not store secrets in repository files.');
  lines.push('- Keep artifacts deterministic and reproducible.');
  lines.push('');
  return lines.join('\n');
}

async function prepareDelegatedScan(root, executor, method, report, repositoryContext, deepArtifacts) {
  const outDir = path.join(root, 'context-engineering', 'scan');
  await mkdir(outDir, { recursive: true });
  const promptPath = path.join(outDir, 'delegated-scan-request.md');
  const prompt = renderDelegatedScanPrompt(root, executor, method, report, repositoryContext, deepArtifacts);
  await writeFile(promptPath, prompt, 'utf8');
  return path.relative(root, promptPath);
}

async function runLlmBestEffortScan(root, options, report) {
  const llmSetup = await collectLlmSetup(options);
  const hasKnowledgeBuilder = await pathExists(path.join(root, 'scripts', 'context', 'build_knowledge_layer.mjs'));

  if (!hasKnowledgeBuilder) {
    return {
      mode: 'llm-api',
      provider: llmSetup.provider,
      status: 'skipped',
      reason: 'knowledge_builder_not_found'
    };
  }

  const code = await runKnowledgeBuild(root, llmSetup.provider);
  return {
    mode: 'llm-api',
    provider: llmSetup.provider,
    status: code === 0 ? 'completed' : 'failed',
    exit_code: code,
    repository_intelligence: report.repository_intelligence || null
  };
}

async function summarizeRepository(repoPath) {
  const ignoredDirNames = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.venv', 'venv']);
  const extensionCounts = new Map();
  const keyFiles = {
    package_json: false,
    pyproject_toml: false,
    requirements_txt: false,
    dockerfile: false,
    docker_compose: false,
    readme: false
  };

  let fileCount = 0;
  let dirCount = 0;

  const stack = [repoPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relPath = path.relative(repoPath, fullPath);

      if (entry.isDirectory()) {
        if (ignoredDirNames.has(entry.name)) {
          continue;
        }
        dirCount += 1;
        stack.push(fullPath);
        continue;
      }

      fileCount += 1;

      const lower = entry.name.toLowerCase();
      if (lower === 'package.json') keyFiles.package_json = true;
      if (lower === 'pyproject.toml') keyFiles.pyproject_toml = true;
      if (lower === 'requirements.txt') keyFiles.requirements_txt = true;
      if (lower === 'dockerfile') keyFiles.dockerfile = true;
      if (lower === 'docker-compose.yml' || lower === 'docker-compose.yaml') keyFiles.docker_compose = true;
      if (lower === 'readme.md' || lower === 'readme') keyFiles.readme = true;

      const ext = path.extname(lower) || '[no_ext]';
      extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);

      if (fileCount >= 50000) {
        break;
      }

      if (relPath.length > 0) {
        // noop, keeps relPath available for future enrichment
      }
    }

    if (fileCount >= 50000) {
      break;
    }
  }

  const topExtensions = [...extensionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([ext, count]) => ({ ext, count }));

  const confidenceSignals = [
    keyFiles.readme,
    keyFiles.package_json || keyFiles.pyproject_toml || keyFiles.requirements_txt,
    keyFiles.dockerfile || keyFiles.docker_compose,
    fileCount > 50
  ].filter(Boolean).length;
  const confidenceScore = Math.min(0.95, 0.45 + confidenceSignals * 0.12);
  const assumptions = [];
  if (!keyFiles.readme) assumptions.push('README not found; purpose inference may be less reliable.');
  if (!(keyFiles.package_json || keyFiles.pyproject_toml || keyFiles.requirements_txt)) {
    assumptions.push('No standard runtime manifest detected; stack detection is heuristic.');
  }

  return {
    repository_name: path.basename(repoPath),
    repository_path: repoPath,
    scanned_at: new Date().toISOString(),
    files: fileCount,
    directories: dirCount,
    key_files: keyFiles,
    top_extensions: topExtensions,
    confidence_score: Number(confidenceScore.toFixed(2)),
    assumptions
  };
}

function renderRepositorySummaryMarkdown(summary) {
  const lines = [];
  lines.push(`# Repository Context: ${summary.repository_name}`);
  lines.push('');
  lines.push(`- path: \`${summary.repository_path}\``);
  lines.push(`- scanned_at: ${summary.scanned_at}`);
  lines.push(`- files: ${summary.files}`);
  lines.push(`- directories: ${summary.directories}`);
  if (typeof summary.confidence_score === 'number') {
    lines.push(`- confidence_score: ${summary.confidence_score}`);
  }
  lines.push('');
  lines.push('## Key Files');
  lines.push('');
  for (const [key, value] of Object.entries(summary.key_files)) {
    lines.push(`- ${key}: ${value ? 'yes' : 'no'}`);
  }
  lines.push('');
  lines.push('## Top Extensions');
  lines.push('');
  for (const item of summary.top_extensions) {
    lines.push(`- ${item.ext}: ${item.count}`);
  }
  if (summary.top_extensions.length === 0) {
    lines.push('- none');
  }
  lines.push('');
  return lines.join('\n');
}

function topExtensionsAcrossRepositories(summaries, maxItems = 8) {
  const counts = new Map();

  for (const summary of summaries) {
    for (const item of summary.top_extensions || []) {
      counts.set(item.ext, (counts.get(item.ext) || 0) + item.count);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([ext, count]) => ({ ext, count }));
}

function renderManagedAgentsSection(root, report, repositoryContext) {
  const lines = [];
  const extensionSummary = topExtensionsAcrossRepositories(repositoryContext.summaries || []);
  lines.push(MANAGED_AGENTS_START);
  lines.push('## Repository Operations Context (Generated)');
  lines.push('');
  lines.push(`- generated_at: ${new Date().toISOString()}`);
  lines.push(`- scan_target: \`${report.target}\``);
  lines.push(`- repositories_dir: \`${path.join(root, 'repositories')}\``);
  lines.push(`- repositories_scanned: ${repositoryContext.scannedCount}`);
  if (report.repository_artifact_index) {
    lines.push(`- artifact_index: \`${report.repository_artifact_index}\``);
  }
  if (report.system_map?.json) {
    lines.push(`- system_map: \`${report.system_map.json}\``);
  }
  lines.push('');
  lines.push('### Working Model');
  lines.push('');
  lines.push('- Clone product repositories only with `klever add <git-url>` so catalog and context stay in sync.');
  lines.push('- Keep each product repository isolated under `repositories/<name>/`.');
  lines.push('- Run `klever scan --write` after adding repositories or after major structure changes.');
  lines.push('- Agents must bootstrap from context artifacts before proposing implementation plans.');
  lines.push('');
  lines.push('### Required Agent Bootstrap (Read In Order)');
  lines.push('');
  lines.push('1. `AGENTS.md` (this file).');
  lines.push('2. `agent-context.json` (workspace context index and policy hints).');
  lines.push('3. `context-engineering/scan/scan-summary.json` (latest scan result and execution mode).');
  lines.push('4. `context-engineering/sources/repositories/source-map.json` (repository source map).');
  lines.push('5. `context-engineering/sources/repositories/mcp-suggestions.json` (recommended MCP integrations).');
  lines.push('6. `context-engineering/sources/repositories/*.intelligence.md` (LLM repository intelligence and onboarding guidance).');
  lines.push('7. `context-engineering/sources/system-map.json` (cross-repository topology and inferred links).');
  lines.push('8. `context-engineering/sources/repositories/*.md` (repository-level summaries).');
  lines.push('');
  lines.push('Do not skip this bootstrap sequence. Build feature suggestions only after these sources are loaded.');
  lines.push('If any required artifact is missing or older than 24h, run `klever scan --scan-executor llm-api --scan-method deep --write` and reload context.');
  lines.push('');
  lines.push('### Context Contract');
  lines.push('');
  lines.push('- Required artifacts must include provenance metadata, confidence score, and assumptions.');
  lines.push('- Treat low-confidence areas as hypotheses and call them out before implementation.');
  lines.push('- Stop and request a context refresh when artifact freshness SLA is violated.');
  lines.push('');
  lines.push('### Repositories');
  lines.push('');
  if ((repositoryContext.summaries || []).length === 0) {
    lines.push('- none scanned yet');
  } else {
    for (const summary of repositoryContext.summaries) {
      const prominentExt = (summary.top_extensions || []).slice(0, 3).map((item) => item.ext).join(', ') || 'n/a';
      const keyFiles = Object.entries(summary.key_files || {})
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
        .join(', ') || 'none';
      lines.push(
        `- \`${summary.repository_name}\` at \`${summary.repository_relative_path}\` ` +
          `(files: ${summary.files}, dirs: ${summary.directories}, top_ext: ${prominentExt}, key_files: ${keyFiles})`
      );
    }
  }
  lines.push('');
  lines.push('### Cross-Repository Signals');
  lines.push('');
  if (extensionSummary.length === 0) {
    lines.push('- none');
  } else {
    for (const item of extensionSummary) {
      lines.push(`- ${item.ext}: ${item.count}`);
    }
  }
  lines.push('');
  lines.push('### Suggested Agent Focus');
  lines.push('');
  lines.push('- Build repository-specific plans using each generated repository summary before editing code.');
  lines.push('- Prioritize integration points across repositories only after validating local contracts in each repo.');
  lines.push('- Keep context artifacts fresh to reduce hallucinated assumptions.');
  lines.push(MANAGED_AGENTS_END);
  lines.push('');
  return lines.join('\n');
}

function renderDefaultAgentsHandbook() {
  const lines = [];
  lines.push('# Agent Handbook');
  lines.push('');
  lines.push('This handbook is maintained by `klever` and defines default operating rules for this workspace.');
  lines.push('');
  lines.push('## Startup Checklist');
  lines.push('');
  lines.push('1. Read this file and `agent-context.json` before changes.');
  lines.push('2. Validate scope and rollback strategy before execution.');
  lines.push('3. Run `./scripts/ci/preflight.sh` before opening a PR.');
  lines.push('');
  lines.push('## Context Engineering Policy');
  lines.push('');
  lines.push('- Canonical workspace: `context-engineering/`');
  lines.push('- Raw input: `context-engineering/input/`');
  lines.push('- Curated sources: `context-engineering/sources/`');
  lines.push('- Processing notes: `context-engineering/support/`');
  lines.push('');
  lines.push('## Security Baseline');
  lines.push('');
  lines.push('- Never commit secrets.');
  lines.push('- Keep `GITHUB_API_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` in local env only.');
  lines.push('- Run `scripts/secret-scan.sh` before pushing.');
  lines.push('');
  return lines.join('\n');
}

async function ensureAgentsHandbook(root, report, repositoryContext) {
  const agentsPath = path.join(root, 'AGENTS.md');
  const managedSection = renderManagedAgentsSection(root, report, repositoryContext).trimEnd();

  let existing = '';
  let created = false;
  if (await pathExists(agentsPath)) {
    existing = await readFile(agentsPath, 'utf8');
  } else {
    existing = renderDefaultAgentsHandbook();
    created = true;
  }

  let next = '';
  const hasManagedSection = existing.includes(MANAGED_AGENTS_START) && existing.includes(MANAGED_AGENTS_END);
  if (hasManagedSection) {
    next = existing.replace(
      new RegExp(`${MANAGED_AGENTS_START}[\\s\\S]*?${MANAGED_AGENTS_END}`),
      managedSection
    );
  } else {
    next = `${existing.trimEnd()}\n\n${managedSection}\n`;
  }

  const updated = next !== existing;
  if (created || updated) {
    await writeFile(agentsPath, next, 'utf8');
  }

  return {
    path: path.relative(root, agentsPath),
    created,
    updated: updated && !created
  };
}

async function scanRepositoriesAndBuildArtifacts(root) {
  const candidateDirs = [path.join(root, 'repository'), path.join(root, 'repositories')];
  const existingDirs = [];
  for (const candidate of candidateDirs) {
    if (await pathExists(candidate)) {
      existingDirs.push(candidate);
    }
  }

  if (existingDirs.length === 0) {
    return { scannedCount: 0, artifacts: [], summaries: [], scanned_roots: [] };
  }

  const sourcesRepoDir = path.join(root, 'context-engineering', 'sources', 'repositories');
  await mkdir(sourcesRepoDir, { recursive: true });

  const repos = [];
  for (const sourceRoot of existingDirs) {
    const entries = await readdir(sourceRoot, { withFileTypes: true });
    const rootRepos = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(sourceRoot, entry.name));
    repos.push(...rootRepos);
  }

  const artifacts = [];
  const summaries = [];
  for (const repoPath of repos) {
    const summary = await summarizeRepository(repoPath);
    const baseName = summary.repository_name;
    const jsonPath = path.join(sourcesRepoDir, `${baseName}.json`);
    const mdPath = path.join(sourcesRepoDir, `${baseName}.md`);
    const relativeRepositoryPath = path.relative(root, repoPath);
    const summaryWithRelativePath = {
      ...summary,
      repository_relative_path: relativeRepositoryPath
    };

    await writeFile(jsonPath, JSON.stringify(summaryWithRelativePath, null, 2), 'utf8');
    await writeFile(mdPath, renderRepositorySummaryMarkdown(summaryWithRelativePath), 'utf8');

    artifacts.push({
      repository: summaryWithRelativePath.repository_name,
      json: path.relative(root, jsonPath),
      markdown: path.relative(root, mdPath)
    });
    summaries.push(summaryWithRelativePath);
  }

  const indexPath = path.join(sourcesRepoDir, 'index.json');
  await writeFile(
    indexPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        repositories_scanned: artifacts.length,
        artifacts
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    scannedCount: artifacts.length,
    artifacts,
    summaries,
    indexPath: path.relative(root, indexPath),
    scanned_roots: existingDirs.map((dirPath) => path.relative(root, dirPath))
  };
}

async function runScanCommand(targetDir, options) {
  const root = path.resolve(process.cwd(), targetDir);

  if (!(await pathExists(root))) {
    throw new Error(`Target directory not found: ${root}`);
  }

  const scanExecution = await selectScanExecution(options, root);

  const checks = {
    hasAgents: await pathExists(path.join(root, 'AGENTS.md')),
    hasAgentContext: await pathExists(path.join(root, 'agent-context.json')),
    hasPreflight: await pathExists(path.join(root, 'scripts', 'ci', 'preflight.sh')),
    hasContextWorkspace: await pathExists(path.join(root, 'context-engineering')),
    hasCatalog: await pathExists(path.join(root, 'context-engineering', 'sources', 'catalog.yaml')),
    hasKnowledgeBuilder: await pathExists(path.join(root, 'scripts', 'context', 'build_knowledge_layer.mjs')),
    hasMcpConfig: await pathExists(path.join(root, '.vscode', 'mcp.json')),
    hasSkillsCatalog: await pathExists(path.join(root, 'skills', 'catalog.yaml'))
  };

  let sourceFiles = 0;
  const sourcesDir = path.join(root, 'context-engineering', 'sources');
  if (await pathExists(sourcesDir)) {
    sourceFiles = (await walk(sourcesDir)).length;
  }

  let profileGuess = 'unknown';
  if (checks.hasMcpConfig && checks.hasSkillsCatalog) {
    profileGuess = 'full';
  } else if (checks.hasKnowledgeBuilder && checks.hasCatalog) {
    profileGuess = 'context-ops';
  } else if (checks.hasAgents && checks.hasAgentContext) {
    profileGuess = 'foundation';
  }

  const required = ['hasAgents', 'hasAgentContext', 'hasPreflight'];
  const passedRequired = required.filter((key) => checks[key]).length;
  const readinessScore = Math.round((passedRequired / required.length) * 100);

  const report = {
    scanned_at: new Date().toISOString(),
    target: root,
    profile_guess: profileGuess,
    readiness_score: readinessScore,
    checks,
    source_file_count: sourceFiles
  };

  const repositoryContext = await scanRepositoriesAndBuildArtifacts(root);
  report.repositories_scanned = repositoryContext.scannedCount;
  report.repository_artifacts = repositoryContext.artifacts;
  report.repository_scan_roots = repositoryContext.scanned_roots || [];
  if (repositoryContext.indexPath) {
    report.repository_artifact_index = repositoryContext.indexPath;
  }
  report.scan_execution = {
    executor: scanExecution.executor,
    method: scanExecution.method,
    detected_local_agents: scanExecution.detectedAgents.map((item) => item.id)
  };
  const deepArtifacts = await buildDeepRepositoryArtifacts(root, repositoryContext);
  report.deep_artifacts = deepArtifacts;
  report.repository_intelligence = null;
  report.system_map = null;

  if (scanExecution.executor === 'llm-api') {
    if (scanExecution.method === 'deep') {
      const llmSetup = await collectLlmSetup(options);
      report.repository_intelligence = await generateRepositoryIntelligence(root, llmSetup.provider, repositoryContext);
      report.scan_execution_result = await runLlmBestEffortScan(root, { ...options, llmProvider: llmSetup.provider }, report);
    } else {
      report.scan_execution_result = await runLlmBestEffortScan(root, options, report);
    }
  } else {
    const delegatedPromptPath = await prepareDelegatedScan(
      root,
      scanExecution.executor,
      scanExecution.method,
      report,
      repositoryContext,
      deepArtifacts
    );
    report.scan_execution_result = {
      mode: 'delegated-agent',
      agent: scanExecution.executor,
      status: 'prepared',
      prompt_path: delegatedPromptPath
    };
  }

  report.system_map = await buildSystemMapArtifacts(root, repositoryContext, report.repository_intelligence);

  const agentsResult = await ensureAgentsHandbook(root, report, repositoryContext);
  if (agentsResult.created || agentsResult.updated) {
    checks.hasAgents = true;
  }
  report.agents_handbook = agentsResult.path;
  report.agents_handbook_updated = agentsResult.created || agentsResult.updated;

  if (options.write) {
    const scanDir = path.join(root, 'context-engineering', 'scan');
    await mkdir(scanDir, { recursive: true });
    await writeFile(path.join(scanDir, 'scan-summary.json'), JSON.stringify(report, null, 2), 'utf8');
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Scan Summary');
    console.log(`- Target: ${report.target}`);
    console.log(`- Profile guess: ${report.profile_guess}`);
    console.log(`- Readiness score: ${report.readiness_score}`);
    console.log(`- Source files: ${report.source_file_count}`);
    for (const [key, value] of Object.entries(checks)) {
      console.log(`- ${key}: ${value ? 'yes' : 'no'}`);
    }
    console.log(`- repositories_scanned: ${report.repositories_scanned}`);
    if ((report.repository_scan_roots || []).length > 0) {
      console.log(`- repository_scan_roots: ${report.repository_scan_roots.join(', ')}`);
    }
    if (report.repository_artifact_index) {
      console.log(`- repository_artifact_index: ${report.repository_artifact_index}`);
    }
    console.log(`- scan_executor: ${report.scan_execution.executor}`);
    console.log(`- scan_method: ${report.scan_execution.method}`);
    console.log(`- deep_source_map: ${report.deep_artifacts.source_map}`);
    console.log(`- mcp_suggestions: ${report.deep_artifacts.mcp_suggestions_json}`);
    if (report.repository_intelligence?.index) {
      console.log(`- repository_intelligence_index: ${report.repository_intelligence.index}`);
    }
    if (report.system_map?.json) {
      console.log(`- system_map: ${report.system_map.json}`);
    }
    if (report.scan_execution_result?.prompt_path) {
      console.log(`- delegated_prompt: ${report.scan_execution_result.prompt_path}`);
    }
    if (report.scan_execution_result?.provider) {
      console.log(`- llm_provider: ${report.scan_execution_result.provider}`);
    }
    if (report.scan_execution_result?.status) {
      console.log(`- scan_execution_status: ${report.scan_execution_result.status}`);
    }
    console.log(`- agents_handbook: ${report.agents_handbook}`);
    console.log(`- agents_handbook_updated: ${report.agents_handbook_updated ? 'yes' : 'no'}`);
    if (options.write) {
      console.log('- Report written to: context-engineering/scan/scan-summary.json');
    }
  }
}

async function ensureCatalog(catalogPath) {
  if (await pathExists(catalogPath)) {
    return;
  }

  await mkdir(path.dirname(catalogPath), { recursive: true });
  const skeleton = `version: 1\nupdated_at: ${new Date().toISOString().slice(0, 10)}\n\nsources:\n`;
  await writeFile(catalogPath, skeleton, 'utf8');
}

async function runAddCommand(source, targetDir, options) {
  const root = path.resolve(process.cwd(), targetDir);
  const catalogPath = options.catalogPath
    ? path.resolve(root, options.catalogPath)
    : path.join(root, 'context-engineering', 'sources', 'catalog.yaml');

  await ensureCatalog(catalogPath);

  const cloneResult = await cloneRepositoryIntoWorkspace(source, root);
  const localRepoRelativePath = path.relative(root, cloneResult.destination);
  const sourceId = options.sourceId || cloneResult.repoName;
  const domain = options.sourceDomain || 'code';
  const owner = options.sourceOwner || 'engineering';
  const cadence = options.sourceCadence || 'on_change';
  const ttl = Number.parseInt(options.sourceTtl || '720', 10) || 720;

  const current = await readFile(catalogPath, 'utf8');
  if (current.includes(`- id: ${sourceId}`)) {
    throw new Error(`Source id already exists in catalog: ${sourceId}`);
  }

  const block = [
    '',
    `  - id: ${sourceId}`,
    `    domain: ${domain}`,
    '    authority: supporting',
    `    owner: ${owner}`,
    '    refresh:',
    `      cadence: ${cadence}`,
    `      ttl_hours: ${ttl}`,
    '    collector:',
    '      script: scripts/context/scan_repositories',
    '      mode: automated',
    '    inputs:',
    `      - path: ${localRepoRelativePath}`,
    '    sensitivity:',
    '      class: safe',
    `      notes: source_url=${source}`,
    ''
  ].join('\n');

  let next = current;
  const insertionMarker = '\nrequired_domains:';
  if (current.includes(insertionMarker)) {
    next = current.replace(insertionMarker, `${block}${insertionMarker}`);
  } else {
    next = `${current.replace(/\s*$/, '')}${block}`;
  }

  await writeFile(catalogPath, next, 'utf8');

  console.log('Repository source prepared');
  console.log(`- Catalog: ${catalogPath}`);
  console.log(`- id: ${sourceId}`);
  console.log(`- source_url: ${source}`);
  console.log(`- local_path: ${cloneResult.destination}`);
  if (cloneResult.cloned) {
    console.log('- clone: completed');
  } else {
    console.log('- clone: skipped (already exists)');
  }

  const repoScan = await scanRepositoriesAndBuildArtifacts(root);
  console.log(`- repositories_scanned: ${repoScan.scannedCount}`);
  const addReport = {
    target: root,
    repository_artifact_index: repoScan.indexPath
  };
  const agentsResult = await ensureAgentsHandbook(root, addReport, repoScan);
  console.log(`- agents_handbook: ${agentsResult.path}`);
  console.log(`- agents_handbook_updated: ${agentsResult.created || agentsResult.updated ? 'yes' : 'no'}`);
}

async function runScaffoldCommand(command, targetArg, options) {
  if (!PROFILES.includes(options.profile)) {
    throw new Error(`Invalid profile "${options.profile}". Use one of: ${PROFILES.join(', ')}`);
  }

  const llmSetup = await collectLlmSetup(options);
  const summary = await runScaffold({
    mode: command,
    targetDir: targetArg,
    ...options,
    llmProvider: llmSetup.provider
  });

  console.log('\nScaffold completed');
  console.log(`- Mode: ${command}`);
  console.log(`- Profile: ${options.profile}`);
  console.log(`- Target: ${summary.targetDir}`);
  console.log(`- Created: ${summary.created}`);
  console.log(`- Overwritten: ${summary.overwritten}`);
  console.log(`- Skipped: ${summary.skipped}`);
  console.log(`- LLM provider: ${llmSetup.provider}`);
  if (options.dryRun) {
    console.log('- Dry-run: no files were written');
  }

  if (!options.dryRun && (await shouldBuildKnowledge(options, options.profile))) {
    console.log('\nRunning initial knowledge-layer build...');
    const exitCode = await runKnowledgeBuild(summary.targetDir, llmSetup.provider);
    if (exitCode !== 0) {
      console.warn('Warning: knowledge-layer build failed. You can rerun manually with:');
      console.warn('  node scripts/context/build_knowledge_layer.mjs --provider <openai|anthropic|gemini>');
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (parsed.options.help) {
    printHelp();
    return;
  }

  const command = parsed.positional[0];

  try {
    if (command === 'init' || command === 'wrap') {
      const targetArg = parsed.positional[1] || '.';
      await runScaffoldCommand(command, targetArg, parsed.options);
      return;
    }

    if (command === 'scan') {
      const targetArg = parsed.positional[1] || '.';
      await runScanCommand(targetArg, parsed.options);
      return;
    }

    if (command === 'add') {
      const source = parsed.positional[1];
      if (!source) {
        throw new Error('Usage: klever add <git-repository-url> [target-dir] [options]');
      }
      const targetArg = parsed.positional[2] || '.';
      await runAddCommand(source, targetArg, parsed.options);
      return;
    }

    throw new Error(`Unknown command "${command}"`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();

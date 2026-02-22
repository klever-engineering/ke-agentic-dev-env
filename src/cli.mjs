#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PROFILES, runScaffold } from './scaffold.mjs';

const MAJOR_PROVIDERS = ['openai', 'anthropic', 'gemini'];
const MANAGED_AGENTS_START = '<!-- klever:managed:start -->';
const MANAGED_AGENTS_END = '<!-- klever:managed:end -->';
const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));
const ADDON_PACKAGE_MAP = {
  'klever-addon-postgres-context': '@klever/addon-postgres-context',
  'klever-addon-odoo-business-model': '@klever/addon-odoo-business-model',
  'klever-addon-analytics-context': '@klever/addon-analytics-context',
  'klever-addon-runtime-observability': '@klever/addon-runtime-observability',
  'klever-addon-architecture-adr-index': '@klever/addon-architecture-adr-index'
};
const ADDON_ALIAS_MAP = {
  'postgres-context': 'klever-addon-postgres-context',
  'odoo-business-model': 'klever-addon-odoo-business-model',
  'analytics-context': 'klever-addon-analytics-context',
  'runtime-observability': 'klever-addon-runtime-observability',
  'architecture-adr-index': 'klever-addon-architecture-adr-index'
};
const ADDON_LOCAL_DIR_MAP = {
  'klever-addon-odoo-business-model': 'odoo-business-model'
};
const ADDON_BIN_MAP = {
  'klever-addon-odoo-business-model': 'klever-addon-odoo-business-model',
  '@klever/addon-odoo-business-model': 'klever-addon-odoo-business-model'
};
const MCP_CLIENT_CONFIG_PATHS = {
  vscode: path.join('.vscode', 'mcp.json'),
  claude: '.mcp.json',
  codex: path.join('.codex', 'mcp.json')
};
const KLEVER_CONFIG_KEYS = new Set([
  'profile',
  'projectName',
  'org',
  'repo',
  'llmProvider',
  'buildKnowledge',
  'force',
  'dryRun',
  'yes',
  'json',
  'write',
  'scanExecutor',
  'scanMethod',
  'fullHistory',
  'mcpClient',
  'mcpAll',
  'mcpRegisterMode',
  'scanMode'
]);
const TRUSTED_MCP_SERVER_CATALOG = [
  {
    id: 'github',
    title: 'GitHub MCP Server',
    source: 'vscode-mcp-servers-catalog',
    command: 'docker',
    args: ['run', '-i', '--rm', '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN', 'ghcr.io/github/github-mcp-server:latest'],
    tags: ['repo', 'git', 'delivery'],
    auth: ['GITHUB_PERSONAL_ACCESS_TOKEN']
  },
  {
    id: 'playwright',
    title: 'Playwright MCP',
    source: 'vscode-mcp-servers-catalog',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    tags: ['frontend', 'ui', 'e2e'],
    auth: []
  },
  {
    id: 'postgres',
    title: 'PostgreSQL MCP Server',
    source: 'docker-desktop-mcp-toolkit',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost:5432/postgres'],
    tags: ['database', 'sql', 'python', 'backend', 'odoo'],
    auth: ['DATABASE_URL']
  },
  {
    id: 'docker',
    title: 'Docker MCP Toolkit',
    source: 'docker-desktop-mcp-toolkit',
    command: 'docker',
    args: ['mcp', 'gateway', 'run', 'docker'],
    tags: ['docker', 'runtime', 'infra'],
    auth: []
  },
  {
    id: 'kubernetes',
    title: 'Kubernetes MCP Toolkit',
    source: 'docker-desktop-mcp-toolkit',
    command: 'docker',
    args: ['mcp', 'gateway', 'run', 'kubernetes'],
    tags: ['kubernetes', 'infra', 'runtime'],
    auth: []
  },
  {
    id: 'npm-docs',
    title: 'NPM/Node Docs MCP',
    source: 'vscode-mcp-servers-catalog',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-npm'],
    tags: ['node', 'javascript', 'typescript', 'package-management'],
    auth: []
  },
  {
    id: 'filesystem',
    title: 'Filesystem MCP Server',
    source: 'vscode-mcp-servers-catalog',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    tags: ['all', 'filesystem'],
    auth: []
  }
];

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
  '--scan-method': { key: 'scanMethod', type: 'value' },
  '--full-history': { key: 'fullHistory', type: 'boolean' },
  '--package': { key: 'addonPackage', type: 'value' },
  '--servers': { key: 'mcpServers', type: 'value' },
  '--client': { key: 'mcpClient', type: 'value' },
  '--all': { key: 'mcpAll', type: 'boolean' },
  '--register-mode': { key: 'mcpRegisterMode', type: 'value' },
  '--mode': { key: 'scanMode', type: 'value' },
  '--global': { key: 'configGlobal', type: 'boolean' }
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
    scanMethod: 'deep',
    fullHistory: false,
    addonPackage: '',
    mcpServers: '',
    mcpClient: 'all',
    mcpAll: false,
    mcpRegisterMode: 'auto',
    scanMode: '',
    configGlobal: false
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
  klever up [target-dir] [options]
  klever add <git-repository-url> [target-dir] [options]
  klever addons list [target-dir]
  klever addons install <addon-id|npm-package> [target-dir] [options]
  klever addons run <addon-id|npm-package> [target-dir] [options]
  klever mcp suggest [target-dir] [options]
  klever mcp install [target-dir] [options]
  klever config init [target-dir] [--global]
  klever config show [target-dir] [--global]

Commands:
  init    Create a fresh agentic workspace scaffold.
  wrap    Add agentic scaffold files to an existing repository.
  scan    Inspect workspace readiness and build repository context artifacts.
  up      Run the default operator workflow: scan + optional trusted MCP setup.
  add     Clone a repository into /repositories and register it in context catalog.
  addons  List, install, and run addon packages in workspace internal toolkit.
  mcp     Suggest and register trusted MCP servers for VSCode/Codex/Claude.
  config  Manage persistent defaults (global and workspace).

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
  --mode <name>            quick | balanced | deep (preset; default mode is deep for klever up).

Add options:
  --id <value>             Source id override.
  --domain <value>         Source domain (default: code).
  --owner <value>          Source owner (default: engineering).
  --cadence <value>        Refresh cadence (default: on_change).
  --ttl <hours>            TTL in hours (default: 720).
  --catalog <path>         Custom catalog path.
  --full-history           Clone complete git history (default is shallow clone).

Addons install options:
  --package <name>         Force npm package name for addon installation.

Addons run options:
  --repo <name>            Optional repository name hint passed to addon.

MCP options:
  --servers <ids>          Comma-separated MCP server ids to install.
  --all                    Install all suggested MCP servers.
  --client <name>          vscode | codex | claude | all (default: all).
  --register-mode <mode>   auto | file | cli (default: auto).

General:
  -h, --help               Show this help.
  --global                 Use global scope for config commands.
`);
}

function parseArgs(argv) {
  const result = {
    positional: [],
    options: defaultOptions(),
    provided: new Set()
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith('-')) {
      result.positional.push(token);
      continue;
    }

    if (token === '-h' || token === '--help') {
      result.options.help = true;
      result.provided.add('help');
      continue;
    }

    const config = FLAG_CONFIG[token];
    if (!config) {
      throw new Error(`Unknown option: ${token}`);
    }

    if (config.type === 'boolean') {
      result.options[config.key] = true;
      result.provided.add(config.key);
      continue;
    }

    const nextValue = argv[i + 1];
    if (!nextValue || nextValue.startsWith('-')) {
      throw new Error(`Missing value for ${token}`);
    }

    result.options[config.key] = nextValue;
    result.provided.add(config.key);
    i += 1;
  }

  return result;
}

async function readJsonFileSafe(filePath) {
  const raw = await readFile(filePath, 'utf8').catch(() => '');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function globalConfigPath() {
  if (process.env.KLEVER_CONFIG_FILE) {
    return path.resolve(process.env.KLEVER_CONFIG_FILE);
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'klever', 'config.json');
}

function workspaceConfigPath(root) {
  return path.join(root, '.klever', 'config.json');
}

function normalizeConfigPayload(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const normalized = {};
  for (const [key, value] of Object.entries(input)) {
    if (!KLEVER_CONFIG_KEYS.has(key)) continue;
    normalized[key] = value;
  }
  return normalized;
}

async function loadConfigFile(filePath) {
  const data = await readJsonFileSafe(filePath);
  return normalizeConfigPayload(data || {});
}

function inferTargetDirForCommand(resolvedCommand, positional) {
  if (resolvedCommand === 'add') return positional[2] || '.';
  if (resolvedCommand === 'addons') {
    const action = positional[1];
    if (action === 'list') return positional[2] || '.';
    return positional[3] || '.';
  }
  if (resolvedCommand === 'mcp') return positional[2] || '.';
  if (resolvedCommand === 'config') return positional[2] || '.';
  return positional[1] || '.';
}

async function applyPersistentDefaults(parsed, resolvedCommand) {
  if (resolvedCommand === 'config') return;

  const globalPath = globalConfigPath();
  const globalConfig = await loadConfigFile(globalPath);

  const targetArg = inferTargetDirForCommand(resolvedCommand, parsed.positional);
  const root = path.resolve(process.cwd(), targetArg);
  const wsConfig =
    (await pathExists(root).then((exists) => (exists ? loadConfigFile(workspaceConfigPath(root)) : {}))) || {};

  for (const [key, value] of Object.entries(globalConfig)) {
    if (!parsed.provided.has(key)) {
      parsed.options[key] = value;
    }
  }
  for (const [key, value] of Object.entries(wsConfig)) {
    if (!parsed.provided.has(key)) {
      parsed.options[key] = value;
    }
  }
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
    .replace(/(^-|-$)/g, '');

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

async function cloneRepositoryIntoWorkspace(source, root, options = {}) {
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

  const shallowArgs = options.fullHistory ? [] : ['--depth', '1', '--single-branch'];

  if (parsed) {
    const ghTarget = `${parsed.owner}/${parsed.repo}`;
    const ghArgs = ['repo', 'clone', ghTarget, destination];
    if (shallowArgs.length > 0) {
      ghArgs.push('--', ...shallowArgs);
    }
    const ghCode = await runProcess('gh', ghArgs, root);
    if (ghCode === 0) {
      cloned = true;
    }
  }

  if (!cloned) {
    const gitArgs = ['clone', ...shallowArgs, source, destination];
    const gitCode = await runProcess('git', gitArgs, root);
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

function normalizeScanMode(input) {
  const value = String(input || '').trim().toLowerCase();
  if (['quick', 'balanced', 'deep'].includes(value)) {
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
    node: summary.key_files.package_json || extSet.has('.js') || extSet.has('.ts'),
    docker: summary.key_files.dockerfile || summary.key_files.docker_compose,
    kubernetes: ['.yaml', '.yml'].some((ext) => extSet.has(ext)),
    odoo:
      String(summary.repository_name || '').toLowerCase().includes('odoo') ||
      String(summary.repository_relative_path || '').toLowerCase().includes('odoo')
  };
}

function detectTagsForSummary(summary) {
  const tech = detectTechSignals(summary);
  const tags = new Set(['repo']);
  if (tech.frontend) {
    tags.add('frontend');
    tags.add('ui');
  }
  if (tech.sql) tags.add('sql');
  if (tech.python) {
    tags.add('python');
    tags.add('backend');
  }
  if (tech.node) {
    tags.add('node');
    tags.add('javascript');
    tags.add('typescript');
  }
  if (tech.infrastructure) tags.add('infra');
  if (tech.docker) {
    tags.add('docker');
    tags.add('runtime');
  }
  if (tech.kubernetes) tags.add('kubernetes');
  if (tech.odoo) tags.add('odoo');
  return tags;
}

function reasonForMcpServer(server, summary) {
  const tech = detectTechSignals(summary);
  if (server.id === 'github') {
    return 'Issue/PR/repository workflow support for delivery operations.';
  }
  if (server.id === 'playwright' && tech.frontend) {
    return 'Frontend stack detected; browser automation and UI debugging become high value.';
  }
  if (server.id === 'postgres' && (tech.sql || tech.python || tech.odoo)) {
    return 'Data-layer signals detected; database schema/query context is needed for implementation and debugging.';
  }
  if ((server.id === 'docker' || server.id === 'kubernetes') && (tech.infrastructure || tech.docker || tech.kubernetes)) {
    return 'Runtime/infrastructure signals detected; container/cluster context helps diagnostics and operations.';
  }
  if (server.id === 'npm-docs' && tech.node) {
    return 'Node ecosystem detected; package and scripts context is useful for dependency-aware changes.';
  }
  if (server.id === 'filesystem') {
    return 'Filesystem context is a baseline capability for local project analysis.';
  }
  return `Suggested from trusted catalog ${server.source} based on repository technology profile.`;
}

function buildTrustedMcpCandidatesForSummary(summary) {
  const tags = detectTagsForSummary(summary);
  const selected = [];
  for (const server of TRUSTED_MCP_SERVER_CATALOG) {
    if (server.tags.includes('all') || server.tags.some((tag) => tags.has(tag))) {
      selected.push({
        server: server.id,
        title: server.title,
        source: server.source,
        trusted: true,
        reason: reasonForMcpServer(server, summary),
        command: server.command,
        args: server.args,
        auth: server.auth
      });
    }
  }

  const unique = new Map();
  for (const item of selected) {
    unique.set(item.server, item);
  }
  return [...unique.values()];
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
      lines.push(`  - source: ${suggestion.source}`);
      lines.push(`  - trusted: ${suggestion.trusted ? 'yes' : 'no'}`);
      if (suggestion.auth && suggestion.auth.length > 0) {
        lines.push(`  - auth: ${suggestion.auth.join(', ')}`);
      }
    }
    if (repo.suggestions.length === 0) {
      lines.push('- none');
    }
    lines.push('');
  }
  return lines.join('\n');
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMcpClient(input) {
  const value = String(input || '').trim().toLowerCase();
  if (['vscode', 'codex', 'claude', 'all'].includes(value)) return value;
  return '';
}

function normalizeRegisterMode(input) {
  const value = String(input || '').trim().toLowerCase();
  if (['auto', 'file', 'cli'].includes(value)) return value;
  return '';
}

function normalizeClientSelection(clientInput) {
  const normalized = normalizeMcpClient(clientInput || 'all') || 'all';
  if (normalized === 'all') return ['vscode', 'codex', 'claude'];
  return [normalized];
}

function serverToVscodeConfig(root, server) {
  const config = {
    type: 'stdio',
    command: server.command,
    args: [...server.args]
  };
  if (server.id === 'filesystem') {
    config.args.push(root);
  }
  return config;
}

function serverToClaudeConfig(root, server) {
  const config = {
    command: server.command,
    args: [...server.args]
  };
  if (server.id === 'filesystem') {
    config.args.push(root);
  }
  if (server.command === 'docker') {
    config.type = 'stdio';
  }
  return config;
}

async function upsertVscodeMcpConfig(root, servers) {
  const relPath = MCP_CLIENT_CONFIG_PATHS.vscode;
  const filePath = path.join(root, relPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const existing = (await readJsonFileSafe(filePath)) || {};
  const next = {
    ...existing,
    servers: {
      ...(existing.servers || {})
    }
  };
  for (const server of servers) {
    next.servers[server.id] = serverToVscodeConfig(root, server);
  }
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
  return relPath;
}

async function upsertCodexMcpConfig(root, servers) {
  const relPath = MCP_CLIENT_CONFIG_PATHS.codex;
  const filePath = path.join(root, relPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const existing = (await readJsonFileSafe(filePath)) || {};
  const next = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers || {})
    }
  };
  for (const server of servers) {
    next.mcpServers[server.id] = serverToClaudeConfig(root, server);
  }
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
  return relPath;
}

async function upsertClaudeMcpConfig(root, servers) {
  const relPath = MCP_CLIENT_CONFIG_PATHS.claude;
  const filePath = path.join(root, relPath);
  const existing = (await readJsonFileSafe(filePath)) || {};
  const next = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers || {})
    }
  };
  for (const server of servers) {
    next.mcpServers[server.id] = serverToClaudeConfig(root, server);
  }
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
  return relPath;
}

function detectMissingAuth(server) {
  const missing = [];
  for (const envName of server.auth || []) {
    if (!process.env[envName]) {
      missing.push(envName);
    }
  }
  return missing;
}

async function tryRegisterWithCodexCli(root, server) {
  if (!(await commandExists('codex', root))) return { status: 'skipped', reason: 'codex_not_found' };
  const hasMcp = await runQuietProcess('codex', ['mcp', 'add', '--help'], root);
  if (hasMcp !== 0) return { status: 'skipped', reason: 'codex_mcp_add_not_supported' };
  const args = ['mcp', 'add', server.id];
  args.push('--', server.command, ...(server.args || []));
  if (server.id === 'filesystem') args.push(root);
  const code = await runProcess('codex', args, root);
  return code === 0 ? { status: 'registered' } : { status: 'failed', reason: `exit_code_${code}` };
}

async function tryRegisterWithClaudeCli(root, server) {
  if (!(await commandExists('claude', root))) return { status: 'skipped', reason: 'claude_not_found' };
  const hasMcp = await runQuietProcess('claude', ['mcp', 'add', '--help'], root);
  if (hasMcp !== 0) return { status: 'skipped', reason: 'claude_mcp_add_not_supported' };
  const args = ['mcp', 'add', '--scope', 'project'];
  args.push(server.id, '--', server.command, ...(server.args || []));
  if (server.id === 'filesystem') args.push(root);
  const code = await runProcess('claude', args, root);
  return code === 0 ? { status: 'registered' } : { status: 'failed', reason: `exit_code_${code}` };
}

function detectMcpServerById(id) {
  return TRUSTED_MCP_SERVER_CATALOG.find((server) => server.id === id) || null;
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
      suggestions: buildTrustedMcpCandidatesForSummary(summary)
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

function detectAddonSuggestions(repositoryContext, repositoryIntelligence, deepArtifacts) {
  const suggestions = [];
  const summaries = repositoryContext.summaries || [];
  const repoIntelligenceByName = new Map();
  for (const item of repositoryIntelligence?.artifacts || []) {
    repoIntelligenceByName.set(item.repository, item);
  }

  const hasPython = summaries.some((summary) => {
    const ext = new Set((summary.top_extensions || []).map((item) => item.ext));
    return summary.key_files.pyproject_toml || summary.key_files.requirements_txt || ext.has('.py');
  });
  const hasOdoo = summaries.some((summary) => {
    const repoName = String(summary.repository_name || '').toLowerCase();
    const pathHint = String(summary.repository_relative_path || '').toLowerCase();
    return repoName.includes('odoo') || pathHint.includes('odoo');
  });
  const hasFrontend = summaries.some((summary) => {
    const ext = new Set((summary.top_extensions || []).map((item) => item.ext));
    return ext.has('.tsx') || ext.has('.jsx') || ext.has('.js') || ext.has('.css') || ext.has('.html');
  });
  const hasDocker = summaries.some((summary) => summary.key_files.dockerfile || summary.key_files.docker_compose);

  if (hasPython || hasOdoo) {
    suggestions.push({
      addon_id: 'klever-addon-postgres-context',
      npm_package: ADDON_PACKAGE_MAP['klever-addon-postgres-context'],
      confidence: 0.86,
      reason: 'Python/Odoo style workloads often rely on PostgreSQL schemas and query-level debugging context.',
      expected_outcomes: [
        'Database model map and migration inventory',
        'Query troubleshooting context',
        'Persistence flow traces for agents'
      ],
      install_hint: 'klever addons install postgres-context'
    });
  }

  if (hasOdoo) {
    suggestions.push({
      addon_id: 'klever-addon-odoo-business-model',
      npm_package: ADDON_PACKAGE_MAP['klever-addon-odoo-business-model'],
      confidence: 0.91,
      reason: 'Odoo repositories benefit from business entity modeling, module dependency maps, and XML/view intelligence.',
      expected_outcomes: [
        'Module dependency and extension map',
        'Business process model extracted from addons',
        'ORM model and view/action relation context'
      ],
      install_hint: 'klever addons install odoo-business-model'
    });
  }

  if (hasFrontend) {
    suggestions.push({
      addon_id: 'klever-addon-analytics-context',
      npm_package: ADDON_PACKAGE_MAP['klever-addon-analytics-context'],
      confidence: 0.62,
      reason: 'Frontend/web artifacts detected. Analytics and tracking integration context can improve feature impact analysis.',
      expected_outcomes: [
        'Tracking/analytics integration inventory',
        'Event naming and taxonomy references',
        'Guidance for safe instrumentation changes'
      ],
      install_hint: 'klever addons install analytics-context'
    });
  }

  if (hasDocker) {
    suggestions.push({
      addon_id: 'klever-addon-runtime-observability',
      npm_package: ADDON_PACKAGE_MAP['klever-addon-runtime-observability'],
      confidence: 0.69,
      reason: 'Container/runtime artifacts detected. Observability addon improves deployment and runtime debugging context.',
      expected_outcomes: [
        'Runtime service map',
        'Health/metrics endpoint inventory',
        'Operational troubleshooting playbook references'
      ],
      install_hint: 'klever addons install runtime-observability'
    });
  }

  suggestions.push({
    addon_id: 'klever-addon-architecture-adr-index',
    npm_package: ADDON_PACKAGE_MAP['klever-addon-architecture-adr-index'],
    confidence: 0.74,
    reason: 'Architecture decision indexing improves reliability for multi-repo feature planning.',
    expected_outcomes: ['Normalized ADR timeline', 'Superseded decision map', 'Decision-aware implementation guidance'],
    install_hint: 'klever addons install architecture-adr-index'
  });

  return {
    generated_at: new Date().toISOString(),
    scan_roots: repositoryContext.scanned_roots || [],
    source_map: deepArtifacts?.source_map || null,
    intelligence_index: repositoryIntelligence?.index || null,
    repositories_scanned: summaries.length,
    suggestions
  };
}

function renderAddonSuggestionsMarkdown(payload) {
  const lines = ['# Addon Suggestions', ''];
  lines.push(`- generated_at: ${payload.generated_at}`);
  lines.push(`- repositories_scanned: ${payload.repositories_scanned}`);
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  for (const suggestion of payload.suggestions || []) {
    lines.push(`- ${suggestion.addon_id} (confidence: ${suggestion.confidence})`);
    lines.push(`  - reason: ${suggestion.reason}`);
    if (suggestion.npm_package) {
      lines.push(`  - npm_package: \`${suggestion.npm_package}\``);
    }
    lines.push(`  - install: \`${suggestion.install_hint}\``);
    for (const outcome of suggestion.expected_outcomes || []) {
      lines.push(`  - outcome: ${outcome}`);
    }
  }
  if (!payload.suggestions || payload.suggestions.length === 0) {
    lines.push('- none');
  }
  lines.push('');
  return lines.join('\n');
}

async function buildAddonSuggestionsArtifacts(root, repositoryContext, repositoryIntelligence, deepArtifacts) {
  const outDir = path.join(root, 'context-engineering', 'sources');
  await mkdir(outDir, { recursive: true });
  const payload = detectAddonSuggestions(repositoryContext, repositoryIntelligence, deepArtifacts);
  const jsonPath = path.join(outDir, 'addon-suggestions.json');
  const mdPath = path.join(outDir, 'addon-suggestions.md');
  await writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await writeFile(mdPath, renderAddonSuggestionsMarkdown(payload), 'utf8');
  return {
    json: path.relative(root, jsonPath),
    markdown: path.relative(root, mdPath),
    count: (payload.suggestions || []).length
  };
}

function addonToolkitPaths(root) {
  const toolkitRoot = path.join(root, '.klever', 'toolkit');
  return {
    toolkitRoot,
    packageJsonPath: path.join(toolkitRoot, 'package.json'),
    registryPath: path.join(toolkitRoot, 'addons.json')
  };
}

async function ensureAddonToolkit(root) {
  const paths = addonToolkitPaths(root);
  await mkdir(paths.toolkitRoot, { recursive: true });
  if (!(await pathExists(paths.packageJsonPath))) {
    await writeFile(
      paths.packageJsonPath,
      JSON.stringify(
        {
          name: 'klever-toolkit',
          private: true,
          version: '0.0.0',
          description: 'Internal toolkit managed by klever addons',
          dependencies: {}
        },
        null,
        2
      ),
      'utf8'
    );
  }
  if (!(await pathExists(paths.registryPath))) {
    await writeFile(
      paths.registryPath,
      JSON.stringify({ installed_at: new Date().toISOString(), addons: [] }, null, 2),
      'utf8'
    );
  }
  return paths;
}

async function resolveAddonFromSuggestions(root, addonIdOrPackage) {
  const normalizedInput = ADDON_ALIAS_MAP[addonIdOrPackage] || addonIdOrPackage;
  const suggestionsPath = path.join(root, 'context-engineering', 'sources', 'addon-suggestions.json');
  const suggestions = await readJsonFileSafe(suggestionsPath);
  const suggestion =
    suggestions?.suggestions?.find((item) => item.addon_id === normalizedInput || item.npm_package === normalizedInput) ||
    null;
  if (!suggestion) {
    return {
      addonId: normalizedInput,
      packageName: ADDON_PACKAGE_MAP[normalizedInput] || normalizedInput,
      fromSuggestions: false
    };
  }
  return {
    addonId: suggestion.addon_id,
    packageName: suggestion.npm_package || ADDON_PACKAGE_MAP[suggestion.addon_id] || normalizedInput,
    fromSuggestions: true
  };
}

async function resolveAddonInstallSpec(addonId, packageName, explicitPackage) {
  if (explicitPackage) {
    return { installSpec: explicitPackage, source: 'explicit-package' };
  }

  const localDir = ADDON_LOCAL_DIR_MAP[addonId];
  if (localDir) {
    const localPath = path.resolve(CLI_DIR, '..', 'addons', localDir);
    if (await pathExists(localPath)) {
      return { installSpec: localPath, source: 'bundled-local-addon', localPath };
    }
  }

  return { installSpec: packageName, source: 'npm-registry' };
}

async function runAddonsCommand(parsed) {
  const action = parsed.positional[1];
  if (!action || !['list', 'install', 'run'].includes(action)) {
    throw new Error('Usage: klever addons <list|install|run> [addon-id|npm-package] [target-dir] [options]');
  }

  if (action === 'list') {
    const targetArg = parsed.positional[2] || '.';
    const root = path.resolve(process.cwd(), targetArg);
    const suggestionsPath = path.join(root, 'context-engineering', 'sources', 'addon-suggestions.json');
    const registryPath = addonToolkitPaths(root).registryPath;
    const suggestions = await readJsonFileSafe(suggestionsPath);
    const installed = await readJsonFileSafe(registryPath);
    console.log('Addon Status');
    console.log(`- workspace: ${root}`);
    console.log(`- suggestions_file: ${path.relative(root, suggestionsPath)}`);
    console.log(`- installed_registry: ${path.relative(root, registryPath)}`);
    const suggested = suggestions?.suggestions || [];
    const installedSet = new Set((installed?.addons || []).map((item) => item.addon_id));
    console.log(`- suggested_count: ${suggested.length}`);
    for (const item of suggested) {
      console.log(
        `- ${item.addon_id} | npm=${item.npm_package || ADDON_PACKAGE_MAP[item.addon_id] || 'n/a'} | installed=${
          installedSet.has(item.addon_id) ? 'yes' : 'no'
        }`
      );
    }
    if (suggested.length === 0) console.log('- none');
    return;
  }

  if (action === 'run') {
    const addonInput = parsed.positional[2];
    if (!addonInput) {
      throw new Error('Usage: klever addons run <addon-id|npm-package> [target-dir] [options]');
    }
    const targetArg = parsed.positional[3] || '.';
    const root = path.resolve(process.cwd(), targetArg);
    const paths = await ensureAddonToolkit(root);
    const registry = await readJsonFileSafe(paths.registryPath);
    const installed = (registry?.addons || []).find(
      (item) =>
        item.addon_id === addonInput ||
        item.npm_package === addonInput ||
        item.addon_id === (ADDON_ALIAS_MAP[addonInput] || addonInput)
    );
    if (!installed) {
      throw new Error(`Addon is not installed in toolkit: ${addonInput}`);
    }

    const binName = ADDON_BIN_MAP[installed.addon_id] || ADDON_BIN_MAP[installed.npm_package];
    if (!binName) {
      throw new Error(`No runnable binary mapping found for addon: ${installed.addon_id}`);
    }

    const execArgs = ['exec', '--prefix', paths.toolkitRoot, binName, '--', '--workspace', root];
    if (parsed.options.repo) {
      execArgs.push('--repo', parsed.options.repo);
    }
    const code = await runProcess('npm', execArgs, root);
    if (code !== 0) {
      throw new Error(`Addon run failed for ${installed.addon_id}`);
    }

    console.log('Addon executed');
    console.log(`- workspace: ${root}`);
    console.log(`- addon_id: ${installed.addon_id}`);
    console.log(`- npm_package: ${installed.npm_package}`);
    console.log(`- binary: ${binName}`);
    return;
  }

  const addonInput = parsed.positional[2];
  if (!addonInput) {
    throw new Error('Usage: klever addons install <addon-id|npm-package> [target-dir] [options]');
  }
  const targetArg = parsed.positional[3] || '.';
  const root = path.resolve(process.cwd(), targetArg);
  const paths = await ensureAddonToolkit(root);
  const resolved = await resolveAddonFromSuggestions(root, addonInput);
  const installPlan = await resolveAddonInstallSpec(resolved.addonId, resolved.packageName, parsed.options.addonPackage);
  const installCode = await runProcess('npm', ['install', '--prefix', paths.toolkitRoot, installPlan.installSpec], root);
  if (installCode !== 0) {
    throw new Error(`Failed to install addon package: ${installPlan.installSpec}`);
  }

  const registry = (await readJsonFileSafe(paths.registryPath)) || { installed_at: new Date().toISOString(), addons: [] };
  const nextAddons = (registry.addons || []).filter((item) => item.addon_id !== resolved.addonId);
  nextAddons.push({
    addon_id: resolved.addonId,
    npm_package: resolved.packageName,
    install_spec: installPlan.installSpec,
    installed_at: new Date().toISOString(),
    source: installPlan.source,
    suggested: resolved.fromSuggestions
  });
  await writeFile(paths.registryPath, JSON.stringify({ ...registry, addons: nextAddons }, null, 2), 'utf8');

  console.log('Addon installed');
  console.log(`- workspace: ${root}`);
  console.log(`- addon_id: ${resolved.addonId}`);
  console.log(`- npm_package: ${resolved.packageName}`);
  console.log(`- install_spec: ${installPlan.installSpec}`);
  console.log(`- install_source: ${installPlan.source}`);
  console.log(`- toolkit_root: ${paths.toolkitRoot}`);
  console.log(`- registry: ${path.relative(root, paths.registryPath)}`);
}

function renderMcpInstallSummaryMarkdown(summary) {
  const lines = ['# MCP Installation Summary', ''];
  lines.push(`- generated_at: ${summary.generated_at}`);
  lines.push(`- workspace: ${summary.workspace}`);
  lines.push(`- requested_clients: ${summary.requested_clients.join(', ')}`);
  lines.push(`- register_mode: ${summary.register_mode}`);
  lines.push('');
  lines.push('## Servers');
  lines.push('');
  for (const item of summary.servers) {
    lines.push(`- ${item.id} (${item.source})`);
    lines.push(`  - auth_missing: ${item.auth_missing.length > 0 ? item.auth_missing.join(', ') : 'none'}`);
    lines.push(`  - file_registration: ${item.file_registration.join(', ') || 'none'}`);
    if (item.cli_registration && Object.keys(item.cli_registration).length > 0) {
      for (const [client, status] of Object.entries(item.cli_registration)) {
        lines.push(`  - cli_registration_${client}: ${status.status}${status.reason ? ` (${status.reason})` : ''}`);
      }
    }
  }
  if (summary.servers.length === 0) {
    lines.push('- none');
  }
  lines.push('');
  lines.push('## Next Steps');
  lines.push('');
  lines.push('- Authentication may still be required for servers that reported `auth_missing`.');
  lines.push('- Validate connections with `codex mcp list` and `claude mcp list` plus VSCode MCP panel.');
  lines.push('');
  return lines.join('\n');
}

async function loadMcpSuggestionsForWorkspace(root) {
  const sourceMapFile = path.join(root, 'context-engineering', 'sources', 'repositories', 'source-map.json');
  const sourceMap = await readJsonFileSafe(sourceMapFile);
  if (sourceMap?.repositories?.length) {
    return {
      source: path.relative(root, sourceMapFile),
      repositories: sourceMap.repositories.map((entry) => ({
        repository: entry.repository,
        suggestions: buildTrustedMcpCandidatesForSummary({
          repository_name: entry.repository,
          repository_relative_path: entry.path,
          key_files: entry.key_files || {},
          top_extensions: entry.top_extensions || []
        })
      }))
    };
  }

  const repositoryContext = await scanRepositoriesAndBuildArtifacts(root);
  return {
    source: 'runtime-detected',
    repositories: (repositoryContext.summaries || []).map((summary) => ({
      repository: summary.repository_name,
      suggestions: buildTrustedMcpCandidatesForSummary(summary)
    }))
  };
}

function flattenSuggestedServers(payload) {
  const map = new Map();
  for (const repo of payload.repositories || []) {
    for (const suggestion of repo.suggestions || []) {
      const catalogMatch = detectMcpServerById(suggestion.server || suggestion.id);
      if (!catalogMatch) continue;
      if (!map.has(catalogMatch.id)) {
        map.set(catalogMatch.id, {
          id: catalogMatch.id,
          title: catalogMatch.title,
          source: catalogMatch.source,
          trusted: true,
          reason: suggestion.reason || `Suggested from trusted catalog ${catalogMatch.source}.`,
          auth: [...(catalogMatch.auth || [])],
          command: catalogMatch.command,
          args: [...(catalogMatch.args || [])],
          repositories: [repo.repository]
        });
      } else {
        map.get(catalogMatch.id).repositories.push(repo.repository);
      }
    }
  }
  return [...map.values()];
}

async function runMcpCommand(parsed) {
  const action = parsed.positional[1] || 'suggest';
  if (!['suggest', 'install'].includes(action)) {
    throw new Error('Usage: klever mcp <suggest|install> [target-dir] [options]');
  }

  const targetArg = parsed.positional[2] || '.';
  const root = path.resolve(process.cwd(), targetArg);
  if (!(await pathExists(root))) {
    throw new Error(`Target directory not found: ${root}`);
  }

  const payload = await loadMcpSuggestionsForWorkspace(root);
  const suggested = flattenSuggestedServers(payload);

  if (action === 'suggest') {
    if (parsed.options.json) {
      console.log(
        JSON.stringify(
          {
            workspace: root,
            source: payload.source,
            trusted_sources: ['docker-desktop-mcp-toolkit', 'vscode-mcp-servers-catalog'],
            suggestions: suggested
          },
          null,
          2
        )
      );
      return;
    }
    console.log('Trusted MCP Suggestions');
    console.log(`- workspace: ${root}`);
    console.log(`- suggestions_source: ${payload.source}`);
    console.log('- trusted_sources: docker-desktop-mcp-toolkit, vscode-mcp-servers-catalog');
    console.log(`- suggested_servers: ${suggested.length}`);
    for (const item of suggested) {
      console.log(
        `- ${item.id} | source=${item.source} | repos=${item.repositories.join(', ')} | auth=${
          item.auth.length > 0 ? item.auth.join(',') : 'none'
        }`
      );
      console.log(`  reason: ${item.reason}`);
    }
    if (suggested.length === 0) {
      console.log('- none');
    }
    return;
  }

  const explicitServerIds = parseCsv(parsed.options.mcpServers);
  let selectedIds = [];
  if (parsed.options.mcpAll) {
    selectedIds = suggested.map((item) => item.id);
  } else if (explicitServerIds.length > 0) {
    selectedIds = explicitServerIds;
  } else if (process.stdin.isTTY && process.stdout.isTTY && !parsed.options.yes) {
    const answer = await promptLine(
      `Select MCP servers to install (comma separated, available: ${suggested.map((item) => item.id).join(', ')})`,
      suggested.map((item) => item.id).join(',')
    );
    selectedIds = parseCsv(answer);
  } else {
    selectedIds = suggested.map((item) => item.id);
  }

  const selectedServers = [];
  for (const id of selectedIds) {
    const server = detectMcpServerById(id);
    if (server) selectedServers.push(server);
  }

  if (selectedServers.length === 0) {
    throw new Error('No valid MCP servers selected. Use `klever mcp suggest` to list available ids.');
  }

  const clients = normalizeClientSelection(parsed.options.mcpClient || 'all');
  const registerMode = normalizeRegisterMode(parsed.options.mcpRegisterMode || 'auto') || 'auto';
  const summary = {
    generated_at: new Date().toISOString(),
    workspace: root,
    trusted_sources: ['docker-desktop-mcp-toolkit', 'vscode-mcp-servers-catalog'],
    requested_clients: clients,
    register_mode: registerMode,
    servers: []
  };

  const fileRegistrations = new Map();
  if (registerMode === 'auto' || registerMode === 'file') {
    if (clients.includes('vscode')) {
      fileRegistrations.set('vscode', await upsertVscodeMcpConfig(root, selectedServers));
    }
    if (clients.includes('codex')) {
      fileRegistrations.set('codex', await upsertCodexMcpConfig(root, selectedServers));
    }
    if (clients.includes('claude')) {
      fileRegistrations.set('claude', await upsertClaudeMcpConfig(root, selectedServers));
    }
  }

  for (const server of selectedServers) {
    const missingAuth = detectMissingAuth(server);
    const item = {
      id: server.id,
      source: server.source,
      auth_missing: missingAuth,
      file_registration: [...fileRegistrations.entries()]
        .map(([client, relPath]) => `${client}:${relPath}`),
      cli_registration: {}
    };

    if (registerMode === 'auto' || registerMode === 'cli') {
      if (clients.includes('codex')) {
        item.cli_registration.codex = await tryRegisterWithCodexCli(root, server);
      }
      if (clients.includes('claude')) {
        item.cli_registration.claude = await tryRegisterWithClaudeCli(root, server);
      }
    }

    summary.servers.push(item);
  }

  const scanDir = path.join(root, 'context-engineering', 'scan');
  await mkdir(scanDir, { recursive: true });
  const summaryJsonPath = path.join(scanDir, 'mcp-install-summary.json');
  const summaryMdPath = path.join(scanDir, 'mcp-install-summary.md');
  await writeFile(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  await writeFile(summaryMdPath, renderMcpInstallSummaryMarkdown(summary), 'utf8');

  if (parsed.options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log('MCP Installation Summary');
  console.log(`- workspace: ${root}`);
  console.log(`- selected_servers: ${selectedServers.map((item) => item.id).join(', ')}`);
  console.log(`- clients: ${clients.join(', ')}`);
  console.log(`- register_mode: ${registerMode}`);
  for (const [client, relPath] of fileRegistrations.entries()) {
    console.log(`- ${client}_config: ${relPath}`);
  }
  for (const server of summary.servers) {
    if (server.auth_missing.length > 0) {
      console.log(`- auth_required_for_${server.id}: ${server.auth_missing.join(', ')}`);
    }
    if (server.cli_registration.codex) {
      console.log(
        `- codex_cli_${server.id}: ${server.cli_registration.codex.status}${
          server.cli_registration.codex.reason ? ` (${server.cli_registration.codex.reason})` : ''
        }`
      );
    }
    if (server.cli_registration.claude) {
      console.log(
        `- claude_cli_${server.id}: ${server.cli_registration.claude.status}${
          server.cli_registration.claude.reason ? ` (${server.cli_registration.claude.reason})` : ''
        }`
      );
    }
  }
  console.log(`- summary_json: ${path.relative(root, summaryJsonPath)}`);
  console.log(`- summary_markdown: ${path.relative(root, summaryMdPath)}`);
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
  if (report.addon_suggestions?.json) {
    lines.push(`- addon_suggestions: \`${report.addon_suggestions.json}\``);
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
  lines.push('8. `context-engineering/sources/addon-suggestions.json` (recommended second-row context addons).');
  lines.push('9. `context-engineering/sources/odoo-business-model/expert-summary.json` (when Odoo addon is installed).');
  lines.push('10. `context-engineering/sources/repositories/*.md` (repository-level summaries).');
  lines.push('');
  lines.push('Do not skip this bootstrap sequence. Build feature suggestions only after these sources are loaded.');
  lines.push('If any required artifact is missing or older than 24h, run `klever scan --scan-executor llm-api --scan-method deep --write` and reload context.');
  lines.push('');
  lines.push('### Context Contract');
  lines.push('');
  lines.push('- Required artifacts must include provenance metadata, confidence score, and assumptions.');
  lines.push('- Treat low-confidence areas as hypotheses and call them out before implementation.');
  lines.push('- Stop and request a context refresh when artifact freshness SLA is violated.');
  lines.push('- Install suggested addons when repository signals indicate specialized domains (e.g., Odoo, analytics, persistence).');
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

  const presetMode = normalizeScanMode(options.scanMode);
  const effectiveOptions = { ...options };
  if (presetMode) {
    const preset = scanPresetFromMode(presetMode);
    effectiveOptions.scanMethod = preset.scanMethod;
    if (!options.scanExecutor || options.scanExecutor === 'auto') {
      effectiveOptions.scanExecutor = preset.scanExecutor;
    }
  }

  const scanExecution = await selectScanExecution(effectiveOptions, root);
  const quickPresetNoLlm = presetMode === 'quick';

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
  report.addon_suggestions = null;

  if (quickPresetNoLlm) {
    report.scan_execution_result = {
      mode: 'quick-local',
      status: 'completed',
      reason: 'mode_quick_skips_llm_execution'
    };
  } else if (scanExecution.executor === 'llm-api') {
    if (scanExecution.method === 'deep') {
      const llmSetup = await collectLlmSetup(effectiveOptions);
      report.repository_intelligence = await generateRepositoryIntelligence(root, llmSetup.provider, repositoryContext);
      report.scan_execution_result = await runLlmBestEffortScan(
        root,
        { ...effectiveOptions, llmProvider: llmSetup.provider },
        report
      );
    } else {
      report.scan_execution_result = await runLlmBestEffortScan(root, effectiveOptions, report);
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
  report.addon_suggestions = await buildAddonSuggestionsArtifacts(
    root,
    repositoryContext,
    report.repository_intelligence,
    deepArtifacts
  );

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
    if (report.addon_suggestions?.json) {
      console.log(`- addon_suggestions: ${report.addon_suggestions.json}`);
      console.log(`- addon_suggestions_count: ${report.addon_suggestions.count}`);
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

  const cloneResult = await cloneRepositoryIntoWorkspace(source, root, options);
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
    console.log(`- clone_mode: ${options.fullHistory ? 'full-history' : 'shallow-depth-1'}`);
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

function defaultKleverConfigTemplate() {
  return {
    scanMode: 'deep',
    scanExecutor: 'auto',
    scanMethod: 'deep',
    write: true,
    mcpClient: 'all',
    mcpRegisterMode: 'auto',
    mcpAll: true
  };
}

async function runConfigCommand(parsed) {
  const action = parsed.positional[1] || 'show';
  if (!['init', 'show'].includes(action)) {
    throw new Error('Usage: klever config <init|show> [target-dir] [--global]');
  }

  const targetArg = parsed.positional[2] || '.';
  const root = path.resolve(process.cwd(), targetArg);
  const useGlobal = Boolean(parsed.options.configGlobal);
  const configPath = useGlobal ? globalConfigPath() : workspaceConfigPath(root);

  if (action === 'init') {
    if (!useGlobal && !(await pathExists(root))) {
      throw new Error(`Target directory not found: ${root}`);
    }
    await mkdir(path.dirname(configPath), { recursive: true });
    if ((await pathExists(configPath)) && !parsed.options.force) {
      throw new Error(`Config file already exists: ${configPath} (use --force to overwrite)`);
    }
    await writeFile(configPath, JSON.stringify(defaultKleverConfigTemplate(), null, 2), 'utf8');
    console.log('Klever config initialized');
    console.log(`- scope: ${useGlobal ? 'global' : 'workspace'}`);
    console.log(`- path: ${configPath}`);
    return;
  }

  const globalConfig = await loadConfigFile(globalConfigPath());
  const workspaceConfig = useGlobal
    ? {}
    : (await pathExists(root))
      ? await loadConfigFile(workspaceConfigPath(root))
      : {};
  const merged = { ...globalConfig, ...workspaceConfig };
  const payload = {
    scope: useGlobal ? 'global' : 'workspace+global',
    global_path: globalConfigPath(),
    workspace_path: useGlobal ? null : workspaceConfigPath(root),
    global_defaults: globalConfig,
    workspace_defaults: workspaceConfig,
    effective_defaults: merged
  };
  if (parsed.options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log('Klever config');
  console.log(`- scope: ${payload.scope}`);
  console.log(`- global_path: ${payload.global_path}`);
  if (payload.workspace_path) {
    console.log(`- workspace_path: ${payload.workspace_path}`);
  }
  console.log('- effective_defaults:');
  for (const [key, value] of Object.entries(payload.effective_defaults)) {
    console.log(`  - ${key}: ${JSON.stringify(value)}`);
  }
}

function scanPresetFromMode(modeInput) {
  const mode = normalizeScanMode(modeInput) || 'deep';
  if (mode === 'quick') {
    return { mode, scanMethod: 'quick', scanExecutor: 'auto' };
  }
  if (mode === 'balanced') {
    return { mode, scanMethod: 'deep', scanExecutor: 'auto' };
  }
  return { mode: 'deep', scanMethod: 'deep', scanExecutor: 'llm-api' };
}

async function runUpCommand(targetDir, options) {
  const preset = scanPresetFromMode(options.scanMode);
  const scanOptions = {
    ...options,
    write: true,
    scanMethod: preset.scanMethod,
    scanExecutor: preset.scanExecutor
  };

  console.log('Klever Up');
  console.log(`- mode: ${preset.mode}`);
  console.log(`- scan_executor: ${preset.scanExecutor}`);
  console.log(`- scan_method: ${preset.scanMethod}`);
  console.log('- step: scan');
  await runScanCommand(targetDir, scanOptions);

  if (preset.mode === 'quick') {
    console.log('- step: mcp setup skipped (quick mode)');
    return;
  }

  const root = path.resolve(process.cwd(), targetDir);
  let shouldInstallMcp = Boolean(options.yes);
  if (!shouldInstallMcp && process.stdin.isTTY && process.stdout.isTTY && !options.json) {
    const answer = await promptLine('Install suggested trusted MCP servers now', 'y');
    shouldInstallMcp = ['y', 'yes'].includes(String(answer).trim().toLowerCase());
  }

  if (!shouldInstallMcp) {
    console.log('- step: mcp setup skipped');
    console.log('- next: run `klever mcp suggest .` then `klever mcp install . --all` when ready');
    return;
  }

  console.log('- step: mcp install');
  const mcpParsed = {
    positional: ['mcp', 'install', root],
    options: {
      ...defaultOptions(),
      yes: options.yes,
      json: options.json,
      mcpAll: true,
      mcpClient: 'all',
      mcpRegisterMode: 'auto'
    }
  };
  await runMcpCommand(mcpParsed);
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
  const aliasMap = {
    u: 'up',
    s: 'scan',
    m: 'mcp',
    a: 'add',
    ad: 'addons',
    c: 'config'
  };
  const resolvedCommand = aliasMap[command] || command;

  try {
    await applyPersistentDefaults(parsed, resolvedCommand);

    if (resolvedCommand === 'init' || resolvedCommand === 'wrap') {
      const targetArg = parsed.positional[1] || '.';
      await runScaffoldCommand(resolvedCommand, targetArg, parsed.options);
      return;
    }

    if (resolvedCommand === 'up') {
      const targetArg = parsed.positional[1] || '.';
      await runUpCommand(targetArg, parsed.options);
      return;
    }

    if (resolvedCommand === 'scan') {
      const targetArg = parsed.positional[1] || '.';
      await runScanCommand(targetArg, parsed.options);
      return;
    }

    if (resolvedCommand === 'add') {
      const source = parsed.positional[1];
      if (!source) {
        throw new Error('Usage: klever add <git-repository-url> [target-dir] [options]');
      }
      const targetArg = parsed.positional[2] || '.';
      await runAddCommand(source, targetArg, parsed.options);
      return;
    }

    if (resolvedCommand === 'addons') {
      await runAddonsCommand(parsed);
      return;
    }

    if (resolvedCommand === 'mcp') {
      await runMcpCommand(parsed);
      return;
    }

    if (resolvedCommand === 'config') {
      await runConfigCommand(parsed);
      return;
    }

    throw new Error(`Unknown command "${command}"`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();

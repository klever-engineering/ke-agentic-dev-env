#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { PROFILES, runScaffold } from './scaffold.mjs';

const MAJOR_PROVIDERS = ['openai', 'anthropic', 'gemini'];

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
  '--catalog': { key: 'catalogPath', type: 'value' }
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
    catalogPath: ''
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

  return {
    repository_name: path.basename(repoPath),
    repository_path: repoPath,
    scanned_at: new Date().toISOString(),
    files: fileCount,
    directories: dirCount,
    key_files: keyFiles,
    top_extensions: topExtensions
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

async function scanRepositoriesAndBuildArtifacts(root) {
  const repositoriesDir = path.join(root, 'repositories');

  if (!(await pathExists(repositoriesDir))) {
    return { scannedCount: 0, artifacts: [] };
  }

  const sourcesRepoDir = path.join(root, 'context-engineering', 'sources', 'repositories');
  await mkdir(sourcesRepoDir, { recursive: true });

  const entries = await readdir(repositoriesDir, { withFileTypes: true });
  const repos = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(repositoriesDir, entry.name));

  const artifacts = [];
  for (const repoPath of repos) {
    const summary = await summarizeRepository(repoPath);
    const baseName = summary.repository_name;
    const jsonPath = path.join(sourcesRepoDir, `${baseName}.json`);
    const mdPath = path.join(sourcesRepoDir, `${baseName}.md`);

    await writeFile(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
    await writeFile(mdPath, renderRepositorySummaryMarkdown(summary), 'utf8');

    artifacts.push({
      repository: summary.repository_name,
      json: path.relative(root, jsonPath),
      markdown: path.relative(root, mdPath)
    });
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

  return { scannedCount: artifacts.length, artifacts, indexPath: path.relative(root, indexPath) };
}

async function runScanCommand(targetDir, options) {
  const root = path.resolve(process.cwd(), targetDir);

  if (!(await pathExists(root))) {
    throw new Error(`Target directory not found: ${root}`);
  }

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
  if (repositoryContext.indexPath) {
    report.repository_artifact_index = repositoryContext.indexPath;
  }

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
    if (report.repository_artifact_index) {
      console.log(`- repository_artifact_index: ${report.repository_artifact_index}`);
    }
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

#!/usr/bin/env node

import process from 'node:process';
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { PROFILES, runScaffold } from './scaffold.mjs';

const MAJOR_PROVIDERS = ['openai', 'anthropic', 'gemini'];

function printHelp() {
  const profileList = PROFILES.join(', ');
  console.log(`
klever-agentic - Generic Agentic Environment Scaffold

Usage:
  klever-agentic init [target-dir] [options]
  klever-agentic wrap [target-dir] [options]

Commands:
  init    Create a fresh agentic workspace scaffold.
  wrap    Add agentic scaffold files to an existing repository.

Options:
  --profile <name>         Profile to apply (${profileList}).
  --project-name <name>    Display name used in templates.
  --org <name>             GitHub organization/user placeholder.
  --repo <name>            Repository name placeholder.
  --llm-provider <name>    One of: openai, anthropic, gemini, auto.
  --build-knowledge        Run initial LLM knowledge-layer build after scaffold (context-ops/full).
  --force                  Overwrite files that already exist.
  --dry-run                Print planned changes without writing files.
  --yes                    Non-interactive mode.
  -h, --help               Show this help.
`);
}

function parseArgs(argv) {
  const result = {
    positional: [],
    options: {
      profile: 'foundation',
      projectName: '',
      org: 'your-org',
      repo: '',
      llmProvider: '',
      buildKnowledge: false,
      force: false,
      dryRun: false,
      yes: false
    }
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

    if (token === '--force') {
      result.options.force = true;
      continue;
    }

    if (token === '--dry-run') {
      result.options.dryRun = true;
      continue;
    }

    if (token === '--yes') {
      result.options.yes = true;
      continue;
    }

    if (token === '--build-knowledge') {
      result.options.buildKnowledge = true;
      continue;
    }

    const nextValue = argv[i + 1];
    if (!nextValue || nextValue.startsWith('-')) {
      throw new Error(`Missing value for ${token}`);
    }

    if (token === '--profile') {
      result.options.profile = nextValue;
      i += 1;
      continue;
    }

    if (token === '--project-name') {
      result.options.projectName = nextValue;
      i += 1;
      continue;
    }

    if (token === '--org') {
      result.options.org = nextValue;
      i += 1;
      continue;
    }

    if (token === '--repo') {
      result.options.repo = nextValue;
      i += 1;
      continue;
    }

    if (token === '--llm-provider') {
      result.options.llmProvider = nextValue;
      i += 1;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
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
      if (interactive) {
        provider = normalizeProvider(
          await promptLine(
            `Multiple provider keys detected (${configured.join(', ')}). Select provider`,
            configured[0]
          )
        );
      } else {
        provider = configured[0];
      }
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
  const supportsKnowledge = profile === 'context-ops' || profile === 'full';
  if (!supportsKnowledge) {
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
    const child = spawn(
      process.execPath,
      ['scripts/context/build_knowledge_layer.mjs', '--provider', provider],
      {
        cwd: targetDir,
        stdio: 'inherit',
        env: process.env
      }
    );

    child.on('close', (code) => {
      resolve(code === null ? 1 : code);
    });
  });
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

  const [command, targetArg = '.'] = parsed.positional;

  if (!['init', 'wrap'].includes(command)) {
    console.error(`Error: Unknown command "${command}"`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (!PROFILES.includes(parsed.options.profile)) {
    console.error(
      `Error: Invalid profile "${parsed.options.profile}". Use one of: ${PROFILES.join(', ')}`
    );
    process.exitCode = 1;
    return;
  }

  try {
    const llmSetup = await collectLlmSetup(parsed.options);

    const summary = await runScaffold({
      mode: command,
      targetDir: targetArg,
      ...parsed.options,
      llmProvider: llmSetup.provider
    });

    console.log('\nScaffold completed');
    console.log(`- Mode: ${command}`);
    console.log(`- Profile: ${parsed.options.profile}`);
    console.log(`- Target: ${summary.targetDir}`);
    console.log(`- Created: ${summary.created}`);
    console.log(`- Overwritten: ${summary.overwritten}`);
    console.log(`- Skipped: ${summary.skipped}`);
    console.log(`- LLM provider: ${llmSetup.provider}`);
    if (parsed.options.dryRun) {
      console.log('- Dry-run: no files were written');
    }

    if (!parsed.options.dryRun && (await shouldBuildKnowledge(parsed.options, parsed.options.profile))) {
      console.log('\nRunning initial knowledge-layer build...');
      const exitCode = await runKnowledgeBuild(summary.targetDir, llmSetup.provider);
      if (exitCode !== 0) {
        console.warn('Warning: knowledge-layer build failed. You can rerun manually with:');
        console.warn('  node scripts/context/build_knowledge_layer.mjs --provider <openai|anthropic|gemini>');
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();

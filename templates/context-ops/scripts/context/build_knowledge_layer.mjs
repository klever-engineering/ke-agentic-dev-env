#!/usr/bin/env node

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PROVIDERS = ['openai', 'anthropic', 'gemini'];

function parseArgs(argv) {
  const options = {
    provider: process.env.LLM_PROVIDER || 'auto',
    model: '',
    maxFiles: 24,
    maxCharsPerFile: 3500
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--provider' && next) {
      options.provider = next;
      i += 1;
      continue;
    }

    if (token === '--model' && next) {
      options.model = next;
      i += 1;
      continue;
    }

    if (token === '--max-files' && next) {
      options.maxFiles = Number.parseInt(next, 10);
      i += 1;
      continue;
    }

    if (token === '--max-chars-per-file' && next) {
      options.maxCharsPerFile = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
  }

  return options;
}

function providerToken(provider) {
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

function resolveProvider(requestedProvider) {
  const normalized = String(requestedProvider || '').trim().toLowerCase();

  if (normalized && normalized !== 'auto') {
    if (!PROVIDERS.includes(normalized)) {
      throw new Error(`Unsupported provider: ${requestedProvider}`);
    }
    const token = providerToken(normalized);
    if (!token) {
      throw new Error(`Missing token for ${normalized}`);
    }
    return { provider: normalized, token };
  }

  for (const provider of PROVIDERS) {
    const token = providerToken(provider);
    if (token) {
      return { provider, token };
    }
  }

  throw new Error('No provider token found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY/GOOGLE_API_KEY.');
}

async function listFilesRecursive(dirPath) {
  let entries = [];
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

async function collectInputDocuments(rootDir, maxFiles, maxCharsPerFile) {
  const candidateRoots = [
    path.join(rootDir, 'context-engineering', 'sources'),
    path.join(rootDir, 'doc', 'agents', 'context-engineering'),
    path.join(rootDir, 'agent-context.json')
  ];

  const candidates = [];

  for (const item of candidateRoots) {
    const itemStat = await stat(item).catch(() => null);
    if (!itemStat) {
      continue;
    }

    if (itemStat.isFile()) {
      candidates.push(item);
      continue;
    }

    candidates.push(...(await listFilesRecursive(item)));
  }

  const allowed = new Set(['.md', '.txt', '.json', '.yaml', '.yml']);
  const selected = [];

  for (const filePath of candidates.sort((a, b) => a.localeCompare(b))) {
    if (selected.length >= maxFiles) {
      break;
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!allowed.has(ext)) {
      continue;
    }

    const raw = await readFile(filePath, 'utf8').catch(() => '');
    if (!raw.trim()) {
      continue;
    }

    selected.push({
      path: path.relative(rootDir, filePath),
      content: raw.slice(0, maxCharsPerFile)
    });
  }

  if (selected.length === 0) {
    throw new Error('No context source files found for knowledge build');
  }

  return selected;
}

function promptForKnowledgeLayer(documents) {
  return [
    'Build a concise knowledge layer for an agentic development environment.',
    'Return valid JSON only with this shape:',
    '{',
    '  "overview": string,',
    '  "key_entities": [{"name": string, "type": string, "description": string}],',
    '  "critical_workflows": [{"name": string, "steps": [string], "inputs": [string], "outputs": [string]}],',
    '  "risk_hotspots": [{"area": string, "risk": string, "mitigation": string}],',
    '  "commands": [string],',
    '  "open_questions": [string]',
    '}',
    'Documents:',
    JSON.stringify(documents, null, 2)
  ].join('\n');
}

async function callOpenAI(prompt, model, token) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'You generate structured context knowledge for engineering agents.'
        },
        {
          role: 'user',
          content: prompt
        }
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

async function callAnthropic(prompt, model, token) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': token,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const blocks = data.content || [];
  return blocks.map((block) => block.text || '').join('\n');
}

async function callGemini(prompt, model, token) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${token}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.1
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function stripCodeFences(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  return trimmed.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
}

function ensureKnowledgeShape(parsed) {
  return {
    overview: parsed.overview || '',
    key_entities: Array.isArray(parsed.key_entities) ? parsed.key_entities : [],
    critical_workflows: Array.isArray(parsed.critical_workflows) ? parsed.critical_workflows : [],
    risk_hotspots: Array.isArray(parsed.risk_hotspots) ? parsed.risk_hotspots : [],
    commands: Array.isArray(parsed.commands) ? parsed.commands : [],
    open_questions: Array.isArray(parsed.open_questions) ? parsed.open_questions : []
  };
}

async function buildKnowledgeWithProvider(provider, model, token, prompt) {
  if (provider === 'openai') {
    return callOpenAI(prompt, model || 'gpt-4o-mini', token);
  }
  if (provider === 'anthropic') {
    return callAnthropic(prompt, model || 'claude-3-5-sonnet-latest', token);
  }
  return callGemini(prompt, model || 'gemini-1.5-pro', token);
}

function renderMarkdown(knowledge) {
  const lines = [];
  lines.push('# Knowledge Layer');
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(knowledge.overview || 'N/A');
  lines.push('');
  lines.push('## Key Entities');
  lines.push('');

  for (const entity of knowledge.key_entities) {
    lines.push(`- ${entity.name || 'unknown'} (${entity.type || 'unknown'}): ${entity.description || ''}`);
  }

  if (knowledge.key_entities.length === 0) {
    lines.push('- none');
  }

  lines.push('');
  lines.push('## Critical Workflows');
  lines.push('');

  for (const workflow of knowledge.critical_workflows) {
    lines.push(`- ${workflow.name || 'workflow'}`);
    const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
    for (const step of steps) {
      lines.push(`  - step: ${step}`);
    }
  }

  if (knowledge.critical_workflows.length === 0) {
    lines.push('- none');
  }

  lines.push('');
  lines.push('## Risk Hotspots');
  lines.push('');

  for (const hotspot of knowledge.risk_hotspots) {
    lines.push(`- ${hotspot.area || 'area'}: ${hotspot.risk || ''} | mitigation: ${hotspot.mitigation || ''}`);
  }

  if (knowledge.risk_hotspots.length === 0) {
    lines.push('- none');
  }

  lines.push('');
  lines.push('## Suggested Commands');
  lines.push('');

  for (const cmd of knowledge.commands) {
    lines.push(`- \`${cmd}\``);
  }

  if (knowledge.commands.length === 0) {
    lines.push('- none');
  }

  lines.push('');
  lines.push('## Open Questions');
  lines.push('');

  for (const q of knowledge.open_questions) {
    lines.push(`- ${q}`);
  }

  if (knowledge.open_questions.length === 0) {
    lines.push('- none');
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const { provider, token } = resolveProvider(options.provider);
  const docs = await collectInputDocuments(rootDir, options.maxFiles, options.maxCharsPerFile);
  const prompt = promptForKnowledgeLayer(docs);

  const raw = await buildKnowledgeWithProvider(provider, options.model, token, prompt);
  const cleaned = stripCodeFences(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      overview: cleaned,
      key_entities: [],
      critical_workflows: [],
      risk_hotspots: [],
      commands: [],
      open_questions: []
    };
  }

  const knowledge = ensureKnowledgeShape(parsed);

  const outputDir = path.join(rootDir, 'context-engineering', 'sources', 'knowledge');
  await mkdir(outputDir, { recursive: true });

  const metadata = {
    generated_at: new Date().toISOString(),
    provider,
    model: options.model || null,
    source_file_count: docs.length,
    source_files: docs.map((doc) => doc.path),
    knowledge
  };

  await writeFile(path.join(outputDir, 'knowledge-layer.json'), JSON.stringify(metadata, null, 2), 'utf8');
  await writeFile(path.join(outputDir, 'knowledge-layer.md'), renderMarkdown(knowledge), 'utf8');

  console.log(`Knowledge layer written to ${path.relative(rootDir, outputDir)}`);
}

main().catch((error) => {
  console.error(`Knowledge build failed: ${error.message}`);
  process.exit(1);
});

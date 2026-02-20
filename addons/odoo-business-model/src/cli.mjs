#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';

function parseArgs(argv) {
  const options = {
    workspace: process.cwd(),
    repo: 'odoo',
    repoPath: '',
    outputDir: ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--workspace' && next) {
      options.workspace = next;
      i += 1;
      continue;
    }
    if (token === '--repo' && next) {
      options.repo = next;
      i += 1;
      continue;
    }
    if (token === '--repo-path' && next) {
      options.repoPath = next;
      i += 1;
      continue;
    }
    if (token === '--output-dir' && next) {
      options.outputDir = next;
      i += 1;
      continue;
    }
  }

  return options;
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveMaybeRelative(root, candidate) {
  if (!candidate) return '';
  return path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
}

async function findRepositoryPath(workspace, repoName, explicitRepoPath) {
  if (explicitRepoPath) {
    const explicit = resolveMaybeRelative(workspace, explicitRepoPath);
    if (!(await pathExists(explicit))) {
      throw new Error(`Repository path not found: ${explicit}`);
    }
    return explicit;
  }

  const repositoriesDir = path.join(workspace, 'repositories');
  if (!(await pathExists(repositoriesDir))) {
    throw new Error(`repositories directory not found: ${repositoriesDir}`);
  }

  const preferred = path.join(repositoriesDir, repoName);
  if (await pathExists(preferred)) {
    return preferred;
  }

  const entries = await readdir(repositoriesDir, { withFileTypes: true }).catch(() => []);
  const first = entries.find((entry) => entry.isDirectory());
  if (!first) {
    throw new Error(`No repositories found under ${repositoriesDir}`);
  }
  return path.join(repositoriesDir, first.name);
}

async function walk(dirPath, visitor, maxFiles = 200000) {
  const stack = [dirPath];
  let visitedFiles = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') {
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      visitedFiles += 1;
      await visitor(fullPath);
      if (visitedFiles >= maxFiles) {
        return;
      }
    }
  }
}

function extractListField(manifestContent, fieldName) {
  const regex = new RegExp(`["']${fieldName}["']\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const match = manifestContent.match(regex);
  if (!match) return [];
  const block = match[1];
  const values = [];
  const itemRegex = /["']([^"']+)["']/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(block)) !== null) {
    values.push(itemMatch[1]);
  }
  return [...new Set(values)];
}

async function countModuleExtensions(moduleDir) {
  const counts = new Map();
  let totalFiles = 0;
  await walk(
    moduleDir,
    async (filePath) => {
      totalFiles += 1;
      const ext = path.extname(filePath).toLowerCase() || '[no_ext]';
      counts.set(ext, (counts.get(ext) || 0) + 1);
    },
    2500
  );

  return {
    total_files: totalFiles,
    top_extensions: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ext, count]) => ({ ext, count }))
  };
}

async function collectOdooModules(repositoryPath) {
  const manifests = [];

  await walk(repositoryPath, async (filePath) => {
    if (path.basename(filePath) === '__manifest__.py') {
      manifests.push(filePath);
    }
  });

  const modules = [];
  const dependencyCounts = new Map();

  for (const manifestPath of manifests) {
    const moduleDir = path.dirname(manifestPath);
    const moduleName = path.basename(moduleDir);
    const relModulePath = path.relative(repositoryPath, moduleDir);
    const content = await readFile(manifestPath, 'utf8').catch(() => '');

    const depends = extractListField(content, 'depends');
    const dataFiles = extractListField(content, 'data');
    const demoFiles = extractListField(content, 'demo');

    for (const dep of depends) {
      dependencyCounts.set(dep, (dependencyCounts.get(dep) || 0) + 1);
    }

    const fileStats = await countModuleExtensions(moduleDir);

    modules.push({
      module: moduleName,
      path: relModulePath,
      depends,
      data_files: dataFiles.length,
      demo_files: demoFiles.length,
      file_stats: fileStats
    });
  }

  const topDependencies = [...dependencyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name, count]) => ({ name, count }));

  return {
    module_count: modules.length,
    top_dependencies: topDependencies,
    modules: modules.sort((a, b) => a.module.localeCompare(b.module))
  };
}

function renderModuleMapMarkdown(payload) {
  const lines = ['# Odoo Module Map', ''];
  lines.push(`- generated_at: ${payload.generated_at}`);
  lines.push(`- repository: ${payload.repository}`);
  lines.push(`- module_count: ${payload.module_count}`);
  lines.push('');
  lines.push('## Top Dependencies');
  lines.push('');
  for (const dep of payload.top_dependencies || []) {
    lines.push(`- ${dep.name}: ${dep.count}`);
  }
  if ((payload.top_dependencies || []).length === 0) {
    lines.push('- none');
  }
  lines.push('');
  lines.push('## Module Sample');
  lines.push('');
  for (const item of (payload.modules || []).slice(0, 120)) {
    lines.push(`- ${item.module} (${item.path})`);
    lines.push(`  - depends: ${(item.depends || []).join(', ') || 'none'}`);
    lines.push(`  - data_files: ${item.data_files}`);
    lines.push(`  - demo_files: ${item.demo_files}`);
  }
  if ((payload.modules || []).length === 0) {
    lines.push('- none');
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workspace = path.resolve(options.workspace);
  const repositoryPath = await findRepositoryPath(workspace, options.repo, options.repoPath);

  const outputDir = options.outputDir
    ? resolveMaybeRelative(workspace, options.outputDir)
    : path.join(workspace, 'context-engineering', 'sources', 'odoo-business-model');

  await mkdir(outputDir, { recursive: true });

  const model = await collectOdooModules(repositoryPath);
  const payload = {
    generated_at: new Date().toISOString(),
    repository: path.relative(workspace, repositoryPath),
    module_count: model.module_count,
    top_dependencies: model.top_dependencies,
    modules: model.modules
  };

  const jsonPath = path.join(outputDir, 'module-map.json');
  const mdPath = path.join(outputDir, 'module-map.md');
  await writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  await writeFile(mdPath, renderModuleMapMarkdown(payload), 'utf8');

  console.log('Odoo business model context generated');
  console.log(`- workspace: ${workspace}`);
  console.log(`- repository: ${repositoryPath}`);
  console.log(`- modules_detected: ${payload.module_count}`);
  console.log(`- json: ${jsonPath}`);
  console.log(`- markdown: ${mdPath}`);
}

main().catch((error) => {
  console.error(`Addon failed: ${error.message}`);
  process.exit(1);
});

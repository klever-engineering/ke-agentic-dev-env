import { readdir, readFile, stat, writeFile, chmod, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROFILES = ['foundation', 'context-ops', 'full'];

const PROFILE_MODULES = {
  foundation: ['base', 'foundation', 'delivery'],
  'context-ops': ['base', 'foundation', 'context-ops', 'delivery'],
  full: ['base', 'foundation', 'context-ops', 'mcp-skills', 'delivery']
};

function substitute(content, tokens) {
  let result = content;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.split(`__${key}__`).join(value);
  }
  return result;
}

async function walkFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkFiles(fullPath);
      files.push(...nested);
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureInitTarget(targetDir, force) {
  const exists = await pathExists(targetDir);
  if (!exists) {
    await mkdir(targetDir, { recursive: true });
    return;
  }

  const entries = await readdir(targetDir);
  if (entries.length > 0 && !force) {
    throw new Error(
      `Target directory ${targetDir} is not empty. Use --force to allow writing into it.`
    );
  }
}

async function ensureWrapTarget(targetDir) {
  const exists = await pathExists(targetDir);
  if (!exists) {
    throw new Error(`Target directory ${targetDir} does not exist. Create it first or use init.`);
  }
}

export async function runScaffold(config) {
  const targetDir = path.resolve(process.cwd(), config.targetDir);

  if (config.mode === 'init') {
    await ensureInitTarget(targetDir, config.force);
  } else {
    await ensureWrapTarget(targetDir);
  }

  const projectName = config.projectName || path.basename(targetDir);
  const repoName = config.repo || path.basename(targetDir);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const year = String(now.getUTCFullYear());

  const tokens = {
    PROJECT_NAME: projectName,
    REPO_NAME: repoName,
    ORG_NAME: config.org,
    LLM_PROVIDER: config.llmProvider || 'auto',
    DATE: today,
    YEAR: year
  };

  const modules = PROFILE_MODULES[config.profile] || PROFILE_MODULES.foundation;

  let created = 0;
  let overwritten = 0;
  let skipped = 0;
  const writtenThisRun = new Set();

  for (const moduleName of modules) {
    const moduleDir = path.join(__dirname, '..', 'templates', moduleName);
    const files = await walkFiles(moduleDir);

    for (const sourceFile of files) {
      const relativePath = path.relative(moduleDir, sourceFile);
      const destinationFile = path.join(targetDir, relativePath);
      const destinationDir = path.dirname(destinationFile);
      const exists = await pathExists(destinationFile);
      const isModuleOverride = writtenThisRun.has(destinationFile);

      if (exists && !config.force && !isModuleOverride) {
        skipped += 1;
        continue;
      }

      await mkdir(destinationDir, { recursive: true });
      const raw = await readFile(sourceFile, 'utf8');
      const rendered = substitute(raw, tokens);

      if (!config.dryRun) {
        await writeFile(destinationFile, rendered, 'utf8');
        if (destinationFile.endsWith('.sh')) {
          await chmod(destinationFile, 0o755);
        }
      }
      writtenThisRun.add(destinationFile);

      if (exists) {
        overwritten += 1;
      } else {
        created += 1;
      }
    }
  }

  return {
    targetDir,
    created,
    overwritten,
    skipped
  };
}

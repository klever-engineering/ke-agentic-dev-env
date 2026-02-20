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

async function readDirSafe(dirPath) {
  return readdir(dirPath, { withFileTypes: true }).catch(() => []);
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

  const entries = await readDirSafe(repositoriesDir);
  const first = entries.find((entry) => entry.isDirectory());
  if (!first) {
    throw new Error(`No repositories found under ${repositoriesDir}`);
  }
  return path.join(repositoriesDir, first.name);
}

async function listFilesRecursive(rootDir, options = {}) {
  const {
    maxFiles = 10000,
    include = () => true,
    skipDir = (name) => name === '.git' || name === 'node_modules'
  } = options;

  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await readDirSafe(current);

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (skipDir(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }
      if (!include(fullPath)) continue;
      files.push(fullPath);
      if (files.length >= maxFiles) {
        return files;
      }
    }
  }

  return files;
}

async function readFileSafe(filePath, maxChars = 200000) {
  const raw = await readFile(filePath, 'utf8').catch(() => '');
  return raw.slice(0, maxChars);
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

function extractQuoted(text) {
  const values = [];
  const regex = /['"]([^'"\\]*(?:\\.[^'"\\]*)*)['"]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    values.push(match[1]);
  }
  return values;
}

function extractListField(manifestContent, fieldName) {
  const regex = new RegExp(`["']${fieldName}["']\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const match = manifestContent.match(regex);
  if (!match) return [];
  return [...new Set(extractQuoted(match[1]))];
}

async function countModuleExtensions(moduleDir, limit = 450) {
  const counts = new Map();
  const files = await listFilesRecursive(moduleDir, { maxFiles: limit });
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase() || '[no_ext]';
    counts.set(ext, (counts.get(ext) || 0) + 1);
  }

  return {
    sampled_files: files.length,
    top_extensions: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ext, count]) => ({ ext, count }))
  };
}

async function collectOdooModules(repositoryPath) {
  const manifestPaths = await listFilesRecursive(repositoryPath, {
    maxFiles: 20000,
    include: (filePath) => path.basename(filePath) === '__manifest__.py'
  });

  const modules = [];
  const dependencyCounts = new Map();

  for (const manifestPath of manifestPaths) {
    const moduleDir = path.dirname(manifestPath);
    const moduleName = path.basename(moduleDir);
    const relModulePath = path.relative(repositoryPath, moduleDir);
    const content = await readFileSafe(manifestPath, 50000);

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
      abs_path: moduleDir,
      depends,
      data_files: dataFiles,
      demo_files: demoFiles,
      file_stats: fileStats
    });
  }

  const topDependencies = [...dependencyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([name, count]) => ({ name, count }));

  return {
    module_count: modules.length,
    top_dependencies: topDependencies,
    modules: modules.sort((a, b) => a.module.localeCompare(b.module))
  };
}

function parseModelClasses(content, moduleName, relFilePath) {
  const classMatches = [...content.matchAll(/class\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*:/g)];
  const entries = [];

  for (let i = 0; i < classMatches.length; i += 1) {
    const current = classMatches[i];
    const start = current.index ?? 0;
    const end = classMatches[i + 1]?.index ?? content.length;
    const body = content.slice(start, Math.min(end, start + 12000));
    const bases = current[2] || '';

    const isOdooModel = /(models\.(Model|TransientModel|AbstractModel))/.test(bases);
    if (!isOdooModel) continue;

    const nameMatch = body.match(/\n\s*_name\s*=\s*['"]([^'"]+)['"]/);
    const inheritLine = body.match(/\n\s*_inherit\s*=\s*([^\n]+)/);
    const inheritsLine = body.match(/\n\s*_inherits\s*=\s*\{([\s\S]*?)\}/);

    const inheritTargets = inheritLine ? extractQuoted(inheritLine[1]) : [];
    const delegatedTargets = inheritsLine ? extractQuoted(inheritsLine[1]).filter((_, idx) => idx % 2 === 0) : [];

    entries.push({
      module: moduleName,
      file: relFilePath,
      class_name: current[1],
      model: nameMatch?.[1] || inheritTargets[0] || '',
      model_kind: bases.includes('TransientModel') ? 'transient' : bases.includes('AbstractModel') ? 'abstract' : 'model',
      inherits: inheritTargets,
      delegated_inherits: delegatedTargets
    });
  }

  return entries;
}

async function collectOrmModelMap(repositoryPath, moduleMap) {
  const models = [];

  for (const moduleInfo of moduleMap.modules) {
    const modelsDir = path.join(moduleInfo.abs_path, 'models');
    if (!(await pathExists(modelsDir))) continue;

    const pyFiles = await listFilesRecursive(modelsDir, {
      maxFiles: 600,
      include: (filePath) => filePath.endsWith('.py')
    });

    for (const pyFile of pyFiles) {
      const content = await readFileSafe(pyFile, 120000);
      const rel = path.relative(repositoryPath, pyFile);
      models.push(...parseModelClasses(content, moduleInfo.module, rel));
    }
  }

  const modelsByName = new Map();
  for (const model of models) {
    const key = model.model || `${model.module}.${model.class_name}`;
    if (!modelsByName.has(key)) {
      modelsByName.set(key, {
        model: key,
        modules: new Set(),
        files: new Set(),
        inheritance_links: new Set(),
        delegated_links: new Set(),
        kinds: new Set()
      });
    }
    const agg = modelsByName.get(key);
    agg.modules.add(model.module);
    agg.files.add(model.file);
    model.inherits.forEach((value) => agg.inheritance_links.add(value));
    model.delegated_inherits.forEach((value) => agg.delegated_links.add(value));
    agg.kinds.add(model.model_kind);
  }

  const modelEntries = [...modelsByName.values()]
    .map((item) => ({
      model: item.model,
      modules: [...item.modules].sort(),
      files: [...item.files].sort().slice(0, 12),
      inheritance_links: [...item.inheritance_links].sort(),
      delegated_links: [...item.delegated_links].sort(),
      kinds: [...item.kinds].sort()
    }))
    .sort((a, b) => a.model.localeCompare(b.model));

  const hotspots = modelEntries
    .map((entry) => ({
      model: entry.model,
      extension_points: entry.inheritance_links.length + entry.delegated_links.length,
      modules_count: entry.modules.length
    }))
    .sort((a, b) => b.extension_points - a.extension_points || b.modules_count - a.modules_count)
    .slice(0, 40);

  return {
    generated_at: new Date().toISOString(),
    models_detected: modelEntries.length,
    raw_class_entries: models.length,
    model_entries: modelEntries,
    hotspots
  };
}

async function collectSecurityMap(repositoryPath, moduleMap) {
  const aclEntries = [];
  const ruleEntries = [];

  for (const moduleInfo of moduleMap.modules) {
    const securityDir = path.join(moduleInfo.abs_path, 'security');
    if (!(await pathExists(securityDir))) continue;

    const aclCsvPath = path.join(securityDir, 'ir.model.access.csv');
    if (await pathExists(aclCsvPath)) {
      const csv = await readFileSafe(aclCsvPath, 120000);
      const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1) {
        const headers = parseCsvLine(lines[0]);
        for (const line of lines.slice(1)) {
          const row = parseCsvLine(line);
          const get = (name) => row[headers.indexOf(name)] || '';
          const entry = {
            module: moduleInfo.module,
            id: get('id'),
            model_ref: get('model_id:id'),
            group_ref: get('group_id:id'),
            perm_read: get('perm_read') === '1',
            perm_write: get('perm_write') === '1',
            perm_create: get('perm_create') === '1',
            perm_unlink: get('perm_unlink') === '1'
          };
          aclEntries.push(entry);
        }
      }
    }

    const xmlFiles = await listFilesRecursive(securityDir, {
      maxFiles: 200,
      include: (filePath) => filePath.endsWith('.xml')
    });

    for (const xmlFile of xmlFiles) {
      const xml = await readFileSafe(xmlFile, 180000);
      const rel = path.relative(repositoryPath, xmlFile);
      const matches = [...xml.matchAll(/<record\s+[^>]*model=["']ir\.rule["'][^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/record>/g)];
      for (const match of matches) {
        const body = match[2] || '';
        const modelRef = body.match(/<field\s+name=["']model_id["']\s+ref=["']([^"']+)["']/)?.[1] || '';
        const domainForce = body.match(/<field\s+name=["']domain_force["'][^>]*>([\s\S]*?)<\/field>/)?.[1]?.trim() || '';
        const groups = [...body.matchAll(/ref\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
        ruleEntries.push({
          module: moduleInfo.module,
          file: rel,
          id: match[1],
          model_ref: modelRef,
          groups: [...new Set(groups)],
          has_domain_force: Boolean(domainForce)
        });
      }
    }
  }

  const riskyAcl = aclEntries
    .filter((entry) => !entry.group_ref && (entry.perm_write || entry.perm_create || entry.perm_unlink))
    .slice(0, 300);
  const globalRules = ruleEntries.filter((entry) => entry.groups.length === 0).slice(0, 300);

  return {
    generated_at: new Date().toISOString(),
    acl_count: aclEntries.length,
    record_rule_count: ruleEntries.length,
    risky_acl_entries: riskyAcl,
    global_record_rules: globalRules,
    acl_entries: aclEntries.slice(0, 3000),
    record_rules: ruleEntries.slice(0, 3000)
  };
}

async function collectUiMap(repositoryPath, moduleMap) {
  const viewEntries = [];
  const actionEntries = [];
  const menuEntries = [];

  for (const moduleInfo of moduleMap.modules) {
    const viewsDir = path.join(moduleInfo.abs_path, 'views');
    if (!(await pathExists(viewsDir))) continue;

    const xmlFiles = await listFilesRecursive(viewsDir, {
      maxFiles: 500,
      include: (filePath) => filePath.endsWith('.xml')
    });

    for (const xmlFile of xmlFiles) {
      const xml = await readFileSafe(xmlFile, 220000);
      const rel = path.relative(repositoryPath, xmlFile);

      const viewMatches = [...xml.matchAll(/<record\s+[^>]*model=["']ir\.ui\.view["'][^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/record>/g)];
      for (const match of viewMatches) {
        const body = match[2] || '';
        const model = body.match(/<field\s+name=["']model["']>([^<]+)<\/field>/)?.[1] || '';
        const inheritRef = body.match(/<field\s+name=["']inherit_id["']\s+ref=["']([^"']+)["']/)?.[1] || '';
        viewEntries.push({ module: moduleInfo.module, file: rel, id: match[1], model, inherit_ref: inheritRef });
      }

      const actionMatches = [...xml.matchAll(/<record\s+[^>]*model=["']ir\.actions\.act_window["'][^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/record>/g)];
      for (const match of actionMatches) {
        const body = match[2] || '';
        const resModel = body.match(/<field\s+name=["']res_model["']>([^<]+)<\/field>/)?.[1] || '';
        actionEntries.push({ module: moduleInfo.module, file: rel, id: match[1], res_model: resModel });
      }

      const menuMatches = [...xml.matchAll(/<menuitem\s+([^>]+?)\/>/g)];
      for (const match of menuMatches) {
        const attrs = match[1] || '';
        const extractAttr = (name) => attrs.match(new RegExp(`${name}=["']([^"']+)["']`))?.[1] || '';
        menuEntries.push({
          module: moduleInfo.module,
          file: rel,
          id: extractAttr('id'),
          name: extractAttr('name'),
          action: extractAttr('action'),
          parent: extractAttr('parent')
        });
      }
    }
  }

  const inheritedViews = viewEntries.filter((view) => view.inherit_ref).slice(0, 400);

  return {
    generated_at: new Date().toISOString(),
    view_count: viewEntries.length,
    inherited_view_count: inheritedViews.length,
    action_count: actionEntries.length,
    menu_count: menuEntries.length,
    inherited_views: inheritedViews,
    views: viewEntries.slice(0, 3500),
    actions: actionEntries.slice(0, 2000),
    menus: menuEntries.slice(0, 2000)
  };
}

async function collectRouteMap(repositoryPath, moduleMap) {
  const routes = [];

  for (const moduleInfo of moduleMap.modules) {
    const controllersDir = path.join(moduleInfo.abs_path, 'controllers');
    if (!(await pathExists(controllersDir))) continue;

    const pyFiles = await listFilesRecursive(controllersDir, {
      maxFiles: 300,
      include: (filePath) => filePath.endsWith('.py')
    });

    for (const pyFile of pyFiles) {
      const content = await readFileSafe(pyFile, 160000);
      const rel = path.relative(repositoryPath, pyFile);
      const matches = [...content.matchAll(/@http\.route\(([\s\S]*?)\)\s*\n/g)];
      for (const match of matches) {
        const block = match[1] || '';
        const paths = extractQuoted(block).filter((value) => value.startsWith('/'));
        const auth = block.match(/auth\s*=\s*['"]([^'"]+)['"]/)?.[1] || 'user';
        const type = block.match(/type\s*=\s*['"]([^'"]+)['"]/)?.[1] || 'http';
        const methodsRaw = block.match(/methods\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
        const methods = [...new Set(extractQuoted(methodsRaw).map((value) => value.toUpperCase()))];

        if (paths.length === 0) {
          routes.push({ module: moduleInfo.module, file: rel, route: '[dynamic]', auth, type, methods });
        } else {
          for (const routePath of paths) {
            routes.push({ module: moduleInfo.module, file: rel, route: routePath, auth, type, methods });
          }
        }
      }
    }
  }

  const publicRoutes = routes.filter((route) => route.auth === 'public').slice(0, 400);

  return {
    generated_at: new Date().toISOString(),
    route_count: routes.length,
    public_route_count: publicRoutes.length,
    public_routes: publicRoutes,
    routes: routes.slice(0, 4000)
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
  if ((payload.top_dependencies || []).length === 0) lines.push('- none');
  lines.push('');
  lines.push('## Module Sample');
  lines.push('');
  for (const item of (payload.modules || []).slice(0, 120)) {
    lines.push(`- ${item.module} (${item.path})`);
    lines.push(`  - depends: ${(item.depends || []).join(', ') || 'none'}`);
    lines.push(`  - data_files: ${(item.data_files || []).length}`);
    lines.push(`  - demo_files: ${(item.demo_files || []).length}`);
  }
  if ((payload.modules || []).length === 0) lines.push('- none');
  lines.push('');
  return lines.join('\n');
}

function renderOrmMapMarkdown(payload) {
  const lines = ['# Odoo ORM Model Map', ''];
  lines.push(`- generated_at: ${payload.generated_at}`);
  lines.push(`- models_detected: ${payload.models_detected}`);
  lines.push(`- raw_class_entries: ${payload.raw_class_entries}`);
  lines.push('');
  lines.push('## Model Hotspots');
  lines.push('');
  for (const item of payload.hotspots || []) {
    lines.push(`- ${item.model}: extension_points=${item.extension_points}, modules=${item.modules_count}`);
  }
  if ((payload.hotspots || []).length === 0) lines.push('- none');
  lines.push('');
  return lines.join('\n');
}

function renderSecurityMapMarkdown(payload) {
  const lines = ['# Odoo Security Map', ''];
  lines.push(`- generated_at: ${payload.generated_at}`);
  lines.push(`- acl_count: ${payload.acl_count}`);
  lines.push(`- record_rule_count: ${payload.record_rule_count}`);
  lines.push(`- risky_acl_entries: ${payload.risky_acl_entries.length}`);
  lines.push(`- global_record_rules: ${payload.global_record_rules.length}`);
  lines.push('');
  lines.push('## Risky ACL Sample');
  lines.push('');
  for (const acl of payload.risky_acl_entries.slice(0, 80)) {
    lines.push(
      `- ${acl.module}:${acl.id} model=${acl.model_ref} perms=R${acl.perm_read ? 1 : 0}W${acl.perm_write ? 1 : 0}C${
        acl.perm_create ? 1 : 0
      }D${acl.perm_unlink ? 1 : 0}`
    );
  }
  if (payload.risky_acl_entries.length === 0) lines.push('- none');
  lines.push('');
  return lines.join('\n');
}

function renderUiMapMarkdown(payload) {
  const lines = ['# Odoo UI Map', ''];
  lines.push(`- generated_at: ${payload.generated_at}`);
  lines.push(`- view_count: ${payload.view_count}`);
  lines.push(`- inherited_view_count: ${payload.inherited_view_count}`);
  lines.push(`- action_count: ${payload.action_count}`);
  lines.push(`- menu_count: ${payload.menu_count}`);
  lines.push('');
  lines.push('## Inherited Views Sample');
  lines.push('');
  for (const item of payload.inherited_views.slice(0, 100)) {
    lines.push(`- ${item.module}:${item.id} model=${item.model || 'n/a'} inherit=${item.inherit_ref}`);
  }
  if (payload.inherited_views.length === 0) lines.push('- none');
  lines.push('');
  return lines.join('\n');
}

function renderRouteMapMarkdown(payload) {
  const lines = ['# Odoo Route Map', ''];
  lines.push(`- generated_at: ${payload.generated_at}`);
  lines.push(`- route_count: ${payload.route_count}`);
  lines.push(`- public_route_count: ${payload.public_route_count}`);
  lines.push('');
  lines.push('## Public Route Sample');
  lines.push('');
  for (const item of payload.public_routes.slice(0, 120)) {
    lines.push(`- ${item.module}:${item.route} type=${item.type} methods=${(item.methods || []).join('|') || 'ANY'}`);
  }
  if (payload.public_routes.length === 0) lines.push('- none');
  lines.push('');
  return lines.join('\n');
}

function renderExpertSummaryMarkdown(summary) {
  const lines = ['# Odoo Expert Context Summary', ''];
  lines.push(`- generated_at: ${summary.generated_at}`);
  lines.push(`- repository: ${summary.repository}`);
  lines.push(`- confidence_score: ${summary.confidence_score}`);
  lines.push('');
  lines.push('## Senior Signals');
  lines.push('');
  lines.push(`- modules: ${summary.metrics.modules}`);
  lines.push(`- orm_models: ${summary.metrics.orm_models}`);
  lines.push(`- acl_entries: ${summary.metrics.acl_entries}`);
  lines.push(`- record_rules: ${summary.metrics.record_rules}`);
  lines.push(`- views: ${summary.metrics.views}`);
  lines.push(`- inherited_views: ${summary.metrics.inherited_views}`);
  lines.push(`- routes: ${summary.metrics.routes}`);
  lines.push(`- public_routes: ${summary.metrics.public_routes}`);
  lines.push('');
  lines.push('## Priority Risks');
  lines.push('');
  for (const item of summary.priority_risks || []) lines.push(`- ${item}`);
  if ((summary.priority_risks || []).length === 0) lines.push('- none');
  lines.push('');
  lines.push('## Recommended Workflow');
  lines.push('');
  for (const item of summary.recommended_workflow || []) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## High-Impact Modules');
  lines.push('');
  for (const item of summary.high_impact_modules || []) lines.push(`- ${item.name}: ${item.count}`);
  if ((summary.high_impact_modules || []).length === 0) lines.push('- none');
  lines.push('');
  return lines.join('\n');
}

async function writeArtifactPair(outputDir, baseName, jsonPayload, markdownContent) {
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const mdPath = path.join(outputDir, `${baseName}.md`);
  await writeFile(jsonPath, JSON.stringify(jsonPayload, null, 2), 'utf8');
  await writeFile(mdPath, markdownContent, 'utf8');
  return { jsonPath, mdPath };
}

function buildExpertSummary(workspace, repositoryPath, moduleMap, ormMap, securityMap, uiMap, routeMap) {
  const confidence = Math.max(
    0.55,
    Math.min(
      0.97,
      0.55 +
        Math.min(moduleMap.module_count / 1000, 0.14) +
        Math.min(ormMap.models_detected / 5000, 0.1) +
        Math.min(securityMap.acl_count / 2000, 0.08) +
        Math.min(uiMap.view_count / 8000, 0.06) +
        Math.min(routeMap.route_count / 1500, 0.04)
    )
  );

  const risks = [];
  if (securityMap.risky_acl_entries.length > 0) {
    risks.push(`Review ${securityMap.risky_acl_entries.length} ACL entries that grant write/create/delete without explicit groups.`);
  }
  if (securityMap.global_record_rules.length > 0) {
    risks.push(`Review ${securityMap.global_record_rules.length} record rules with global scope (no group restriction).`);
  }
  if (uiMap.inherited_view_count > 2000) {
    risks.push('High volume of inherited views; UI changes should start from inheritance chain analysis.');
  }
  if (routeMap.public_route_count > 0) {
    risks.push(`Validate security posture for ${routeMap.public_route_count} public routes.`);
  }

  return {
    generated_at: new Date().toISOString(),
    repository: path.relative(workspace, repositoryPath),
    confidence_score: Number(confidence.toFixed(2)),
    metrics: {
      modules: moduleMap.module_count,
      orm_models: ormMap.models_detected,
      acl_entries: securityMap.acl_count,
      record_rules: securityMap.record_rule_count,
      views: uiMap.view_count,
      inherited_views: uiMap.inherited_view_count,
      routes: routeMap.route_count,
      public_routes: routeMap.public_route_count
    },
    high_impact_modules: moduleMap.top_dependencies.slice(0, 20),
    priority_risks: risks,
    recommended_workflow: [
      'Start from module-map to identify impacted modules and dependencies.',
      'Inspect orm-model-map before changing models, fields, or inheritance.',
      'Validate ACL and record rules from security-map before merge.',
      'Trace inherited views/actions from ui-map before changing UI.',
      'Validate route auth/type/methods from route-map for API/controller work.'
    ]
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workspace = path.resolve(options.workspace);
  const repositoryPath = await findRepositoryPath(workspace, options.repo, options.repoPath);

  const outputDir = options.outputDir
    ? resolveMaybeRelative(workspace, options.outputDir)
    : path.join(workspace, 'context-engineering', 'sources', 'odoo-business-model');

  await mkdir(outputDir, { recursive: true });

  const moduleMap = await collectOdooModules(repositoryPath);
  const modulePayload = {
    generated_at: new Date().toISOString(),
    repository: path.relative(workspace, repositoryPath),
    module_count: moduleMap.module_count,
    top_dependencies: moduleMap.top_dependencies,
    modules: moduleMap.modules.map((item) => ({
      module: item.module,
      path: item.path,
      depends: item.depends,
      data_files: item.data_files.length,
      demo_files: item.demo_files.length,
      file_stats: item.file_stats
    }))
  };

  const ormMap = await collectOrmModelMap(repositoryPath, moduleMap);
  const securityMap = await collectSecurityMap(repositoryPath, moduleMap);
  const uiMap = await collectUiMap(repositoryPath, moduleMap);
  const routeMap = await collectRouteMap(repositoryPath, moduleMap);
  const expertSummary = buildExpertSummary(workspace, repositoryPath, modulePayload, ormMap, securityMap, uiMap, routeMap);

  const outputs = [];
  outputs.push(await writeArtifactPair(outputDir, 'module-map', modulePayload, renderModuleMapMarkdown(modulePayload)));
  outputs.push(await writeArtifactPair(outputDir, 'orm-model-map', ormMap, renderOrmMapMarkdown(ormMap)));
  outputs.push(await writeArtifactPair(outputDir, 'security-map', securityMap, renderSecurityMapMarkdown(securityMap)));
  outputs.push(await writeArtifactPair(outputDir, 'ui-map', uiMap, renderUiMapMarkdown(uiMap)));
  outputs.push(await writeArtifactPair(outputDir, 'route-map', routeMap, renderRouteMapMarkdown(routeMap)));
  outputs.push(await writeArtifactPair(outputDir, 'expert-summary', expertSummary, renderExpertSummaryMarkdown(expertSummary)));

  console.log('Odoo expert business context generated');
  console.log(`- workspace: ${workspace}`);
  console.log(`- repository: ${repositoryPath}`);
  console.log(`- modules_detected: ${modulePayload.module_count}`);
  console.log(`- orm_models_detected: ${ormMap.models_detected}`);
  console.log(`- acl_entries: ${securityMap.acl_count}`);
  console.log(`- inherited_views: ${uiMap.inherited_view_count}`);
  console.log(`- routes_detected: ${routeMap.route_count}`);
  for (const item of outputs) {
    console.log(`- artifact_json: ${item.jsonPath}`);
    console.log(`- artifact_md: ${item.mdPath}`);
  }
}

main().catch((error) => {
  console.error(`Addon failed: ${error.message}`);
  process.exit(1);
});

# Troubleshooting

This page covers the most common operational issues for `klever` workflows.

## 1. `klever` command not found after global install

Symptoms:

- `klever: command not found`

Checks:

```bash
npm config get prefix
ls -la "$(npm config get prefix)/bin" | grep klever
```

Fix:

- Ensure your shell PATH includes `$(npm config get prefix)/bin`.
- If using `nvm`, reload shell startup (`.bashrc`/`.zshrc`) and open a new shell.

## 2. LLM key/auth errors during `scan` or `up`

Symptoms:

- repository intelligence not generated
- scan falls back to non-LLM behavior

Checks:

```bash
env | grep -E 'OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY'
klever scan ./ws --json
```

Fix:

- Export the provider key before running commands.
- Use the matching provider with `--llm-provider` if needed.
- Do not commit keys into repository files.

## 3. MCP installed in files but client CLI registration failed

Symptoms:

- `mcp-install-summary.json` shows `cli_registration.failed`

Where to inspect:

- `context-engineering/scan/mcp-install-summary.json`

Typical causes:

- target CLI not installed (`codex`/`claude`)
- CLI auth/session not initialized
- command support differs by CLI version

Fix:

- Keep file-based registration as baseline:
  - `.vscode/mcp.json`
  - `.codex/mcp.json`
  - `.mcp.json`
- then complete auth in each client manually.

## 4. Missing MCP authentication variables

Symptoms:

- MCP server suggested/installed but not operational

Where to inspect:

- `context-engineering/scan/mcp-install-summary.json` -> `auth_missing`

Common variables:

- `GITHUB_PERSONAL_ACCESS_TOKEN`
- `DATABASE_URL`

Fix:

- set required env vars in your local operator environment
- rerun:

```bash
klever mcp install ./ws --all --client all --register-mode auto
```

## 5. Delegated scan mode did not use intended local agent

Symptoms:

- expected `codex`/`claude` execution but got `llm-api`

Checks:

```bash
klever scan ./ws --scan-executor codex --scan-method deep --json
```

Look at:

- `scan_execution.executor`
- `scan_execution_result.mode`
- `context-engineering/scan/delegated-scan-request.md`

Fix:

- ensure local agent CLI is installed and callable in PATH
- if delegation is unavailable, run explicit `llm-api` mode as fallback

## 6. `klever add` feels slow on large repositories

Facts:

- default is shallow clone (`--depth 1`), which is already optimized
- very large repos still require full working tree checkout

Recommendations:

- keep shallow mode for onboarding/context generation
- use `--full-history` only for history-based analysis tasks
- consider adding only required repositories first, then scale incrementally

## 7. Scan output seems too fast / low-detail

Checks:

- verify scan mode:

```bash
klever scan ./ws --json
```

Look for:

- `scan_execution.method` should be `deep`
- `repository_intelligence.status` should be `completed`

Fix:

- force deep run:

```bash
klever scan ./ws --mode deep --write
```

- verify generated files exist:
  - `context-engineering/sources/repositories/source-map.json`
  - `context-engineering/sources/repositories/*.intelligence.md`

## 8. Context appears stale after major refactor

Symptoms:

- agents suggest outdated paths/architecture

Fix:

```bash
klever scan ./ws --mode deep --write
```

Recommended policy:

- run scan after major structural changes
- run scan before planning large feature work
- enforce freshness in team checklist

## 9. `config show` does not reflect expected defaults

Checks:

```bash
klever config show ./ws --json
klever config show --global --json
cat ./ws/.klever/config.json
```

Merge precedence reminder:

1. global config
2. workspace config
3. CLI flags

If behavior differs, pass explicit flags to verify override path.

## 10. Protected branch rejects push to main

Symptoms:

- push rejected with branch protection errors

Fix:

```bash
git checkout -b feat/your-change
git push -u origin feat/your-change
gh pr create --base main --head feat/your-change
```

Wait for required checks to pass, then merge via PR.

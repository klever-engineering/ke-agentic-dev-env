# Contributing to ke-agentic-dev-env

Thanks for contributing to Klever's agentic environment CLI.

## Development setup

Requirements:

- Node.js `>=20`
- npm
- GitHub CLI (`gh`) for release and repository operations

Install and test:

```bash
npm install
npm test
```

Run locally:

```bash
node src/cli.mjs --help
```

## Contribution workflow

1. Fork the repository.
2. Create a branch from `main`.
3. Implement your change with tests when applicable.
4. Run:
   - `npm test`
   - `npm pack --dry-run`
5. Open a pull request using the PR template.

## Commit and PR guidelines

- Use clear, scoped commit messages.
- Keep PRs focused and small when possible.
- Explain user-facing impact and migration implications.
- Reference related issues using `Fixes #<id>` when relevant.

## Areas that require extra care

- Security-sensitive behavior (`scripts/`, token handling, redaction).
- Policy changes that alter default execution permissions.
- Anything that affects generated `AGENTS.md` contracts.

## Reporting bugs and requesting features

- Use GitHub Issues with the provided templates.
- For vulnerabilities, do **not** open a public issue. See `SECURITY.md`.
